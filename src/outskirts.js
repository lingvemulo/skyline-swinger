// Outside the city (Max: "like San Andreas"): countryside + farms to the NORTH (z > city),
// a beach + sea to the SOUTH (z < -city). Flat ground (y = 0) everywhere so the hero,
// cars and people all keep working; out here there's nothing to swing from — drive or run.
//
// createOutskirts(THREE, scene, opts) → {
//   carBlocked(x, z, m)   true if a car can't be at x,z (outside the world, water, barns, trees)
//   clampHero(pos)        keep the hero inside the world / out of deep sea
//   inWater(x, z)         wading in the sea?
//   mapShapes             [{x, z, w, d, color}] for the mini-map
//   parkedSpots           [{x, z, heading, kind}] cars to park out here
//   update(dt, t, heroPos)
// }

export const WORLD = { minX: -560, maxX: 560, minZ: -440, maxZ: 620 };
const SHORE_Z = -360;  // sand ends / sea starts
const SAND_Z = -262;   // city ground ends at -260

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function canvasTex(THREE, w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
function speckle(ctx, w, h, n, colors, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = pick(colors);
    ctx.fillRect(Math.random() * w, Math.random() * h, size * Math.random() + 0.5, size * Math.random() + 0.5);
  }
}

export function createOutskirts(THREE, scene, opts) {
  const { CITY_SIZE, addRoofBox, peopleReady, makeRealPerson, randomCivilian } = opts;
  const C = CITY_SIZE;
  const obstacles = []; // {x, z, hw, hd} boxes cars can't drive through
  const trees = [];     // {x, z, r}
  const mapShapes = [];
  const parkedSpots = [];
  const animated = [];  // things with update(dt, t, heroPos)

  // ---------- textures ----------
  const grassTex = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5f8f3e'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 4000, ['#6e9e48', '#557f37', '#78a852', '#4c7431', '#86b25c'], 2.5);
  }, [260, 260]);
  const sandTex = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8d3a2'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 5000, ['#f0dcae', '#dcc48f', '#f6e7c3', '#cfb683'], 1.6);
  }, [120, 12]);
  const roadTex = canvasTex(THREE, 64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4a5058'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 600, ['#555b63', '#41464d', '#5d636b'], 1.5);
    ctx.fillStyle = 'rgba(240,220,120,0.8)';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 2, y, 4, 36);
    ctx.fillStyle = 'rgba(240,240,240,0.7)';
    ctx.fillRect(3, 0, 3, h); ctx.fillRect(w - 6, 0, 3, h);
  });
  const dirtTex = canvasTex(THREE, 64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a6b47'; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1500, ['#9a7a52', '#7a5c3c', '#a3845c', '#6e5235'], 2);
    ctx.fillStyle = 'rgba(80,110,50,0.6)'; ctx.fillRect(w / 2 - 4, 0, 8, h); // grass strip between ruts
  });
  const woodTex = canvasTex(THREE, 256, 64, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = pick(['#a87b4f', '#9c7046', '#b38657', '#94683f']);
      ctx.fillRect(x, 0, 15, h);
    }
    ctx.fillStyle = 'rgba(40,25,10,0.5)';
    for (let x = 15; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
  });
  const waterTex = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2f86b8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = pick(['rgba(255,255,255,0.18)', 'rgba(140,210,240,0.35)', 'rgba(20,80,130,0.35)']);
      ctx.lineWidth = rand(1, 2.5);
      const x = rand(0, w), y = rand(0, h), l = rand(8, 26);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 3, x + l, y); ctx.stroke();
    }
  }, [90, 70]);
  const cropTex = (base, row) => canvasTex(THREE, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { ctx.fillStyle = row; ctx.fillRect(0, y, w, 4); }
    speckle(ctx, w, h, 300, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.1)'], 2);
  });

  // ---------- ground ----------
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.04;
  grass.receiveShadow = true;
  scene.add(grass);

  function flat(w, d, mat, x, y, z, rotY = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rotY;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // ---------- roads ----------
  function road(x0, z0, x1, z1, width, dirt) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const tex = (dirt ? dirtTex : roadTex).clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, len / (dirt ? 16 : 24));
    const m = flat(width, len, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), (x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    // the plane's length runs along its local y (→ world -z after the tilt): turn it to face the road direction
    m.rotation.z = Math.atan2(x1 - x0, z1 - z0) + Math.PI;
    mapShapes.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) || width, d: Math.abs(z1 - z0) || width, color: dirt ? '#8a6b47' : '#5b6270' });
  }
  road(0, C - 2, 0, 600, 12, false);        // highway north out of the city
  road(-380, 430, 380, 430, 8, true);       // farm track across the fields
  road(-140, 430, -140, 600, 7, true);      // up to the far farm
  road(150, 430, 150, 540, 7, true);
  road(0, -C + 2, 0, -290, 12, false);      // down to the beach car park

  // ---------- trees (instanced: cheap) ----------
  function inRect(x, z, cx, cz, hw, hd) { return Math.abs(x - cx) < hw && Math.abs(z - cz) < hd; }
  const keepClear = []; // {x, z, hw, hd}: farms, fields, roads
  keepClear.push({ x: 0, z: 430, hw: 9, hd: 200 }, { x: 0, z: 430, hw: 400, hd: 7 }, { x: -140, z: 515, hw: 7, hd: 90 }, { x: 150, z: 485, hw: 7, hd: 60 });

  // ---------- farms ----------
  const barnRed = new THREE.MeshStandardMaterial({ color: 0x9b2f24, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.8 });
  const roofDark = new THREE.MeshStandardMaterial({ color: 0x4a3a32, roughness: 0.9 });
  const roofGrey = new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.6, metalness: 0.3 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd9b75a, roughness: 1 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb8bfc6, roughness: 0.4, metalness: 0.6 });

  function solidBox(x, z, w, d, h, mat, rotY = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    m.rotation.y = rotY;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  function gableRoof(x, z, w, d, baseY, rise, mat) {
    // triangular prism along z
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - 0.4, 0); shape.lineTo(0, rise); shape.lineTo(w / 2 + 0.4, 0); shape.lineTo(-w / 2 - 0.4, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: d + 0.8, bevelEnabled: false });
    g.translate(0, 0, -(d + 0.8) / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, baseY, z);
    m.castShadow = true;
    scene.add(m);
    return m;
  }
  function building(x, z, w, d, h, wallMat, roofMat, rise) {
    solidBox(x, z, w, d, h, wallMat);
    gableRoof(x, z, w, d, h, rise, roofMat);
    addRoofBox(x, 0, z, w, h, d); // hero: solid walls, can stand on top
    obstacles.push({ x, z, hw: w / 2, hd: d / 2 });
    mapShapes.push({ x, z, w, d, color: '#b9775a' });
  }
  function barn(x, z) {
    building(x, z, 14, 18, 8, barnRed, roofGrey, 5);
    // white trim + big doors on the front (+z) face
    const door = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0x6e231b, roughness: 0.9 }));
    door.position.set(x, 3, z + 9.02); scene.add(door);
    for (const dx of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 8.4), white);
      bar.position.set(x + dx * 1.5, 3, z + 9.04); bar.rotation.z = dx * 0.78; scene.add(bar);
    }
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.4), white);
    trim.position.set(x, 6.1, z + 9.04); scene.add(trim);
  }
  function farmhouse(x, z) {
    building(x, z, 10, 8, 5.5, white, roofDark, 3.2);
    const doorM = new THREE.MeshStandardMaterial({ color: 0x3b5d8a });
    const winM = new THREE.MeshStandardMaterial({ color: 0x9cc6e6, roughness: 0.2, metalness: 0.3 });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), doorM);
    door.position.set(x, 1.2, z + 4.02); scene.add(door);
    for (const dx of [-3, 3]) for (const y of [1.6, 4.1]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), winM);
      win.position.set(x + dx, y, z + 4.02); scene.add(win);
    }
    // porch
    const porch = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.25, 2.5), woodMat);
    porch.position.set(x, 0.12, z + 5.2); scene.add(porch);
  }
  function silo(x, z) {
    const r = 2.8, h = 15;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), silver);
    body.position.set(x, h / 2, z); body.castShadow = true; scene.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), silver);
    dome.position.set(x, h, z); scene.add(dome);
    for (let y = 2; y < h; y += 2.5) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.06, 4, 24), roofGrey);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z); scene.add(ring);
    }
    addRoofBox(x, 0, z, r * 1.6, h, r * 1.6);
    obstacles.push({ x, z, hw: r, hd: r });
    mapShapes.push({ x, z, w: r * 2, d: r * 2, color: '#c9cfd6' });
  }
  const postGeo = new THREE.BoxGeometry(0.2, 1.3, 0.2);
  function fence(x, z, w, d, gateSide) {
    const posts = [];
    const rails = [];
    const add = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3));
      for (let i = 0; i <= n; i++) posts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]);
      for (const y of [0.55, 1.05]) rails.push({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, len, rot: Math.atan2(x1 - x0, z1 - z0) });
    };
    const hw = w / 2, hd = d / 2;
    add(x - hw, z - hd, x + hw, z - hd);
    add(x - hw, z - hd, x - hw, z + hd);
    add(x + hw, z - hd, x + hw, z + hd);
    // front side (+z) with a gap for the gate
    if (gateSide) { add(x - hw, z + hd, x - 4, z + hd); add(x + 4, z + hd, x + hw, z + hd); } else add(x - hw, z + hd, x + hw, z + hd);
    const inst = new THREE.InstancedMesh(postGeo, woodMat, posts.length);
    const M = new THREE.Matrix4();
    posts.forEach(([px, pz], i) => { M.makeTranslation(px, 0.65, pz); inst.setMatrixAt(i, M); });
    scene.add(inst);
    for (const r of rails) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, r.len), woodMat);
      m.position.set(r.x, r.y, r.z); m.rotation.y = r.rot; scene.add(m);
    }
  }
  function field(x, z, w, d, kind) {
    const tex = kind === 'wheat' ? cropTex('#d9b95c', '#c4a046') : kind === 'veg' ? cropTex('#6a4a2e', '#4f8f3a') : cropTex('#7a5634', '#5e4027');
    tex.repeat.set(w / 8, d / 8);
    flat(w, d, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), x, 0.008, z);
    if (kind === 'wheat') {
      // a bit of height: rows of low golden "stalk" boxes
      const g = new THREE.BoxGeometry(w - 1, 0.6, 0.5);
      for (let zz = z - d / 2 + 1; zz < z + d / 2 - 1; zz += 2) {
        const m = new THREE.Mesh(g, hayMat); m.position.set(x, 0.3, zz); scene.add(m);
      }
    }
    mapShapes.push({ x, z, w, d, color: kind === 'wheat' ? '#c9ad55' : kind === 'veg' ? '#4f7f38' : '#7a5634' });
    keepClear.push({ x, z, hw: w / 2 + 2, hd: d / 2 + 2 });
  }
  function hay(x, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 14), hayMat);
    m.rotation.z = Math.PI / 2; m.position.set(x, 1, z); m.castShadow = true; scene.add(m);
    obstacles.push({ x, z, hw: 0.8, hd: 1 });
  }

  // animals: simple shapes that wander inside a pen
  const cowWhite = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.9 });
  const cowBlack = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.9 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe8a6a0, roughness: 0.8 });
  const wool = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 1 });
  const legGeo = new THREE.BoxGeometry(0.22, 0.9, 0.22);
  function makeCow() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 2.1), cowWhite); body.position.y = 1.25; body.castShadow = true; g.add(body);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.12, rand(0.4, 0.7), rand(0.4, 0.8)), cowBlack); s.position.set(0, 1.25 + rand(-0.2, 0.2), rand(-0.7, 0.7)); g.add(s); }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.7), cowWhite); head.position.set(0, 1.55, 1.25); g.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.2), pink); nose.position.set(0, 1.4, 1.62); g.add(nose);
    const legs = [];
    for (const [lx, lz] of [[-0.35, 0.7], [0.35, 0.7], [-0.35, -0.7], [0.35, -0.7]]) { const l = new THREE.Mesh(legGeo, cowBlack); l.position.set(lx, 0.45, lz); g.add(l); legs.push(l); }
    return { g, head, legs, moo: true };
  }
  function makeSheep() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), wool); body.scale.set(1, 0.85, 1.3); body.position.y = 0.9; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.45), cowBlack); head.position.set(0, 1.05, 0.75); g.add(head);
    const legs = [];
    for (const [lx, lz] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), cowBlack); l.position.set(lx, 0.3, lz); g.add(l); legs.push(l); }
    return { g, head, legs };
  }
  function herd(make, n, cx, cz, hw, hd) {
    for (let i = 0; i < n; i++) {
      const a = make();
      a.g.position.set(cx + rand(-hw, hw), 0, cz + rand(-hd, hd));
      a.g.rotation.y = rand(0, Math.PI * 2);
      scene.add(a.g);
      const st = { target: a.g.position.clone(), wait: rand(0, 5), phase: rand(0, 6) };
      animated.push((dt, t, hp) => {
        if (Math.abs(a.g.position.x - hp.x) > 220 || Math.abs(a.g.position.z - hp.z) > 220) return; // far away: don't bother
        st.wait -= dt;
        const dx = st.target.x - a.g.position.x, dz = st.target.z - a.g.position.z, dist = Math.hypot(dx, dz);
        if (dist < 0.3) {
          a.head.rotation.x = 0.5 + Math.sin(t * 2 + st.phase) * 0.15; // grazing
          if (st.wait <= 0) { st.target.set(cx + rand(-hw, hw), 0, cz + rand(-hd, hd)); st.wait = rand(4, 12); }
          for (const l of a.legs) l.rotation.x *= 0.9;
        } else {
          a.head.rotation.x = 0;
          const sp = 0.9 * dt;
          a.g.position.x += dx / dist * sp; a.g.position.z += dz / dist * sp;
          a.g.rotation.y = Math.atan2(dx, dz);
          const sw = Math.sin(t * 6 + st.phase) * 0.4;
          a.legs.forEach((l, i) => { l.rotation.x = i % 3 === 0 ? sw : -sw; });
        }
      });
    }
  }

  function farm(x, z, opts2) {
    farmhouse(x - 18, z - 4);
    barn(x + 10, z - 6);
    silo(x + 22, z - 10);
    for (let i = 0; i < 5; i++) hay(x + rand(-4, 18), z + rand(8, 14));
    keepClear.push({ x: x + 2, z: z - 4, hw: 32, hd: 16 });
    // pen with animals, and crop fields beside it
    const penX = x + (opts2.penSide || 1) * 40, penZ = z;
    fence(penX, penZ, 34, 26, true);
    keepClear.push({ x: penX, z: penZ, hw: 19, hd: 15 });
    mapShapes.push({ x: penX, z: penZ, w: 34, d: 26, color: '#6e9e48' });
    if (opts2.animal === 'sheep') herd(makeSheep, 8, penX, penZ, 14, 10);
    else herd(makeCow, 6, penX, penZ, 14, 10);
    field(x - (opts2.penSide || 1) * 45, z + 4, 40, 50, opts2.crop || 'wheat');
    field(x - (opts2.penSide || 1) * 45, z + 64, 40, 50, opts2.crop2 || 'veg');
    parkedSpots.push({ x: x - 2, z: z + 14, heading: Math.PI / 2, kind: 'tractor' });
    parkedSpots.push({ x: x - 26, z: z + 8, heading: 0, kind: null });
  }
  farm(-150, 360, { penSide: 1, animal: 'cow', crop: 'wheat', crop2: 'veg' });
  farm(160, 500, { penSide: -1, animal: 'sheep', crop: 'veg', crop2: 'plough' });
  farm(-250, 540, { penSide: 1, animal: 'cow', crop: 'plough', crop2: 'wheat' });
  // a windmill-style wind turbine on the hill line (looks nice from the highway)
  const turbines = [];
  for (const [tx, tz] of [[260, 590], [330, 600], [400, 585]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, 40, 10), white);
    pole.position.set(tx, 20, tz); scene.add(pole);
    const hub = new THREE.Group(); hub.position.set(tx, 40, tz + 1.2); scene.add(hub);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.2, 16, 0.3), white);
      blade.position.y = 8; const arm = new THREE.Group(); arm.rotation.z = i * Math.PI * 2 / 3; arm.add(blade); hub.add(arm);
    }
    turbines.push(hub);
    obstacles.push({ x: tx, z: tz, hw: 1.2, hd: 1.2 });
  }
  animated.push((dt) => { for (const h of turbines) h.rotation.z += dt * 0.8; });

  // trees: countryside (north) and the strips east/west of the city
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 3, 7);
  const leafGeo = new THREE.IcosahedronGeometry(2.4, 0);
  const pineGeo = new THREE.ConeGeometry(2.2, 6, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.9, flatShading: true });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x2c5e33, roughness: 0.9, flatShading: true });
  const treeSpots = [];
  for (let i = 0; i < 900 && treeSpots.length < 320; i++) {
    const x = rand(WORLD.minX + 6, WORLD.maxX - 6), z = rand(-C + 10, WORLD.maxZ - 6);
    if (Math.abs(x) < C + 8 && Math.abs(z) < C + 8) continue;          // the city
    if (z < SAND_Z + 10) continue;
    if (keepClear.some(k => inRect(x, z, k.x, k.z, k.hw + 3, k.hd + 3))) continue;
    if (Math.abs(x) < 12 && z > C) continue;                            // highway
    if (treeSpots.some(s => Math.hypot(s.x - x, s.z - z) < 6)) continue;
    treeSpots.push({ x, z, pine: Math.random() < 0.4, s: rand(0.8, 1.5) });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.filter(t => !t.pine).length);
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, treeSpots.filter(t => t.pine).length);
  trunks.castShadow = leaves.castShadow = pines.castShadow = true;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  let li = 0, pi = 0;
  treeSpots.forEach((t, i) => {
    Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6));
    S.set(t.s, t.s, t.s);
    M.compose(P.set(t.x, 1.5 * t.s, t.z), Q, S); trunks.setMatrixAt(i, M);
    if (t.pine) { M.compose(P.set(t.x, (3 + 3) * t.s, t.z), Q, S); pines.setMatrixAt(pi++, M); }
    else { M.compose(P.set(t.x, 4.6 * t.s, t.z), Q, S); leaves.setMatrixAt(li++, M); }
    trees.push({ x: t.x, z: t.z, r: 0.6 * t.s });
  });
  scene.add(trunks, leaves, pines);

  // ---------- BEACH (south) ----------
  const sand = flat(WORLD.maxX - WORLD.minX + 400, SAND_Z - SHORE_Z, new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }), 0, 0.006, (SAND_Z + SHORE_Z) / 2 - 1);
  mapShapes.push({ x: 0, z: (SAND_Z + SHORE_Z) / 2, w: 1400, d: SAND_Z - SHORE_Z, color: '#e2cb93' });
  // wet sand by the water
  flat(1520, 6, new THREE.MeshStandardMaterial({ color: 0xd9c08c, roughness: 0.5, transparent: true, opacity: 0.7 }), 0, 0.01, SHORE_Z + 2);
  // the sea
  const seaMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0xbfe6ff, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.9 });
  const sea = flat(3000, 1400, seaMat, 0, 0.32, SHORE_Z - 700);
  mapShapes.push({ x: 0, z: SHORE_Z - 300, w: 3000, d: 600, color: '#2f86b8' });
  // foam line that washes in and out
  const foam = flat(1520, 2.2, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }), 0, 0.34, SHORE_Z + 0.5);
  animated.push((dt, t) => {
    waterTex.offset.x = t * 0.004; waterTex.offset.y = t * 0.006;
    const w = Math.sin(t * 0.9);
    foam.position.z = SHORE_Z + 0.8 + w * 1.6;
    foam.material.opacity = 0.35 + 0.3 * (w * 0.5 + 0.5);
  });
  // boardwalk along the top of the beach
  const wt = woodTex.clone(); wt.needsUpdate = true; wt.repeat.set(1, 120);
  const boardwalk = flat(8, 700, new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9 }), 0, 0.05, -268);
  boardwalk.rotation.z = Math.PI / 2;
  // pier out over the water (walkable: the hero can stand on the deck)
  const PIER_X = 120, PIER_Z0 = -300, PIER_Z1 = -480, PIER_Y = 1.4; // low enough to step straight up onto
  const pt = woodTex.clone(); pt.needsUpdate = true; pt.repeat.set(1, 30);
  const deckLen = PIER_Z0 - PIER_Z1;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, deckLen), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9 }));
  deck.position.set(PIER_X, PIER_Y - 0.15, (PIER_Z0 + PIER_Z1) / 2); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
  addRoofBox(PIER_X, 0, (PIER_Z0 + PIER_Z1) / 2, 7, PIER_Y, deckLen);
  const pileGeo = new THREE.CylinderGeometry(0.25, 0.25, PIER_Y + 1, 6);
  for (let z = PIER_Z0 - 2; z > PIER_Z1; z -= 8) for (const dx of [-3.2, 3.2]) {
    const p = new THREE.Mesh(pileGeo, woodMat); p.position.set(PIER_X + dx, (PIER_Y - 1) / 2, z); scene.add(p);
  }
  for (const dx of [-3.4, 3.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, deckLen), woodMat);
    rail.position.set(PIER_X + dx, PIER_Y + 1, (PIER_Z0 + PIER_Z1) / 2); scene.add(rail);
  }
  mapShapes.push({ x: PIER_X, z: (PIER_Z0 + PIER_Z1) / 2, w: 7, d: deckLen, color: '#a87b4f' });
  obstacles.push({ x: PIER_X, z: (PIER_Z0 + SHORE_Z) / 2, hw: 3.6, hd: (PIER_Z0 - SHORE_Z) / 2 });
  // lifeguard tower
  function lifeguard(x, z) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), white); l.position.set(x + dx * 1.2, 1.5, z + dz * 1.2); scene.add(l);
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0xe8483a, roughness: 0.7 }));
    hut.position.set(x, 4, z); hut.castShadow = true; scene.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 4), white); roof.rotation.y = Math.PI / 4; roof.position.set(x, 5.6, z); scene.add(roof);
    addRoofBox(x, 3, z, 3, 2, 3);
    obstacles.push({ x, z, hw: 1.6, hd: 1.6 });
  }
  lifeguard(-60, -330); lifeguard(220, -335);
  // palm trees along the boardwalk
  const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 });
  const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x3d8a3a, roughness: 0.8, side: THREE.DoubleSide });
  const frondGeo = new THREE.PlaneGeometry(1.2, 5);
  frondGeo.translate(0, 2.5, 0);
  for (let x = -340; x <= 340; x += 26) {
    if (Math.abs(x) < 14) continue;
    const g = new THREE.Group();
    const bend = rand(-0.15, 0.15);
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.28 - i * 0.03, 0.34 - i * 0.03, 2.2, 7), palmTrunk);
      seg.position.set(bend * i * i * 0.6, 1.1 + i * 2.1, 0); seg.rotation.z = -bend * i * 0.5; g.add(seg);
    }
    const top = new THREE.Vector3(bend * 16 * 0.6, 10.5, 0);
    for (let i = 0; i < 8; i++) {
      const f = new THREE.Mesh(frondGeo, palmLeaf);
      f.position.copy(top);
      f.rotation.set(0, (i / 8) * Math.PI * 2, 0);
      f.rotateX(1.2 + rand(-0.15, 0.15));
      g.add(f);
    }
    g.position.set(x, 0, -275);
    scene.add(g);
    obstacles.push({ x, z: -275, hw: 0.5, hd: 0.5 });
  }
  // umbrellas + towels
  const towelCols = [0xe84a5f, 0x2a9d8f, 0xf4a261, 0x457b9d, 0xffd166, 0x9b5de5];
  const umbrellaSpots = [];
  for (let i = 0; i < 26; i++) {
    const x = rand(-320, 320), z = rand(-345, -290);
    if (Math.abs(x - PIER_X) < 8 || Math.abs(x) < 10) continue;
    const col = pick(towelCols);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), white); pole.position.set(x, 1.3, z); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 12, 1, true), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, side: THREE.DoubleSide }));
    top.position.set(x, 2.6, z); top.castShadow = true; scene.add(top);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 2), new THREE.MeshStandardMaterial({ color: pick(towelCols) }));
    towel.position.set(x + 1, 0.03, z + 0.4); towel.rotation.y = rand(-0.3, 0.3); scene.add(towel);
    umbrellaSpots.push({ x, z });
  }
  // beach car park
  flat(44, 22, new THREE.MeshStandardMaterial({ color: 0x4f555d, roughness: 0.95 }), -30, 0.014, -282);
  mapShapes.push({ x: -30, z: -282, w: 44, d: 22, color: '#5b6270' });
  for (let i = 0; i < 4; i++) parkedSpots.push({ x: -46 + i * 8, z: -282, heading: 0, kind: null });

  // ---------- beach people in swimsuits (made when the realistic people have loaded) ----------
  const SUIT_COLS = ['#e63946', '#1d3557', '#2a9d8f', '#f4a261', '#7b2cbf', '#ff6f91', '#0077b6', '#ffb703'];
  function swimSpec() {
    const sp = randomCivilian();
    const col = pick(SUIT_COLS);
    sp.outfit = sp.sex === 'female'
      ? { mode: 'clothes', top: col, sleeve: 'skin', legs: col, shoes: 'skin', shorts: true }   // one-piece swimsuit
      : { mode: 'clothes', top: 'skin', sleeve: 'skin', legs: col, shoes: 'skin', shorts: true }; // swim shorts
    return sp;
  }
  const beachPeople = [];
  const SWIM_Y = 0.3; // Swim_Fwd_Loop lies flat: head and shoulders just above the water
  let peopleMade = false;
  function makeBeachPeople() {
    peopleMade = true;
    const add = (mode, x, z) => {
      const p = makeRealPerson(swimSpec());
      if (!p) return;
      p.group.position.set(x, 0, z);
      scene.add(p.group);
      beachPeople.push({ p, mode, home: new THREE.Vector3(x, 0, z), target: new THREE.Vector3(x, 0, z), wait: rand(0, 4), ang: rand(0, 6), r: rand(6, 14), sp: rand(0.25, 0.45), clip: pick(['Idle_Loop', 'Idle_Talking_Loop']) });
    };
    for (let i = 0; i < 9; i++) add('swim', rand(-260, 260), rand(SHORE_Z - 45, SHORE_Z - 18));
    for (let i = 0; i < 6; i++) add('walk', rand(-260, 260), rand(-350, -300));
    for (const u of umbrellaSpots.slice(0, 7)) add('stand', u.x + 1.6, u.z - 1);
  }
  animated.push((dt, t, hp) => {
    if (!peopleMade && peopleReady()) makeBeachPeople();
    for (const b of beachPeople) {
      const g = b.p.group;
      const near = Math.abs(g.position.x - hp.x) < 160 && Math.abs(g.position.z - hp.z) < 160;
      g.visible = near;
      if (!near) continue;
      if (b.mode === 'swim') {
        // lazy circles out in the water, head above the surface
        b.ang += dt * b.sp / b.r * 3;
        const nx = b.home.x + Math.cos(b.ang) * b.r, nz = b.home.z + Math.sin(b.ang) * b.r;
        g.rotation.y = Math.atan2(nx - g.position.x, nz - g.position.z);
        g.position.set(nx, SWIM_Y + Math.sin(t * 2 + b.r) * 0.05, nz);
        b.p.play('Swim_Fwd_Loop', { speed: 0.8 });
      } else if (b.mode === 'walk') {
        const dx = b.target.x - g.position.x, dz = b.target.z - g.position.z, d = Math.hypot(dx, dz);
        if (d < 0.4) {
          b.wait -= dt;
          b.p.play('Idle_Loop');
          if (b.wait <= 0) { b.target.set(b.home.x + rand(-30, 30), 0, rand(-352, -292)); b.wait = rand(2, 6); }
        } else {
          g.position.x += dx / d * 1.2 * dt; g.position.z += dz / d * 1.2 * dt;
          g.rotation.y = Math.atan2(dx, dz);
          b.p.play('Walk_Loop');
        }
      } else {
        b.p.play(b.clip);
      }
      b.p.update(dt);
    }
  });

  // ---------- queries ----------
  function carBlocked(x, z, m) {
    if (x < WORLD.minX + m || x > WORLD.maxX - m || z > WORLD.maxZ - m) return true;
    if (z < SHORE_Z + 1 + m) return true; // no driving into the sea
    for (const o of obstacles) if (Math.abs(x - o.x) < o.hw + m && Math.abs(z - o.z) < o.hd + m) return true;
    for (const t of trees) if (Math.abs(x - t.x) < t.r + m && Math.abs(z - t.z) < t.r + m) return true;
    return false;
  }
  function clampHero(pos) {
    pos.x = Math.max(WORLD.minX + 2, Math.min(WORLD.maxX - 2, pos.x));
    pos.z = Math.max(WORLD.minZ + 2, Math.min(WORLD.maxZ - 2, pos.z));
  }
  function inWater(x, z) { return z < SHORE_Z && !(Math.abs(x - PIER_X) < 3.5 && z > PIER_Z1); }
  function update(dt, t, heroPos) { for (const f of animated) f(dt, t, heroPos); }

  return { carBlocked, clampHero, inWater, mapShapes, parkedSpots, update, SHORE_Z, PIER_X, PIER_Y };
}
