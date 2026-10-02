// Furniture, windows and ceiling lights for the building interiors.
// Pieces are designed in metres and scaled by S to world units (the hero is
// ~2.5 units tall, so 1 m ≈ 1.4 units). Every piece's "front" faces local +z;
// rotate by 0 / π / ±π/2 to put its back against the north / south / east /
// west wall. Room coordinates run x, z ∈ [-12.85, 12.85] (inner wall faces).

export const S = 1.4;
const WALL = 12.85;
const N = (depthM) => -WALL + (depthM * S) / 2 + 0.05; // against the north wall
const So = (depthM) => WALL - (depthM * S) / 2 - 0.05; // against the south wall
const E = (depthM) => WALL - (depthM * S) / 2 - 0.05;  // against the east wall
const Wst = (depthM) => -WALL + (depthM * S) / 2 + 0.05; // against the west wall
const ROT = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 };

// ---------- procedural textures ----------
function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const PRODUCT_COLS = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d', '#ffffff', '#8ecae6', '#ff006e', '#06d6a0', '#ffb703'];
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function productsTex(THREE) {
  return canvasTex(THREE, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9dde2'; ctx.fillRect(0, 0, w, h);
    const rows = 4, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = '#9aa2ab'; ctx.fillRect(0, r * rh + rh - 6, w, 6); // shelf lip
      let x = 4;
      while (x < w - 10) {
        const bw = rand(14, 34), bh = rand(rh * 0.45, rh * 0.85);
        ctx.fillStyle = pick(PRODUCT_COLS);
        ctx.fillRect(x, r * rh + rh - 6 - bh, bw, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x + 3, r * rh + rh - 6 - bh * 0.7, bw - 6, bh * 0.18); // label
        x += bw + rand(2, 5);
      }
    }
  });
}
function booksTex(THREE) {
  return canvasTex(THREE, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4a3020'; ctx.fillRect(0, 0, w, h);
    const rows = 4, rh = h / rows;
    const cols = ['#7b2d26', '#1d3557', '#2d6a4f', '#bc6c25', '#3d405b', '#e0c097', '#6d597a'];
    for (let r = 0; r < rows; r++) {
      let x = 6;
      while (x < w - 8) {
        const bw = rand(7, 16), bh = rand(rh * 0.6, rh * 0.88);
        ctx.fillStyle = pick(cols);
        ctx.fillRect(x, r * rh + rh - 8 - bh, bw, bh);
        x += bw + 1;
      }
      ctx.fillStyle = '#3a2416'; ctx.fillRect(0, r * rh + rh - 8, w, 8);
    }
  });
}
function fridgeTex(THREE) {
  return canvasTex(THREE, 256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#eaf6ff'); g.addColorStop(1, '#bcd8ee');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const rows = 5, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let x = 8; x < w - 14; x += 18) {
        ctx.fillStyle = pick(PRODUCT_COLS);
        const bh = rh * rand(0.55, 0.75);
        ctx.fillRect(x, r * rh + rh - 6 - bh, 12, bh);
        ctx.fillRect(x + 4, r * rh + rh - 6 - bh - 8, 4, 8); // bottle neck
      }
      ctx.fillStyle = '#9fb3c4'; ctx.fillRect(0, r * rh + rh - 6, w, 6);
    }
    ctx.strokeStyle = '#8a9aa8'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  });
}
function screenTex(THREE, kind) {
  return canvasTex(THREE, 256, 160, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, kind === 'tv' ? '#1b4f8a' : '#24324a');
    g.addColorStop(1, kind === 'tv' ? '#4fb3d9' : '#3c5a80');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (kind === 'tv') {
      ctx.fillStyle = '#7cc46b'; ctx.fillRect(0, h * 0.72, w, h * 0.28); // a "nature show"
      ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(w * 0.75, h * 0.3, 18, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 9; i++) ctx.fillRect(14, 14 + i * 15, rand(60, 200), 6); // "text"
    }
  });
}
// City view seen through the windows: daytime sky + skyline with lit windows.
export function skylineTex(THREE) {
  return canvasTex(THREE, 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3f7fc0'); g.addColorStop(0.7, '#bfe0f2'); g.addColorStop(1, '#ffe2b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let layer = 0; layer < 2; layer++) {
      let x = -10;
      while (x < w) {
        const bw = rand(30, 70), bh = layer ? rand(80, 200) : rand(60, 140);
        ctx.fillStyle = layer ? '#3b4a60' : '#8fa8c2';
        ctx.fillRect(x, h - bh, bw, bh);
        if (layer) {
          for (let wy = h - bh + 8; wy < h - 6; wy += 12) {
            for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
              ctx.fillStyle = Math.random() < 0.4 ? '#ffe096' : '#1e2836';
              ctx.fillRect(wx, wy, 5, 7);
            }
          }
        }
        x += bw + rand(2, 12);
      }
    }
  });
}

// ---------- furnishing ----------
// api: { group, solids, FLOOR_H, CEIL, tex(name), type }
export function furnish(THREE, api) {
  const { group, solids, FLOOR_H, CEIL, type } = api;

  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
  const texMat = (name, tile, color = 0xffffff, extra = {}) => {
    const m = std({ map: api.tex(name), color, ...extra });
    m.userData.tile = tile;
    return m;
  };
  const M = {
    wood: texMat('oak_veneer_01', 1.4),
    darkWood: texMat('oak_veneer_01', 1.4, 0x6b4a33),
    white: std({ color: 0xf1f1ee, roughness: 0.5 }),
    offWhite: std({ color: 0xe4e0d6, roughness: 0.6 }),
    black: std({ color: 0x1c1d20, roughness: 0.4 }),
    metal: std({ color: 0xb4bac0, roughness: 0.3, metalness: 0.7 }),
    steel: std({ color: 0x6f7780, roughness: 0.45, metalness: 0.6 }),
    stone: texMat('marble_tiles', 2.2, 0xf0f0f0, { roughness: 0.25 }),
    sofaBlue: texMat('fabric', 1.2, 0x4f78c0),
    sofaGrey: texMat('fabric', 1.2, 0xa8a8a8),
    sofaRed: texMat('fabric', 1.2, 0xb53a3a),
    sofaGreen: texMat('fabric', 1.2, 0x4f9466),
    leather: std({ color: 0x5a3622, roughness: 0.45 }),
    bedding: std({ color: 0xf7f7f4, roughness: 0.9 }),
    leaves: std({ color: 0x3f7d3a, roughness: 0.8 }),
    leaves2: std({ color: 0x5c9e47, roughness: 0.8 }),
    pot: std({ color: 0xb5653a, roughness: 0.9 }),
    lampShade: new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    ceilingLight: new THREE.MeshBasicMaterial({ color: 0xfffaf0 }),
    glassFront: new THREE.MeshBasicMaterial({ map: fridgeTex(THREE), side: THREE.DoubleSide }),
    products: std({ map: productsTex(THREE), roughness: 0.6 }),
    books: std({ map: booksTex(THREE), roughness: 0.8 }),
    tvScreen: new THREE.MeshBasicMaterial({ map: screenTex(THREE, 'tv') }),
    pcScreen: new THREE.MeshBasicMaterial({ map: screenTex(THREE, 'pc') }),
    fridgeBack: new THREE.MeshBasicMaterial({ map: fridgeTex(THREE) }),
    tiles: texMat('interior_tiles', 1.6),
    pingpong: std({ color: 0x1f6e4a, roughness: 0.5 }),
    locker: std({ color: 0x4a6fa5, roughness: 0.4, metalness: 0.4 }),
    crate: texMat('oak_veneer_01', 1.2, 0xc9a26b),
    cardboard: std({ color: 0xb98d5a, roughness: 0.95 }),
    windowFrame: std({ color: 0x2b3038, roughness: 0.4, metalness: 0.5 }),
    view: new THREE.MeshBasicMaterial({ map: skylineTex(THREE) }),
    water: std({ color: 0x7fc4ff, roughness: 0.1, transparent: true, opacity: 0.8 }),
  };
  // things the hero can interact with, returned to interiors.js
  const swings = [];   // hinged doors that open as the hero approaches: { pivot, open, max }
  const uses = [];     // things to USE: { kind: 'tv', obj }
  // a hinged panel: pivot at x = hingeX (metres, local), panel extends +x by width
  function hinged(width, height, mat, hingeX, y, z, sign = 1) {
    const pivot = new THREE.Group();
    pivot.position.set(hingeX * S, 0, z * S);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width * S, height * S, 0.04 * S), mat);
    panel.position.set(width / 2 * S, y * S, 0);
    panel.userData.keep = true;
    pivot.add(panel);
    pivot.userData.swing = { max: 1.6 * sign };
    return pivot;
  }
  const blanketMats = [0x3d5a80, 0x9b2c2c, 0x6a994e, 0xc9a227, 0x7b5ea7].map(c => std({ color: c, roughness: 0.9 }));
  const chairMats = [M.sofaBlue, M.sofaGrey, M.sofaRed, M.black];

  // world-scaled UVs so textures tile at the same size on every box
  function worldUV(geo, w, h, d, tile) {
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
      }
    }
  }
  // Box (metres): size w,h,d centred at x,y,z
  function B(w, h, d, mat, x, y, z) {
    const geo = new THREE.BoxGeometry(w * S, h * S, d * S);
    if (mat.userData.tile) worldUV(geo, w * S, h * S, d * S, mat.userData.tile);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * S, y * S, z * S);
    return m;
  }
  // Cylinder (metres)
  function C(rTop, rBot, h, mat, x, y, z, seg = 14) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop * S, rBot * S, h * S, seg), mat);
    m.position.set(x * S, y * S, z * S);
    return m;
  }
  function Sph(r, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * S, 12, 9), mat);
    m.position.set(x * S, y * S, z * S);
    return m;
  }
  // Plane (metres) facing local +z
  function Pl(w, h, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * S, h * S), mat);
    m.position.set(x * S, y * S, z * S);
    return m;
  }

  // Place a piece (array of meshes) at room position x,z (world units) on floor k.
  function add(parts, x, k, z, rot = 0, { solid = true } = {}) {
    const g = new THREE.Group();
    parts.forEach(p => g.add(p));
    g.position.set(x, k * FLOOR_H, z);
    g.rotation.y = rot;
    group.add(g);
    g.traverse(o => { if (o.userData.swing) swings.push({ pivot: o, open: 0, max: o.userData.swing.max, floor: k }); });
    if (parts.some(p => p.material === M.tvScreen)) uses.push({ kind: 'tv', obj: g, floor: k });
    if (solid) {
      group.updateMatrixWorld(true);
      solids.push(new THREE.Box3().setFromObject(g));
    }
    return g;
  }

  // ---------- pieces (metres, front = +z) ----------
  // turn a piece 180° about its own origin
  const turn = (parts) => parts.map(p => { p.position.x *= -1; p.position.z *= -1; p.rotation.y += Math.PI; return p; });
  const legs = (w, d, h, mat, inset = 0.06) => [-1, 1].flatMap(sx => [-1, 1].map(sz =>
    B(0.05, h, 0.05, mat, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset))));
  const sofa = (len = 2.1, mat = M.sofaBlue) => [
    B(len, 0.42, 0.9, mat, 0, 0.21, 0),
    B(len - 0.3, 0.12, 0.65, mat, 0, 0.48, 0.08), // seat cushion
    B(len, 0.5, 0.22, mat, 0, 0.67, -0.34),
    B(0.18, 0.6, 0.9, mat, -(len / 2 - 0.09), 0.3, 0),
    B(0.18, 0.6, 0.9, mat, len / 2 - 0.09, 0.3, 0),
  ];
  const table = (w, d, h = 0.75, mat = M.wood, legMat = M.steel) => [
    B(w, 0.05, d, mat, 0, h - 0.025, 0), ...legs(w, d, h - 0.05, legMat),
  ];
  const chair = (mat = M.black) => [
    B(0.46, 0.06, 0.46, mat, 0, 0.46, 0),
    B(0.46, 0.5, 0.06, mat, 0, 0.74, -0.2),
    ...legs(0.46, 0.46, 0.43, M.steel, 0.04),
  ];
  const desk = (chairMat = M.black) => [
    ...table(1.4, 0.7, 0.75, M.wood),
    B(0.56, 0.36, 0.04, M.black, 0, 1.0, -0.18),
    Pl(0.52, 0.32, M.pcScreen, 0, 1.0, -0.155),
    B(0.06, 0.2, 0.06, M.black, 0, 0.84, -0.2),
    B(0.44, 0.02, 0.14, M.black, 0, 0.76, 0.05),
    ...turn(chair(chairMat)).map(p => { p.position.z += 0.6 * S; return p; }),
  ];
  const bed = (w = 1.6, blanket = pick(blanketMats)) => [
    B(w + 0.06, 0.3, 2.05, M.darkWood, 0, 0.15, 0),
    B(w, 0.22, 1.95, M.bedding, 0, 0.41, 0.02),
    B(w + 0.04, 0.07, 1.25, blanket, 0, 0.55, 0.38),
    ...(w > 1.2 ? [-1, 1] : [0]).map(sx => B(0.55, 0.13, 0.36, M.bedding, sx * w / 4, 0.58, -0.72)),
    B(w + 0.06, 1.05, 0.08, M.darkWood, 0, 0.52, -1.02),
  ];
  const lamp = (x = 0, y = 0, z = 0) => [
    C(0.03, 0.05, 0.32, M.metal, x, y + 0.16, z),
    C(0.12, 0.17, 0.2, M.lampShade, x, y + 0.42, z),
  ];
  const nightstand = () => [B(0.45, 0.5, 0.4, M.wood, 0, 0.25, 0), ...lamp(0, 0.5, 0)];
  const floorLamp = () => [C(0.15, 0.15, 0.03, M.black, 0, 0.015, 0), C(0.02, 0.02, 1.5, M.black, 0, 0.77, 0), C(0.17, 0.24, 0.3, M.lampShade, 0, 1.55, 0)];
  const plant = (big = true) => [
    C(0.2, 0.15, 0.42, M.pot, 0, 0.21, 0),
    Sph(big ? 0.4 : 0.28, M.leaves, 0, big ? 0.85 : 0.65, 0),
    Sph(big ? 0.3 : 0.2, M.leaves2, 0.12, big ? 1.2 : 0.88, 0.05),
  ];
  const rug = (w, d, mat) => [B(w, 0.012, d, mat, 0, 0.006, 0)];
  const coffeeTable = (w = 1.1, d = 0.6) => table(w, d, 0.42, M.darkWood, M.darkWood);
  const shelfUnit = (len, h = 1.9, mat = M.products, body = M.white) => [
    B(len, h, 0.45, body, 0, h / 2, 0),
    Pl(len - 0.06, h - 0.08, mat, 0, h / 2, 0.226),
  ];
  const islandShelf = (len, h = 1.6, mat = M.products) => {
    const back = Pl(len - 0.06, h - 0.08, mat, 0, h / 2, -0.451);
    back.rotation.y = Math.PI;
    return [B(len, h, 0.9, M.white, 0, h / 2, 0), Pl(len - 0.06, h - 0.08, mat, 0, h / 2, 0.451), back];
  };
  const fridge = (len = 2) => [
    B(len, 2.0, 0.75, M.white, 0, 1.0, 0),
    Pl(len - 0.12, 1.75, M.fridgeBack, 0, 1.02, 0.379),
    hinged(len - 0.12, 1.75, M.glassFront, -(len - 0.12) / 2, 1.02, 0.405),
  ];
  const counter = (len, d = 0.62, h = 0.95, body = M.wood, top = M.stone) => [
    B(len, h - 0.04, d, body, 0, (h - 0.04) / 2, 0),
    B(len + 0.04, 0.04, d + 0.04, top, 0, h - 0.02, 0),
  ];
  const register = () => [B(0.38, 0.12, 0.32, M.black, 0, 1.01, 0), B(0.3, 0.22, 0.04, M.black, 0, 1.15, -0.1), Pl(0.26, 0.18, M.pcScreen, 0, 1.15, -0.079)];
  const kitchen = (len) => [
    ...counter(len, 0.62, 0.92, M.white, M.stone),
    B(len, 0.7, 0.35, M.white, 0, 1.9, -0.13),               // wall cabinets
    B(0.6, 0.02, 0.5, M.black, -len / 2 + 1.0, 0.93, 0),     // hob
    B(0.5, 0.03, 0.38, M.metal, len / 2 - 1.4, 0.92, 0),     // sink
    C(0.015, 0.015, 0.3, M.metal, len / 2 - 1.4, 1.07, -0.22),
    B(0.75, 1.95, 0.6, M.metal, len / 2 + 0.4, 0.975, -0.04), // fridge body
    hinged(0.75, 1.92, M.metal, len / 2 + 0.025, 0.975, 0.28), // fridge door
  ];
  const tvUnit = () => [
    B(1.6, 0.45, 0.42, M.darkWood, 0, 0.225, 0),
    B(1.25, 0.72, 0.05, M.black, 0, 0.95, -0.1),
    Pl(1.19, 0.66, M.tvScreen, 0, 0.95, -0.074),
  ];
  const wallTV = () => [B(1.25, 0.72, 0.05, M.black, 0, 1.5, 0), Pl(1.19, 0.66, M.tvScreen, 0, 1.5, 0.026)];
  const wardrobe = () => [B(1.5, 2.0, 0.6, M.wood, 0, 1.0, 0), B(0.02, 1.9, 0.01, M.darkWood, 0, 1.0, 0.301)];
  const bookshelf = (len = 1.6) => shelfUnit(len, 2.0, M.books, M.darkWood);
  const bathtub = () => [B(1.7, 0.55, 0.8, M.white, 0, 0.275, 0), B(1.5, 0.02, 0.6, M.water, 0, 0.5, 0)];
  const toilet = () => [C(0.18, 0.15, 0.4, M.white, 0, 0.2, 0.05), B(0.4, 0.35, 0.18, M.white, 0, 0.55, -0.2)];
  const basin = () => [B(0.55, 0.85, 0.42, M.white, 0, 0.425, 0), Pl(0.6, 0.8, M.metal, 0, 1.55, -0.2)];
  const washer = () => [B(0.6, 0.85, 0.6, M.white, 0, 0.425, 0), (() => { const d = C(0.2, 0.2, 0.03, M.black, 0, 0.45, 0.305); d.rotation.x = Math.PI / 2; return d; })()];
  const crateStack = (n = 2) => Array.from({ length: n }, (_, i) => B(0.8, 0.8, 0.8, i % 2 ? M.cardboard : M.crate, (Math.random() - 0.5) * 0.1, 0.4 + i * 0.8, (Math.random() - 0.5) * 0.1));
  const lockers = (len) => [B(len, 1.9, 0.5, M.locker, 0, 0.95, 0), ...Array.from({ length: Math.round(len / 0.5) - 1 }, (_, i) => B(0.02, 1.85, 0.01, M.black, -len / 2 + 0.5 * (i + 1), 0.95, 0.251))];
  const whiteboard = () => [B(1.8, 1.0, 0.03, M.white, 0, 1.5, 0), B(1.86, 0.04, 0.06, M.steel, 0, 0.99, 0.02)];
  const stool = () => [C(0.2, 0.2, 0.06, M.leather, 0, 0.75, 0), C(0.03, 0.03, 0.72, M.metal, 0, 0.36, 0), C(0.18, 0.18, 0.02, M.metal, 0, 0.01, 0)];
  const waterCooler = () => [B(0.35, 1.0, 0.35, M.white, 0, 0.5, 0), C(0.14, 0.14, 0.45, M.water, 0, 1.22, 0)];
  const pingPong = () => [...table(2.74, 1.52, 0.76, M.pingpong, M.black), B(0.02, 0.15, 1.6, M.white, 0, 0.83, 0)];
  const signBoard = (tex, w, h) => [Pl(w, h, new THREE.MeshBasicMaterial({ map: tex }), 0, 2.5, 0)];

  // dining set: table with 4 chairs
  const dining = (w = 1.6, d = 0.9, cm = M.darkWood) => [
    ...table(w, d, 0.75, M.wood, M.darkWood),
    ...[-1, 1].flatMap(sx => [-1, 1].flatMap(sz => (sz < 0 ? chair(cm) : turn(chair(cm))).map(p => {
      p.position.x += sx * w / 4 * S; p.position.z += sz * (d / 2 + 0.25) * S;
      return p;
    }))),
  ];

  // ---------- room-wide fixtures: ceiling lights + windows ----------
  for (let k = 0; k < 3; k++) {
    const yc = k * FLOOR_H + CEIL - 0.02;
    for (const x of [-5, 0.5, 6]) for (const z of [-9, -2.5, 4, 10]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), M.ceilingLight);
      p.rotation.x = Math.PI / 2;
      p.position.set(x, yc, z);
      group.add(p);
    }
  }
  // windows: [wall, along-wall position] — clear of doors, stairs and the elevator.
  // Windows a partition runs into, or that tall furniture stands in front of
  // (WINDOW_SKIP, keyed floor+wall+pos), are left out.
  const WINDOWS = [['N', -2.5], ['N', 5], ['S', -4.5], ['S', 7.5], ['E', -4.5], ['E', 6], ['W', -10], ['W', 9]];
  const WINDOW_SKIP = {
    hotel: ['2N-2.5', '2N5'],
    apartment: ['0N-2.5', '0N5', '0E6', '0S-4.5', '1E6', '2N5', '2E6'],
    shop: ['0N-2.5', '0N5', '0E-4.5', '0E6', '1E6', '2N-2.5', '2S-4.5', '2S7.5'],
    office: ['1S7.5'],
  }[type];
  const views = [0, 0.25, 0.5].map(off => {
    const m = M.view.clone();
    m.map = M.view.map.clone();
    m.map.needsUpdate = true;
    m.map.wrapS = THREE.RepeatWrapping;
    m.map.repeat.set(0.5, 1);
    m.map.offset.set(off, 0);
    return m;
  });
  const hitsPartition = (k, wall, pos, half) => (api.partitions[k] || []).some(([x0, z0, x1, z1]) => {
    if (wall === 'N' || wall === 'S') {
      const wz = wall === 'N' ? -13 : 13;
      return x0 === x1 && x0 > pos - half - 0.3 && x0 < pos + half + 0.3 && (z0 === wz || z1 === wz);
    }
    const wx = wall === 'E' ? 13 : -13;
    return z0 === z1 && z0 > pos - half - 0.3 && z0 < pos + half + 0.3 && (x0 === wx || x1 === wx);
  });
  for (let k = 0; k < 3; k++) {
    for (const [wall, pos] of WINDOWS) {
      const w = 2.6, h = 2.1, y = k * FLOOR_H + 1.3 + h / 2;
      if (WINDOW_SKIP.includes(`${k}${wall}${pos}`) || hitsPartition(k, wall, pos, w / 2)) continue;
      const win = new THREE.Group();
      win.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), pick(views)));
      const fr = (fw, fh, fx, fy) => { const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.12), M.windowFrame); b.position.set(fx, fy, 0.02); win.add(b); };
      fr(w + 0.24, 0.12, 0, h / 2 + 0.06); fr(w + 0.24, 0.16, 0, -h / 2 - 0.08);
      fr(0.12, h, -w / 2 - 0.06, 0); fr(0.12, h, w / 2 + 0.06, 0); fr(0.07, h, 0, 0);
      const inset = WALL - 0.015;
      if (wall === 'N') { win.position.set(pos, y, -inset); }
      if (wall === 'S') { win.position.set(pos, y, inset); win.rotation.y = Math.PI; }
      if (wall === 'E') { win.position.set(inset, y, pos); win.rotation.y = -Math.PI / 2; }
      if (wall === 'W') { win.position.set(-inset, y, pos); win.rotation.y = Math.PI / 2; }
      group.add(win);
    }
  }

  const label = api.label;
  // ---------- per-type layouts ----------
  if (type === 'hotel') {
    // Floor 1: lobby
    add(counter(4.5, 0.75, 1.1, M.darkWood, M.stone), 1.5, 0, -9.2);
    add([...register(), ...lamp(1.6, 1.1, 0)], 1.5, 0, -9.2, 0, { solid: false });
    add(signBoard(label('GRAND HOTEL', '#1b1408', '#e8c26a'), 3.2, 0.8), 1.3, 0, -12.8, ROT.N, { solid: false });
    add(bookshelf(2.2), 1.5, 0, N(0.45));
    add(rug(3.4, 2.8, M.sofaRed), -3, 0, 3.2, 0, { solid: false });
    add(sofa(2.1, M.sofaBlue), -3, 0, 0.9);
    add(sofa(2.1, M.sofaBlue), -3, 0, 5.5, ROT.S);
    add(coffeeTable(), -3, 0, 3.2);
    add(sofa(0.95, M.sofaRed), 5.2, 0, 3.2, ROT.W);
    add(sofa(0.95, M.sofaRed), 9.6, 0, 3.2, ROT.E);
    add(coffeeTable(0.6, 0.6), 7.4, 0, 3.2);
    add(floorLamp(), -6, 0, 3.2);
    for (const [x, z] of [[-5.6, -11.8], [7.3, -11.8], [11.7, 11.7], [-6.2, 11.7], [11.7, -3.8]]) add(plant(), x, 0, z);
    // Floor 2: guest rooms
    add(rug(10, 2.9, M.sofaRed), 0.8, 1, -0.5, 0, { solid: false });
    for (const [x, room] of [[-0.9, 'n'], [5.35, 'n'], [-4.4, 's'], [1.5, 's'], [8.7, 's']]) {
      const north = room === 'n';
      const z = north ? -10.6 : 10.6;
      const rot = north ? ROT.N : ROT.S;
      add(bed(1.6), x, 1, z, rot);
      const nz = north ? -12.25 : 12.25;
      add(nightstand(), x - 1.8, 1, nz, rot);
      add(nightstand(), x + 1.8, 1, nz, rot);
      if (north) add(tvUnit(), x + 1.5, 1, -4.45, ROT.S);
      else add(chair(M.sofaGrey), x + (x > 8 ? 2.5 : -2), 1, 5.5, ROT.N);
    }
    add(plant(), 11.7, 1, -3.6);
    add(plant(), -6.5, 1, -3.4);
    // Floor 3: lounge with a bar
    add(shelfUnit(4.5, 2.1, M.glassFront, M.darkWood), 1.5, 2, N(0.45));
    add(counter(4.6, 0.7, 1.1, M.darkWood, M.stone), 1.5, 2, -9.6);
    for (let i = 0; i < 5; i++) add(stool(), -1.5 + i * 1.5, 2, -8.1);
    add(rug(3.4, 2.8, M.sofaGreen), -3, 2, 4, 0, { solid: false });
    add(sofa(2.1, M.sofaGreen), -3, 2, 1.8);
    add(sofa(2.1, M.sofaGreen), -3, 2, 6.3, ROT.S);
    add(coffeeTable(), -3, 2, 4);
    add(sofa(0.95, M.leather), 4.5, 2, 6, ROT.W);
    add(sofa(0.95, M.leather), 8, 2, 6, ROT.E);
    add(coffeeTable(0.6, 0.6), 6.25, 2, 6);
    add(wallTV(), 1.5, 2, So(0.05), ROT.S, { solid: false });
    for (const [x, z] of [[11.7, -4], [11.7, 11.7], [-6, -11.7], [-6, 11.7]]) add(plant(), x, 2, z);
  }

  if (type === 'apartment') {
    // Floor 1: living room + kitchen
    add(kitchen(5), 1.2, 0, N(0.62));
    add(dining(), 2.2, 0, -7.9);
    add(tvUnit(), E(0.42), 0, 5, ROT.E);
    add(rug(3, 2.4, M.sofaGrey), 8.2, 0, 5, 0, { solid: false });
    add(sofa(2.1, M.sofaGrey), 5.3, 0, 5, ROT.W);
    add(coffeeTable(), 8.2, 0, 5, ROT.W);
    add(sofa(0.95, M.sofaBlue), 8.2, 0, 9.4, ROT.S);
    add(floorLamp(), 5.2, 0, 8);
    add(bookshelf(1.6), -4.5, 0, So(0.45), ROT.S);
    for (const [x, z] of [[-6.2, 11.7], [11.7, 11.7], [11.7, -3.6], [-3.4, -4]]) add(plant(), x, 0, z);
    // Floor 2: two bedrooms + bathroom
    add(bed(1.6), -2.2, 1, 10.55, ROT.S);
    add(nightstand(), -4.1, 1, 12.25, ROT.S);
    add(nightstand(), -0.3, 1, 12.25, ROT.S);
    add(wardrobe(), 2.45, 1, 6, ROT.E);
    add(rug(2.4, 1.6, M.sofaBlue), -2.2, 1, 7, 0, { solid: false });
    add(bed(0.95), 10.6, 1, 10.55, ROT.S);
    add(desk(M.sofaRed), 3.6, 1, 8.2, ROT.W);
    add(bookshelf(1.2), 12.3, 1, 5.5, ROT.E);
    add(rug(5, 5.7, M.tiles), -0.5, 1, -9, 0, { solid: false });
    add(bathtub(), -0.4, 1, N(0.8));
    add(toilet(), 2.4, 1, -7.4, ROT.E);
    add(basin(), -3.45, 1, -8.2, ROT.W);
    add(plant(false), 7.5, 1, -2);
    // Floor 3: laundry + storage
    for (const x of [-2.2, -1.25, -0.3]) add(washer(), x, 2, N(0.6));
    add(table(1.4, 0.7), 2.6, 2, -10.4);
    add(shelfUnit(2, 1.9, M.products), 6, 2, N(0.45));
    add(sofa(2.1, M.sofaGrey), -3, 2, 1.5);
    add(coffeeTable(), -3, 2, 4);
    for (const [x, z, n] of [[5.5, 11.6, 3], [6.8, 11.6, 2], [5.5, 10.4, 1], [11.6, 11.6, 2], [11.6, 10.4, 3]]) add(crateStack(n), x, 2, z);
    add(shelfUnit(2.2, 1.9, M.products), E(0.45), 2, 7, ROT.E);
  }

  if (type === 'shop') {
    // Floor 1: shop floor
    for (const x of [-5, -1.5, 2, 5.5]) add(islandShelf(4, 1.6), x, 0, -3.6, ROT.W);
    for (const z of [-2.2, 0.8, 3.8]) add(fridge(2), E(0.75), 0, z, ROT.E);
    add(shelfUnit(3), -1.5, 0, N(0.45));
    add(shelfUnit(3), 3, 0, N(0.45));
    add(counter(1.6, 0.7, 0.95, M.white, M.black), 4.4, 0, 7.2);
    add(register(), 4.4, 0, 7.2, 0, { solid: false });
    add(counter(1.6, 0.7, 0.95, M.white, M.black), 7.6, 0, 7.2);
    add(register(), 7.6, 0, 7.2, 0, { solid: false });
    for (const x of [-5.5, -4.3]) add([...crateStack(1), B(0.7, 0.1, 0.7, pick([M.sofaRed, M.leaves2, M.pot]), 0, 0.85, 0)], x, 0, 6.5);
    add(signBoard(label('FRESH MARKET', '#1a1a1a', '#ff6b9a'), 3.2, 0.8), 1, 0, -12.8, ROT.N, { solid: false });
    // Floor 2: stockroom
    for (const z of [-9.5, -4.5, 0.5]) add(islandShelf(4, 2.2, M.products), 0.8, 1, z);
    for (const [x, z, n] of [[6, 8, 3], [7.2, 8, 2], [6, 9.2, 2], [-5, 10.6, 3], [-3.8, 10.6, 1], [-5, 9.4, 2], [10.5, 4.5, 2], [11.6, 4.5, 3]]) add(crateStack(n), x, 1, z);
    // Floor 3: staff room
    add(lockers(4), -1, 2, N(0.5));
    add(dining(1.6, 0.9, M.black), -2, 2, -3);
    add(counter(2, 0.62, 0.92, M.white, M.stone), 2.45, 2, 0, ROT.E);
    add(sofa(2.1, M.sofaRed), -3, 2, 7.2);
    add(wallTV(), -3, 2, So(0.05), ROT.S, { solid: false });
    add(desk(), 7.5, 2, 8.5);
    add(bookshelf(1.6), 7.5, 2, So(0.45), ROT.S);
    add(plant(), 11.7, 2, 11.7);
  }

  if (type === 'office') {
    // Floor 1: reception + waiting area
    add(counter(4, 0.75, 1.1, M.white, M.wood), 2, 0, -7);
    add([...register(), ...lamp(1.4, 1.1, 0)], 2, 0, -7, 0, { solid: false });
    add(signBoard(label('NOVA CORP', '#0e1a2b', '#6bb7ff'), 3.2, 0.8), 2, 0, -12.8, ROT.N, { solid: false });
    add(rug(3, 2.6, M.sofaGrey), -2.6, 0, 3, 0, { solid: false });
    add(sofa(2.1, M.sofaBlue), -4.8, 0, 3, ROT.W);
    add(coffeeTable(), -2.4, 0, 3, ROT.W);
    add(sofa(0.95, M.sofaBlue), -0.3, 0, 3, ROT.E);
    add(waterCooler(), 7, 0, N(0.35));
    add(wallTV(), 3.5, 0, So(0.05), ROT.S, { solid: false });
    for (const [x, z] of [[-6.2, 11.7], [11.7, 11.7], [11.7, -3.8], [-5.8, -11.7]]) add(plant(), x, 0, z);
    // Floor 2: desks
    for (let i = 0; i < 7; i++) add(desk(pick(chairMats)), -5.4 + i * 2.1, 1, N(0.7));
    for (let i = 0; i < 5; i++) {
      // back-to-back pair: screens face each other, chairs on the outside
      add(desk(pick(chairMats)), -4.5 + i * 2.1, 1, -7.4, ROT.S);
      add(desk(pick(chairMats)), -4.5 + i * 2.1, 1, -5.6);
    }
    for (let i = 0; i < 4; i++) add(desk(pick(chairMats)), -5 + i * 2.1, 1, 5.6);
    add(desk(M.leather), 8.6, 1, 7.5);
    add(bookshelf(2), 8.6, 1, So(0.45), ROT.S);
    add(plant(), 12, 1, 12);
    add(plant(), 11.7, 1, -3.6);
    add(waterCooler(), 3.6, 1, -1.5);
    // Floor 3: meeting room + break area
    add(table(4.5, 1.4, 0.75, M.wood, M.steel), 1, 2, -8.6);
    for (const x of [-1.2, 0.4, 2, 3.6]) {
      add(chair(M.leather), x, 2, -10.5);
      add(chair(M.leather), x, 2, -6.7, ROT.S);
    }
    add(whiteboard(), 1, 2, N(0.05), ROT.N, { solid: false });
    add(rug(3.4, 2.8, M.sofaBlue), -2, 2, 6, 0, { solid: false });
    add(sofa(2.1, M.sofaGrey), -2, 2, 3.8);
    add(sofa(2.1, M.sofaGrey), -2, 2, 8.3, ROT.S);
    add(coffeeTable(), -2, 2, 6);
    add(pingPong(), 5.6, 2, 7, ROT.W);
    add(counter(2, 0.62, 0.92, M.white, M.stone), 9, 2, So(0.62), ROT.S);
    add(plant(), 11.7, 2, -4);
  }

  return { swings, uses, ceilingMat: M.ceilingLight, tvMat: M.tvScreen };
}
