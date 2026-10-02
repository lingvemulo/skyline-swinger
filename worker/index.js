// Worker: serves the game (static assets) and the chat API under /api/chat.
//   POST /api/chat/rooms            { name }  -> { code, name }   create a private room
//   GET  /api/chat/rooms/:code                -> { exists, name, online }
//   GET  /api/chat/ws?room=CODE&name=Nick      WebSocket into the room
// Each room (and the shared Lobby) is one ChatRoom Durable Object, keyed by its code.
import { ChatRoom } from './chat-room.js';
import { LOBBY } from '../src/chat/presets.js';

export { ChatRoom };

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L mix-ups
const CODE_RE = /^[A-Z0-9]{6}$/;

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

const roomStub = (env, code) => env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(code));
const validCode = (c) => c === LOBBY || CODE_RE.test(c);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/chat')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/chat/rooms' && request.method === 'POST') {
      let name = '';
      try { name = String((await request.json()).name || ''); } catch {}
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const r = await roomStub(env, code).fetch('https://room/create', {
          method: 'POST', body: JSON.stringify({ code, name }),
        });
        if (r.ok) return Response.json(await r.json());
      }
      return Response.json({ error: 'Could not create a room, try again' }, { status: 500 });
    }

    const info = url.pathname.match(/^\/api\/chat\/rooms\/([A-Za-z0-9]+)$/);
    if (info && request.method === 'GET') {
      const code = info[1].toUpperCase();
      if (!validCode(code)) return Response.json({ exists: false });
      return roomStub(env, code).fetch(`https://room/info?code=${code}`);
    }

    if (url.pathname === '/api/chat/ws') {
      const code = (url.searchParams.get('room') || '').toUpperCase();
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      if (!validCode(code)) return new Response('Bad room code', { status: 400 });
      const name = url.searchParams.get('name') || '';
      return roomStub(env, code).fetch(
        `https://room/ws?code=${code}&name=${encodeURIComponent(name)}`,
        { headers: request.headers },
      );
    }

    return new Response('Not found', { status: 404 });
  },
};
