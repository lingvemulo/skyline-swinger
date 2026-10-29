// Realistic surfaces made in code (no image downloads): rough cracked rock
// (optionally with glowing lava in the cracks) and worn metal panels with
// seams, rivets, scratches and grime. Each comes with a colour map, a bump
// (normal) map and a roughness map so the lighting picks up the detail.
// Textures are generated once and shared.

const cache = new Map();
const SIZE = 256;

// Metal needs something to reflect or it renders almost black. The game
// hands us a soft studio-style reflection map once (setMetalEnv); every metal
// material, made before or after, uses it.
let metalEnv = null;
const metalMats = [];
export function setMetalEnv(envTex) {
  metalEnv = envTex;
  for (const m of metalMats) { m.envMap = envTex; m.needsUpdate = true; }
}

// ---- small value-noise helpers ----
function makeNoise(seed) {
  const p = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const val = (x, y) => p[(p[x & 255] + y) & 511] / 255;
  const smooth = (t) => t * t * (3 - 2 * t);
  // tileable value noise at integer period `per`
  function noise(x, y, per) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const w = (a) => ((a % per) + per) % per;
    const a = val(w(xi), w(yi)), b = val(w(xi + 1), w(yi)), c = val(w(xi), w(yi + 1)), d = val(w(xi + 1), w(yi + 1));
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  return (x, y, oct = 5, base = 4) => {
    let v = 0, amp = 0.5, f = base;
    for (let o = 0; o < oct; o++) { v += amp * noise(x * f, y * f, f); amp *= 0.5; f *= 2; }
    return v;
  };
}
// tileable cell (Voronoi) edges: 0 at a crack, grows away from it
function cellEdges(seed, cells) {
  const pts = [];
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < cells; i++) pts.push([rnd(), rnd()]);
  return (x, y) => {
    let d1 = 9, d2 = 9;
    for (const [px, py] of pts) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const dx = x - (px + ox), dy = y - (py + oy), d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
    }
    return Math.sqrt(d2) - Math.sqrt(d1);
  };
}
function canvasOf(fill) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  return c;
}
// normal map from a height field (Float32Array SIZE*SIZE)
function normalFrom(height, strength) {
  return canvasOf((d) => {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const h = (xx, yy) => height[((yy + SIZE) % SIZE) * SIZE + ((xx + SIZE) % SIZE)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      d[i] = (-dx / len * 0.5 + 0.5) * 255; d[i + 1] = (-dy / len * 0.5 + 0.5) * 255; d[i + 2] = (1 / len * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  });
}
function tex(THREE, canvas, srgb, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

// ---------- rock ----------
// opts: { color, lava (glowing cracks), repeat }
export function rockMaterial(THREE, opts = {}) {
  const { color = '#6d6862', lava = false, repeat = 2, roughness = 1 } = opts;
  const key = `rock|${color}|${lava}`;
  if (!cache.has(key)) {
    const fbm = makeNoise(7), edges = cellEdges(12345, 14);
    const height = new Float32Array(SIZE * SIZE), crack = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE, v = y / SIZE;
      const n = fbm(u, v, 6, 3);
      const e = edges(u, v);
      const c = Math.max(0, 1 - e / 0.035); // 1 inside a crack
      crack[y * SIZE + x] = c;
      height[y * SIZE + x] = n * 1.2 - c * 0.9 + Math.min(e, 0.12) * 2;
    }
    const [r, g, b] = hex(color);
    const map = canvasOf((d) => {
      for (let i = 0; i < SIZE * SIZE; i++) {
        const h = height[i], c = crack[i];
        let k = 0.55 + h * 0.55;
        k *= 1 - c * 0.6;
        d[i * 4] = Math.min(255, r * k); d[i * 4 + 1] = Math.min(255, g * k); d[i * 4 + 2] = Math.min(255, b * k); d[i * 4 + 3] = 255;
      }
    });
    const rough = canvasOf((d) => {
      for (let i = 0; i < SIZE * SIZE; i++) { const k = 200 + height[i] * 40; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.min(255, k); d[i * 4 + 3] = 255; }
    });
    const em = lava ? canvasOf((d) => {
      for (let i = 0; i < SIZE * SIZE; i++) {
        const c = Math.pow(crack[i], 1.5);
        d[i * 4] = 255 * c; d[i * 4 + 1] = 110 * c; d[i * 4 + 2] = 20 * c; d[i * 4 + 3] = 255;
      }
    }) : null;
    cache.set(key, { map, normal: normalFrom(height, 6), rough, em });
  }
  const c = cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: tex(THREE, c.map, true, repeat), normalMap: tex(THREE, c.normal, false, repeat), roughnessMap: tex(THREE, c.rough, false, repeat),
    roughness, metalness: 0.02, flatShading: !!opts.flat,
  });
  m.normalScale.set(1.4, 1.4);
  if (c.em) {
    m.emissiveMap = tex(THREE, c.em, true, repeat);
    m.emissive.setHex(0xffffff);
    m.emissiveIntensity = opts.glow ?? 1.6;
    m.userData.baseEmissive = 0xffffff;
  }
  return m;
}

// ---------- worn metal ----------
// opts: { color, panels (grid size), stripes (hazard stripes), rust, repeat, metalness, roughness }
export function metalMaterial(THREE, opts = {}) {
  const { color = '#5a6270', panels = 4, stripes = false, rust = 0.3, repeat = 1, metalness = 0.75, roughness = 0.45 } = opts;
  const key = `metal|${color}|${panels}|${stripes}|${rust}`;
  if (!cache.has(key)) {
    const fbm = makeNoise(31);
    let s = 99;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const height = new Float32Array(SIZE * SIZE).fill(0.5);
    const scratch = new Float32Array(SIZE * SIZE);
    const cell = SIZE / panels;
    // panel seams (grooves) and rivets
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const gx = x % cell, gy = y % cell;
      const seam = Math.min(gx, gy, cell - gx, cell - gy);
      let h = 0.5;
      if (seam < 1.5) h = 0.1;
      else if (seam < 3) h = 0.35;
      const rx = (gx - 6), ry = (gy - 6);
      for (const [cx, cy] of [[6, 6], [cell - 6, 6], [6, cell - 6], [cell - 6, cell - 6]]) {
        const dd = Math.hypot(gx - cx, gy - cy);
        if (dd < 2.6) h = 0.85 - dd * 0.12;
      }
      height[y * SIZE + x] = h + (fbm(x / SIZE, y / SIZE, 3, 8) - 0.5) * 0.06;
    }
    // scratches: short random strokes
    for (let k = 0; k < 45; k++) {
      let x = rnd() * SIZE, y = rnd() * SIZE;
      const a = rnd() * Math.PI, len = 4 + rnd() * 16;
      for (let t = 0; t < len; t++) {
        const xi = Math.floor(x + Math.cos(a) * t) & (SIZE - 1), yi = Math.floor(y + Math.sin(a) * t) & (SIZE - 1);
        scratch[yi * SIZE + xi] = 1;
      }
    }
    const [r, g, b] = hex(color);
    const map = canvasOf((d) => {
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        const grime = fbm(x / SIZE, y / SIZE, 4, 4);
        let k = 0.78 + grime * 0.35;
        if (height[i] < 0.2) k *= 0.45; // dark seams
        let cr = r * k, cg = g * k, cb = b * k;
        if (stripes && Math.floor((x + y) / 22) % 2 === 0 && y > SIZE * 0.82) { cr = 230 * k; cg = 180 * k; cb = 30 * k; }
        const rustK = Math.max(0, grime - (1 - rust)) * 2.2;
        cr = cr * (1 - rustK) + 120 * rustK; cg = cg * (1 - rustK) + 62 * rustK; cb = cb * (1 - rustK) + 30 * rustK;
        if (scratch[i]) { cr = cr * 0.75 + 170 * 0.25; cg = cg * 0.75 + 175 * 0.25; cb = cb * 0.75 + 180 * 0.25; }
        d[i * 4] = Math.min(255, cr); d[i * 4 + 1] = Math.min(255, cg); d[i * 4 + 2] = Math.min(255, cb); d[i * 4 + 3] = 255;
      }
    });
    const rough = canvasOf((d) => {
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        const k = scratch[i] ? 70 : 110 + fbm(x / SIZE, y / SIZE, 4, 6) * 120;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.min(255, k); d[i * 4 + 3] = 255;
      }
    });
    cache.set(key, { map, normal: normalFrom(height, 3), rough });
  }
  const c = cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: tex(THREE, c.map, true, repeat), normalMap: tex(THREE, c.normal, false, repeat), roughnessMap: tex(THREE, c.rough, false, repeat),
    metalness, roughness: roughness * 2, // roughness map averages ~0.5
  });
  m.envMap = metalEnv;
  m.envMapIntensity = 1.1;
  metalMats.push(m);
  return m;
}

// ---------- molten lava ----------
// swirling glowing yellow/orange with darker cooling crust
export function lavaMaterial(THREE, opts = {}) {
  const { repeat = 1, glow = 2.2 } = opts;
  const key = 'lava';
  if (!cache.has(key)) {
    const fbm = makeNoise(77);
    const heat = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE, v = y / SIZE;
      const w = fbm(u + fbm(u, v, 3, 3) * 0.35, v, 5, 3); // warped noise = flowing look
      heat[y * SIZE + x] = Math.min(1, Math.max(0, (w - 0.32) * 2.2));
    }
    const map = canvasOf((d) => {
      for (let i = 0; i < SIZE * SIZE; i++) {
        const h = heat[i];
        d[i * 4] = 40 + 60 * h; d[i * 4 + 1] = 12 + 20 * h; d[i * 4 + 2] = 6; d[i * 4 + 3] = 255;
      }
    });
    const em = canvasOf((d) => {
      for (let i = 0; i < SIZE * SIZE; i++) {
        const h = heat[i];
        d[i * 4] = 255 * Math.min(1, h * 1.4); d[i * 4 + 1] = 40 + 200 * h * h; d[i * 4 + 2] = 30 * h * h * h; d[i * 4 + 3] = 255;
      }
    });
    const height = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) height[i] = 1 - heat[i];
    cache.set(key, { map, em, normal: normalFrom(height, 2.5) });
  }
  const c = cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: tex(THREE, c.map, true, repeat), normalMap: tex(THREE, c.normal, false, repeat),
    emissiveMap: tex(THREE, c.em, true, repeat), emissive: 0xffffff, emissiveIntensity: glow, roughness: 0.6, metalness: 0,
  });
  m.userData.baseEmissive = 0xffffff;
  return m;
}
