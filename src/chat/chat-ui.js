// Chat panel shared by Bridging21 games (plain DOM, no framework).
//   const chat = mountChat({ game: 'football', position: { left: '12px', top: '12px' } });
//   chat.setVisible(false); chat.destroy();
// Lobby = everyone playing this game, quick-chat presets only.
// Private rooms = 6-letter code shared with friends; presets + typed messages.
import { PRESETS, LOBBY } from './presets.js';

const LS = { name: 'b21chat.name', rooms: 'b21chat.rooms', current: 'b21chat.current' };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const CSS = `
.b21c-btn { position: fixed; z-index: var(--b21c-z); width: 46px; height: 46px; border-radius: 50%; border: 2px solid rgba(255,255,255,.5);
  background: rgba(0,0,0,.55); color: #fff; font-size: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer;
  padding: 0; -webkit-tap-highlight-color: transparent; }
.b21c-badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; border-radius: 10px; background: #ff3b5c; color: #fff;
  font: 700 12px/20px -apple-system, sans-serif; text-align: center; padding: 0 5px; }
.b21c-panel { position: fixed; z-index: calc(var(--b21c-z) + 1); top: 0; right: 0; bottom: 0; width: min(380px, 100%); display: flex; flex-direction: column;
  background: #121a26; color: #eef2f7; font: 15px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: -8px 0 30px rgba(0,0,0,.45); user-select: text; -webkit-user-select: text; touch-action: auto;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) 0; }
.b21c-panel * { box-sizing: border-box; }
.b21c-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.1); }
.b21c-title { flex: 1; font-weight: 700; font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.b21c-sub { font-size: 12px; opacity: .65; font-weight: 400; }
.b21c-icon { background: rgba(255,255,255,.08); border: 0; color: #fff; width: 36px; height: 36px; border-radius: 10px; font-size: 18px; cursor: pointer; flex: none; }
.b21c-body { flex: 1; overflow-y: auto; padding: 12px; -webkit-overflow-scrolling: touch; }
.b21c-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: .6; margin: 14px 0 6px; }
.b21c-label:first-child { margin-top: 0; }
.b21c-row { display: flex; gap: 8px; }
.b21c-input { flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.18); background: #0b1119; color: #fff; font-size: 16px; }
.b21c-go { padding: 10px 14px; border-radius: 10px; border: 0; background: #ffd23f; color: #1a1a1a; font-weight: 700; font-size: 15px; cursor: pointer; flex: none; }
.b21c-go.ghost { background: rgba(255,255,255,.1); color: #fff; }
.b21c-card { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 12px; margin-bottom: 8px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color: #fff; cursor: pointer; font-size: 15px; }
.b21c-card b { display: block; }
.b21c-card span { font-size: 12px; opacity: .65; }
.b21c-card .b21c-x { margin-left: auto; opacity: .5; padding: 4px 8px; font-size: 14px; }
.b21c-msgs { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; -webkit-overflow-scrolling: touch; }
.b21c-msg { max-width: 85%; align-self: flex-start; background: rgba(255,255,255,.08); padding: 6px 10px; border-radius: 12px 12px 12px 4px; word-wrap: break-word; }
.b21c-msg.me { align-self: flex-end; background: #2b4a7a; border-radius: 12px 12px 4px 12px; }
.b21c-msg .n { font-size: 12px; font-weight: 700; }
.b21c-msg .t { font-size: 11px; opacity: .5; margin-left: 6px; font-weight: 400; }
.b21c-msg.quick .x { font-size: 17px; }
.b21c-info { text-align: center; font-size: 12px; opacity: .55; padding: 4px; }
.b21c-presets { display: flex; gap: 6px; overflow-x: auto; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,.1); -webkit-overflow-scrolling: touch; }
.b21c-chip { flex: none; padding: 7px 11px; border-radius: 16px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.07); color: #fff; font-size: 14px; cursor: pointer; white-space: nowrap; }
.b21c-compose { padding: 8px 12px 12px; }
.b21c-status { font-size: 12px; color: #ffb84d; padding: 0 12px 6px; min-height: 0; }
.b21c-code { font: 700 13px monospace; letter-spacing: 1px; background: rgba(255,210,63,.15); color: #ffd23f; border: 0; border-radius: 8px; padding: 6px 8px; cursor: pointer; }
.b21c-hidden { display: none !important; }
`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameColor = (n) => { let h = 0; for (const c of n) h = (h * 31 + c.codePointAt(0)) % 360; return `hsl(${h},75%,68%)`; };
const timeStr = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function mountChat({ game, position = { left: '12px', top: '12px' }, zIndex = 1000 }) {
  const presets = PRESETS[game] || [];
  if (!document.getElementById('b21c-style')) {
    const st = document.createElement('style');
    st.id = 'b21c-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  const btn = document.createElement('button');
  btn.className = 'b21c-btn';
  btn.innerHTML = '💬<span class="b21c-badge b21c-hidden"></span>';
  btn.setAttribute('aria-label', 'Chat');
  btn.style.setProperty('--b21c-z', zIndex);
  Object.assign(btn.style, position);
  const badge = btn.querySelector('.b21c-badge');

  const panel = document.createElement('div');
  panel.className = 'b21c-panel b21c-hidden';
  panel.style.setProperty('--b21c-z', zIndex);

  // keep typing / taps inside the chat from reaching the game's controls
  for (const ev of ['keydown', 'keyup', 'keypress', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'pointerdown', 'wheel']) {
    panel.addEventListener(ev, (e) => e.stopPropagation());
    if (ev !== 'keydown' && ev !== 'keyup' && ev !== 'keypress') btn.addEventListener(ev, (e) => e.stopPropagation());
  }
  document.body.append(btn, panel);

  const s = {
    open: false, visible: true, view: 'home',
    name: lsGet(LS.name, ''), rooms: lsGet(LS.rooms, []), current: lsGet(LS.current, null),
    ws: null, connected: false, room: null, messages: [], online: [], unread: 0, status: '',
    retry: 0, retryTimer: null, pingTimer: null, wanted: null, showOnline: false, destroyed: false,
  };

  // ---------- connection ----------
  function connect(code) {
    disconnect();
    s.wanted = code; s.messages = []; s.online = []; s.room = { code, name: code === LOBBY ? 'Lobby' : code }; s.status = 'Connecting…';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/chat/ws?room=${code}&name=${encodeURIComponent(s.name)}`);
    s.ws = ws;
    ws.onopen = () => { s.retry = 0; s.connected = true; };
    ws.onmessage = (ev) => {
      if (ev.data === 'pong') return;
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'hello') {
        s.room = { code: m.code, name: m.roomName || (m.code === LOBBY ? 'Lobby' : 'Room'), lobby: m.lobby };
        s.you = m.you; s.messages = m.history; s.status = '';
        if (!m.lobby) rememberRoom(m.code, m.roomName);
      } else if (m.t === 'msg') {
        s.messages.push(m.m);
        if (s.messages.length > 200) s.messages.shift();
        if (m.m.name !== s.you && !(s.open && s.view === 'room')) s.unread++;
      } else if (m.t === 'presence') s.online = m.online;
      else if (m.t === 'error') { s.status = m.text; setTimeout(() => { if (s.status === m.text) { s.status = ''; render(); } }, 3000); }
      render();
    };
    ws.onclose = () => {
      if (s.ws !== ws) return;
      s.connected = false; s.ws = null;
      clearInterval(s.pingTimer);
      if (s.wanted !== code || s.destroyed) return;
      // room might have been deleted: check before retrying
      fetch(`/api/chat/rooms/${code}`).then((r) => r.json()).then((info) => {
        if (s.wanted !== code) return;
        if (!info.exists) { forgetRoom(code); s.wanted = null; s.current = null; lsSet(LS.current, null); s.view = 'home'; s.status = `Room ${code} no longer exists.`; render(); return; }
        scheduleRetry(code);
      }).catch(() => scheduleRetry(code));
      s.status = 'Reconnecting…'; render();
    };
    s.pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000);
    render();
  }
  function scheduleRetry(code) {
    s.retry = Math.min(s.retry + 1, 6);
    clearTimeout(s.retryTimer);
    s.retryTimer = setTimeout(() => { if (s.wanted === code) connect(code); }, 1000 * Math.min(15, 2 ** s.retry));
  }
  function disconnect() {
    s.wanted = null;
    clearTimeout(s.retryTimer); clearInterval(s.pingTimer);
    if (s.ws) { const w = s.ws; s.ws = null; try { w.close(); } catch {} }
    s.connected = false;
  }
  function send(obj) {
    if (s.ws && s.ws.readyState === 1) { s.ws.send(JSON.stringify(obj)); return true; }
    s.status = 'Not connected yet…'; render(); return false;
  }

  function rememberRoom(code, name) {
    const i = s.rooms.findIndex((r) => r.code === code);
    if (i >= 0) s.rooms[i].name = name || s.rooms[i].name;
    else s.rooms.unshift({ code, name: name || '' });
    lsSet(LS.rooms, s.rooms);
  }
  function forgetRoom(code) { s.rooms = s.rooms.filter((r) => r.code !== code); lsSet(LS.rooms, s.rooms); }

  function openRoom(code) {
    if (!s.name) { s.status = 'Pick a nickname first'; render(); panel.querySelector('[data-f=name]')?.focus(); return; }
    s.current = code; lsSet(LS.current, code);
    s.view = 'room'; s.unread = 0; s.showOnline = false;
    if (!(s.room && s.room.code === code && s.ws)) connect(code);
    render();
  }

  // ---------- rendering ----------
  function renderBadge() {
    badge.textContent = s.unread > 9 ? '9+' : String(s.unread);
    badge.classList.toggle('b21c-hidden', s.unread === 0);
    btn.classList.toggle('b21c-hidden', !s.visible || s.open);
  }

  function render() {
    renderBadge();
    if (!s.open) return;
    if (s.view === 'home') renderHome(); else renderRoom();
  }

  function renderHome() {
    const lobbyOnline = s.room && s.room.code === LOBBY && s.connected ? ` · ${s.online.length} online` : '';
    panel.innerHTML = `
      <div class="b21c-head"><div class="b21c-title">Chat</div><button class="b21c-icon" data-a="close" aria-label="Close">✕</button></div>
      <div class="b21c-body">
        ${s.status ? `<div class="b21c-status" style="padding:0 0 8px">${esc(s.status)}</div>` : ''}
        <div class="b21c-label">Your nickname</div>
        <div class="b21c-row"><input class="b21c-input" data-f="name" maxlength="16" placeholder="e.g. Zaido" value="${esc(s.name)}"><button class="b21c-go ghost" data-a="saveName">Save</button></div>
        <div class="b21c-label">Everyone</div>
        <button class="b21c-card" data-a="lobby"><div><b>🌍 Lobby</b><span>Everyone playing · quick-chat only${lobbyOnline}</span></div></button>
        <div class="b21c-label">Your private rooms</div>
        ${s.rooms.length ? s.rooms.map((r) => `
          <div class="b21c-card" data-a="room" data-code="${r.code}"><div><b>🔒 ${esc(r.name || 'Room')}</b><span>Code ${r.code}</span></div><span class="b21c-x" data-a="forget" data-code="${r.code}" title="Remove from list">✕</span></div>`).join('')
          : '<div class="b21c-info" style="text-align:left">No rooms yet. Make one and share the code with friends.</div>'}
        <div class="b21c-label">Make a private room</div>
        <div class="b21c-row"><input class="b21c-input" data-f="newName" maxlength="30" placeholder="Room name (optional)"><button class="b21c-go" data-a="create">Create</button></div>
        <div class="b21c-label">Join with a code</div>
        <div class="b21c-row"><input class="b21c-input" data-f="code" maxlength="6" placeholder="6-letter code" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:2px"><button class="b21c-go" data-a="join">Join</button></div>
      </div>`;
  }

  function renderRoom() {
    const r = s.room || { code: s.current, name: '' };
    const lobby = r.code === LOBBY;
    const keepScroll = panel.querySelector('.b21c-msgs');
    const atBottom = !keepScroll || keepScroll.scrollHeight - keepScroll.scrollTop - keepScroll.clientHeight < 40;
    const draft = panel.querySelector('[data-f=text]')?.value || '';
    const hadFocus = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.f === 'text';
    panel.innerHTML = `
      <div class="b21c-head">
        <button class="b21c-icon" data-a="back" aria-label="Back">←</button>
        <div class="b21c-title">${lobby ? '🌍' : '🔒'} ${esc(r.name || 'Room')}
          <div class="b21c-sub" data-a="who" style="cursor:pointer">${s.connected ? `${s.online.length} online ▾` : 'offline'}</div></div>
        ${lobby ? '' : `<button class="b21c-code" data-a="share" title="Share code">${r.code} ⧉</button>`}
        <button class="b21c-icon" data-a="close" aria-label="Close">✕</button>
      </div>
      ${s.showOnline ? `<div class="b21c-info" style="padding:6px 12px;text-align:left">Online: ${s.online.map(esc).join(', ') || '—'}</div>` : ''}
      <div class="b21c-msgs">
        ${lobby ? '<div class="b21c-info">Lobby: tap a message below to send it. Make a private room to type.</div>' : ''}
        ${!lobby && s.messages.length === 0 ? `<div class="b21c-info">Share the code <b>${r.code}</b> with friends so they can join.</div>` : ''}
        ${s.messages.map((m) => `
          <div class="b21c-msg ${m.name === s.you ? 'me' : ''} ${m.kind}">
            <div class="n" style="color:${nameColor(m.name)}">${esc(m.name)}<span class="t">${timeStr(m.ts)}</span></div>
            <div class="x">${esc(m.text)}</div>
          </div>`).join('')}
      </div>
      <div class="b21c-status">${esc(s.status)}</div>
      <div class="b21c-presets">${presets.map((p) => `<button class="b21c-chip" data-a="quick" data-id="${p.id}">${esc(p.text)}</button>`).join('')}</div>
      ${lobby ? '' : `<div class="b21c-compose b21c-row"><input class="b21c-input" data-f="text" maxlength="200" placeholder="Message…" enterkeyhint="send" autocomplete="off"><button class="b21c-go" data-a="send">Send</button></div>`}`;
    const list = panel.querySelector('.b21c-msgs');
    if (atBottom) list.scrollTop = list.scrollHeight;
    else list.scrollTop = keepScroll.scrollTop;
    const input = panel.querySelector('[data-f=text]');
    if (input) { input.value = draft; if (hadFocus) input.focus(); }
  }

  // ---------- events ----------
  btn.addEventListener('click', () => {
    s.open = true;
    s.view = s.current ? 'room' : 'home';
    if (s.view === 'room') { s.unread = 0; if (!s.ws && s.name) connect(s.current); }
    panel.classList.remove('b21c-hidden');
    render();
  });

  async function act(a, el) {
    const val = (f) => (panel.querySelector(`[data-f=${f}]`)?.value || '').trim();
    if (a === 'close') { s.open = false; panel.classList.add('b21c-hidden'); render(); }
    else if (a === 'back') { s.view = 'home'; s.status = ''; render(); }
    else if (a === 'who') { s.showOnline = !s.showOnline; render(); }
    else if (a === 'saveName') {
      s.name = val('name').slice(0, 16); lsSet(LS.name, s.name);
      s.status = s.name ? 'Nickname saved' : ''; render();
      if (s.ws && s.wanted) connect(s.wanted); // reconnect so the new name shows
    }
    else if (a === 'lobby') { if (val('name') && val('name') !== s.name) { s.name = val('name'); lsSet(LS.name, s.name); } openRoom(LOBBY); }
    else if (a === 'room') { if (val('name') && val('name') !== s.name) { s.name = val('name'); lsSet(LS.name, s.name); } openRoom(el.dataset.code); }
    else if (a === 'forget') {
      forgetRoom(el.dataset.code);
      if (s.current === el.dataset.code) { disconnect(); s.current = null; lsSet(LS.current, null); }
      render();
    }
    else if (a === 'create') {
      if (val('name')) { s.name = val('name'); lsSet(LS.name, s.name); }
      if (!s.name) { s.status = 'Pick a nickname first'; return render(); }
      s.status = 'Creating…'; render();
      try {
        const r = await fetch('/api/chat/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: val('newName') }) });
        const j = await r.json();
        if (!j.code) throw new Error(j.error || 'failed');
        rememberRoom(j.code, j.name); s.status = '';
        openRoom(j.code);
      } catch { s.status = 'Could not create a room. Check your internet and try again.'; render(); }
    }
    else if (a === 'join') {
      if (val('name')) { s.name = val('name'); lsSet(LS.name, s.name); }
      const code = val('code').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!s.name) { s.status = 'Pick a nickname first'; return render(); }
      if (code.length !== 6) { s.status = 'Codes are 6 letters/numbers'; return render(); }
      s.status = 'Looking for room…'; render();
      try {
        const info = await (await fetch(`/api/chat/rooms/${code}`)).json();
        if (!info.exists) { s.status = `No room with code ${code}`; return render(); }
        rememberRoom(code, info.name); s.status = '';
        openRoom(code);
      } catch { s.status = 'Could not reach chat. Check your internet.'; render(); }
    }
    else if (a === 'quick') send({ t: 'quick', id: el.dataset.id });
    else if (a === 'send') {
      const input = panel.querySelector('[data-f=text]');
      const text = input.value.trim();
      if (text && send({ t: 'msg', text })) { input.value = ''; input.focus(); }
    }
    else if (a === 'share') {
      const code = s.room.code, text = `Join my chat room in the game! Code: ${code}`;
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(code); s.status = 'Code copied!'; render(); }
      } catch {}
    }
  }

  panel.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    e.stopPropagation();
    act(el.dataset.a, el);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const f = e.target.dataset && e.target.dataset.f;
    if (f === 'text') act('send');
    else if (f === 'code') act('join');
    else if (f === 'newName') act('create');
    else if (f === 'name') act('saveName');
  });

  // reconnect to the last room in the background so the unread badge works
  if (s.current && s.name) connect(s.current);
  render();

  return {
    setVisible(v) {
      if (v === s.visible) return;
      s.visible = v;
      if (!v && s.open) { s.open = false; panel.classList.add('b21c-hidden'); }
      renderBadge();
    },
    isOpen: () => s.open,
    destroy() { s.destroyed = true; disconnect(); btn.remove(); panel.remove(); },
  };
}
