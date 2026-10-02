// One chat room = one Durable Object with its own SQLite storage.
// Uses WebSocket hibernation so idle rooms cost nothing.
import { DurableObject } from 'cloudflare:workers';
import { PRESETS, LOBBY } from '../src/chat/presets.js';
import { cleanName, cleanText } from './filter.js';

const KEEP_MESSAGES = 200;
const HISTORY_ON_JOIN = 100;
const ROOM_EXPIRY_MS = 30 * 24 * 3600 * 1000; // private rooms vanish after 30 days with no messages
const BURST = 5, REFILL_MS = 1500;             // rate limit: 5 quick messages, then one per 1.5s

export class ChatRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, text TEXT, kind TEXT, ts INTEGER)`);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  meta(k) {
    const r = this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray();
    return r.length ? r[0].v : null;
  }
  setMeta(k, v) { this.sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, v); }
  get presets() { return PRESETS[this.env.GAME] || []; }

  exists(code) {
    if (this.meta('code')) return true;
    if (code === LOBBY) { this.setMeta('code', LOBBY); this.setMeta('name', 'Lobby'); return true; }
    return false;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (url.pathname === '/create') {
      if (this.meta('code')) return new Response('taken', { status: 409 });
      const body = await request.json();
      const name = cleanText(body.name).slice(0, 30);
      this.setMeta('code', body.code);
      this.setMeta('name', name);
      await this.bumpExpiry();
      return Response.json({ code: body.code, name });
    }

    if (url.pathname === '/info') {
      if (!this.exists(code)) return Response.json({ exists: false });
      return Response.json({ exists: true, code, name: this.meta('name'), online: this.online().length });
    }

    if (url.pathname === '/ws') {
      if (!this.exists(code)) return new Response('No such room', { status: 404 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const name = cleanName(url.searchParams.get('name'));
      server.serializeAttachment({ name, tokens: BURST, last: Date.now() });
      const history = this.sql
        .exec('SELECT id, name, text, kind, ts FROM msgs ORDER BY id DESC LIMIT ?', HISTORY_ON_JOIN)
        .toArray().reverse();
      server.send(JSON.stringify({
        t: 'hello', code, roomName: this.meta('name'), you: name, lobby: code === LOBBY, history,
      }));
      this.broadcastPresence();
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    const att = ws.deserializeAttachment();
    const lobby = this.meta('code') === LOBBY;

    let text, kind;
    if (msg.t === 'quick') {
      const p = this.presets.find((x) => x.id === msg.id);
      if (!p) return;
      text = p.text; kind = 'quick';
    } else if (msg.t === 'msg') {
      if (lobby) return this.sendTo(ws, { t: 'error', text: 'The Lobby is quick-chat only. Make a private room to type.' });
      text = cleanText(msg.text); kind = 'text';
      if (!text) return;
    } else return;

    // token-bucket rate limit, stored on the socket so it survives hibernation
    const now = Date.now();
    att.tokens = Math.min(BURST, att.tokens + (now - att.last) / REFILL_MS);
    att.last = now;
    if (att.tokens < 1) { ws.serializeAttachment(att); return this.sendTo(ws, { t: 'error', text: 'Slow down a bit!' }); }
    att.tokens -= 1;
    ws.serializeAttachment(att);

    const row = this.sql
      .exec('INSERT INTO msgs (name, text, kind, ts) VALUES (?, ?, ?, ?) RETURNING id', att.name, text, kind, now)
      .one();
    this.sql.exec('DELETE FROM msgs WHERE id <= ?', row.id - KEEP_MESSAGES);
    await this.bumpExpiry();
    this.broadcast({ t: 'msg', m: { id: row.id, name: att.name, text, kind, ts: now } });
  }

  webSocketClose(ws) { this.broadcastPresence(ws); }
  webSocketError(ws) { this.broadcastPresence(ws); }

  async bumpExpiry() { await this.ctx.storage.setAlarm(Date.now() + ROOM_EXPIRY_MS); }

  async alarm() {
    if (this.meta('code') === LOBBY) {
      this.sql.exec('DELETE FROM msgs WHERE ts < ?', Date.now() - ROOM_EXPIRY_MS);
    } else {
      for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, 'Room expired'); } catch {} }
      await this.ctx.storage.deleteAll();
    }
  }

  online(exclude) {
    const names = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude || ws.readyState !== WebSocket.OPEN) continue;
      const a = ws.deserializeAttachment();
      if (a && !names.includes(a.name)) names.push(a.name);
    }
    return names;
  }
  broadcastPresence(exclude) { this.broadcast({ t: 'presence', online: this.online(exclude) }, exclude); }
  sendTo(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }
  broadcast(obj, exclude) {
    const s = JSON.stringify(obj);
    for (const ws of this.ctx.getWebSockets()) if (ws !== exclude) { try { ws.send(s); } catch {} }
  }
}
