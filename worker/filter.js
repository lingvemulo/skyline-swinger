// Light word filter for nicknames and typed messages. Masks whole words that start with a listed root,
// allowing for common letter swaps (f*ck, sh1t, @ss...). Not perfect — rooms are private, invite-only.
const ROOTS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'piss', 'bastard', 'asshole', 'arsehole', 'slut', 'whore',
  'fag', 'nigg', 'retard', 'wank', 'twat', 'cock', 'pussy', 'bollock', 'prick', 'motherf',
];
const SWAPS = { a: '[a@4*]', e: '[e3*]', i: '[i1!*]', o: '[o0*]', s: '[s$5*]', u: '[uv*]', t: '[t7]' };
const RE = new RegExp(
  '(^|[^\\p{L}\\p{N}])(' + ROOTS.map((r) => [...r].map((c) => (SWAPS[c] || c) + '+').join('')).join('|') + ')[\\p{L}\\p{N}]*',
  'giu',
);

export function clean(text) {
  return text.replace(RE, (m, pre, root) => pre + '*'.repeat(m.length - pre.length));
}

export function cleanName(raw) {
  let n = String(raw || '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (n.length < 2) n = 'Player' + Math.floor(1000 + Math.random() * 9000);
  return clean(n);
}

export function cleanText(raw) {
  const t = String(raw || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  return clean(t);
}
