// The hero: a human-proportioned body (~2.5 units tall) with swappable
// outfits and a removable mask. Joint groups (shoulders, elbows, hips, knees)
// are what App.jsx animates. The model's feet sit 1.5 below the root, which
// matches the physics convention that hero.position is 1.5 above the feet.

export const OUTFITS = [
  { id: 'classic', name: 'Classic suit', kind: 'suit', unlock: null },
  { id: 'hoodie', name: 'Hoodie + jeans', kind: 'street', unlock: null },
  { id: 'jacket', name: 'T-shirt + jacket', kind: 'street', unlock: null },
  { id: 'midnight', name: 'Midnight suit', kind: 'suit', unlock: { type: 'voltbots', n: 10, text: 'Defeat 10 Voltbots' } },
  { id: 'gold', name: 'Gold suit', kind: 'suit', unlock: { type: 'orbs', n: 40, text: 'Collect 40 orbs' } },
  { id: 'brute', name: 'Brute Buster suit', kind: 'suit', unlock: { type: 'boss', boss: 'brute', text: 'Beat the Rage Brute' } },
  { id: 'titan', name: 'Titan Breaker suit', kind: 'suit', unlock: { type: 'boss', boss: 'titan', text: 'Beat the Stone Titan' } },
];

// colours: main (chest/arms), second (legs/sides), accent (pattern + emblem)
const SUIT_COLOURS = {
  classic: { main: '#c8202f', second: '#1d3f8f', accent: '#0d0d12', emblem: '#f2f2f2', mask: '#c8202f', lens: '#eef6ff', metal: 0.1 },
  midnight: { main: '#17181d', second: '#24262e', accent: '#9aa3b2', emblem: '#d9dee7', mask: '#17181d', lens: '#cfe8ff', metal: 0.3 },
  gold: { main: '#d9a826', second: '#f2f0e6', accent: '#8a6510', emblem: '#fff8d6', mask: '#d9a826', lens: '#1b1b1b', metal: 0.75 },
  brute: { main: '#5b4b7a', second: '#2c2638', accent: '#ff8a1f', emblem: '#ff8a1f', mask: '#5b4b7a', lens: '#ffd27a', metal: 0.2 },
  titan: { main: '#5d5a55', second: '#33302d', accent: '#ff5a14', emblem: '#ffb347', mask: '#5d5a55', lens: '#ffcf8a', metal: 0.1 },
};
const SKIN = 0xd9a07a;
const HAIR = 0x3a2614;

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// Hexagon-cell suit pattern (our own look), optional chest emblem in the middle.
function suitTex(THREE, base, accent, emblem) {
  return canvasTex(THREE, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
    const r = 14, dx = r * Math.sqrt(3), dy = r * 1.5;
    for (let row = -1; row < h / dy + 1; row++) {
      for (let col = -1; col < w / dx + 1; col++) {
        const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + i * Math.PI / 3;
          ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (emblem) {
      // a swooping arrow-star emblem at the front centre (u = 0.5)
      ctx.save();
      ctx.translate(w / 2, h * 0.42);
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = emblem;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 13 : 32;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  });
}
function denimTex(THREE, base) {
  return canvasTex(THREE, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
  });
}

export function buildHero(THREE) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const SC = 1.1; // model built ~2.28 tall, scaled to ~2.5
  body.scale.setScalar(SC);
  body.position.y = -1.5;
  root.add(body);

  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.55, ...o });
  // one material per body "role"; outfits just recolour/retexture these
  const mats = {
    torso: std({}), pelvis: std({}), upperArm: std({}), forearm: std({}), hand: std({}),
    upperLeg: std({}), lowerLeg: std({}), shoe: std({}), neck: std({}), head: std({}),
    hair: std({ color: HAIR, roughness: 0.9 }), lens: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    eye: std({ color: 0x1a1410, roughness: 0.3 }), brow: std({ color: HAIR, roughness: 0.9 }),
    hood: std({}), jacket: std({}),
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const limb = (rTop, rBot, len, mat, parent) => mesh(new THREE.CylinderGeometry(rTop, rBot, len, 12), mat, 0, -len / 2, 0, parent);
  const joint = (x, y, z, parent = body) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // torso: chest tapers to the waist; front of the texture faces +z
  const torsoGeo = new THREE.CylinderGeometry(0.25, 0.19, 0.62, 20, 1, false, Math.PI);
  const torso = mesh(torsoGeo, mats.torso, 0, 1.55, 0);
  torso.scale.z = 0.62;
  const chest = mesh(new THREE.SphereGeometry(0.25, 20, 12), mats.torso, 0, 1.8, 0);
  chest.scale.set(1, 0.42, 0.62);
  mesh(new THREE.BoxGeometry(0.4, 0.2, 0.25), mats.pelvis, 0, 1.17, 0);
  mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.12, 12), mats.neck, 0, 1.92, 0);

  // head with a face (shown when the mask is off) and a mask shell + lenses
  const headGrp = joint(0, 2.08, 0);
  const head = mesh(new THREE.SphereGeometry(0.155, 24, 18), mats.head, 0, 0, 0, headGrp);
  head.scale.set(0.95, 1.12, 1.0);
  const hair = mesh(new THREE.SphereGeometry(0.163, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hair, 0, 0.025, -0.012, headGrp);
  hair.scale.set(0.98, 1.08, 1.04);
  const face = [];
  for (const sx of [-1, 1]) {
    face.push(mesh(new THREE.SphereGeometry(0.02, 10, 8), mats.eye, sx * 0.055, 0.02, 0.138, headGrp));
    const brow = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), mats.brow, sx * 0.055, 0.065, 0.14, headGrp);
    face.push(brow);
    face.push(mesh(new THREE.SphereGeometry(0.03, 10, 8), mats.head, sx * 0.15, 0, 0, headGrp)); // ears
  }
  face.push(mesh(new THREE.SphereGeometry(0.022, 10, 8), mats.head, 0, -0.02, 0.155, headGrp)); // nose
  const lenses = [];
  for (const sx of [-1, 1]) {
    const lens = mesh(new THREE.SphereGeometry(0.05, 16, 10), mats.lens, sx * 0.06, 0.03, 0.125, headGrp);
    lens.scale.set(1, 0.7, 0.35);
    lens.rotation.z = sx * 0.35;
    lenses.push(lens);
  }
  // hood bunched behind the neck (hoodie only)
  const hood = mesh(new THREE.TorusGeometry(0.13, 0.06, 8, 16, Math.PI * 1.2), mats.hood, 0, 1.92, -0.05);
  hood.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI * 0.4);
  // open jacket panels over the torso (jacket only)
  const jacketParts = [-1, 1].map(sx => {
    const p = mesh(new THREE.BoxGeometry(0.17, 0.66, 0.34), mats.jacket, sx * 0.15, 1.56, -0.005);
    return p;
  });

  // arms: shoulder → elbow → hand. Rotations on these groups animate the arm.
  const shoulderL = joint(-0.3, 1.82, 0);
  const shoulderR = joint(0.3, 1.82, 0);
  const elbows = [];
  for (const sh of [shoulderL, shoulderR]) {
    mesh(new THREE.SphereGeometry(0.085, 12, 10), mats.upperArm, 0, 0, 0, sh);
    limb(0.075, 0.065, 0.42, mats.upperArm, sh);
    const elbow = joint(0, -0.42, 0, sh);
    limb(0.063, 0.052, 0.38, mats.forearm, elbow);
    const hand = mesh(new THREE.SphereGeometry(0.068, 12, 10), mats.hand, 0, -0.43, 0.01, elbow);
    hand.scale.set(0.8, 1.1, 0.6);
    elbows.push(elbow);
  }
  // legs: hip → knee → shoe
  const hipL = joint(-0.11, 1.15, 0);
  const hipR = joint(0.11, 1.15, 0);
  const knees = [];
  for (const hp of [hipL, hipR]) {
    limb(0.11, 0.085, 0.58, mats.upperLeg, hp);
    const knee = joint(0, -0.58, 0, hp);
    limb(0.08, 0.06, 0.5, mats.lowerLeg, knee);
    mesh(new THREE.BoxGeometry(0.13, 0.08, 0.28), mats.shoe, 0, -0.53, 0.05, knee);
    knees.push(knee);
  }

  function setMat(m, colour, map = null, extra = {}) {
    m.color.set(colour);
    m.map = map;
    m.metalness = extra.metalness ?? 0.05;
    m.roughness = extra.roughness ?? 0.55;
    m.needsUpdate = true;
  }

  function applyOutfit(id, maskOn) {
    const o = OUTFITS.find(x => x.id === id) || OUTFITS[0];
    const isSuit = o.kind === 'suit';
    const showMask = isSuit && maskOn;
    hood.visible = id === 'hoodie';
    jacketParts.forEach(p => { p.visible = id === 'jacket'; });
    lenses.forEach(l => { l.visible = showMask; });
    face.forEach(f => { f.visible = !showMask; });
    hair.visible = !showMask;
    if (isSuit) {
      const c = SUIT_COLOURS[id];
      const ex = { metalness: c.metal, roughness: c.metal > 0.5 ? 0.3 : 0.5 };
      const mainTex = suitTex(THREE, c.main, c.accent, null);
      setMat(mats.torso, '#ffffff', suitTex(THREE, c.main, c.accent, c.emblem), ex);
      setMat(mats.pelvis, c.second, null, ex);
      setMat(mats.upperArm, '#ffffff', mainTex, ex);
      setMat(mats.forearm, '#ffffff', mainTex, ex);
      setMat(mats.hand, c.second, null, ex);
      setMat(mats.upperLeg, c.second, null, ex);
      setMat(mats.lowerLeg, c.second, null, ex);
      setMat(mats.shoe, c.main, null, ex);
      setMat(mats.neck, showMask ? c.mask : SKIN);
      setMat(mats.head, showMask ? c.mask : SKIN, showMask ? mainTex : null, showMask ? ex : {});
      mats.lens.color.set(c.lens);
    } else {
      const jeans = denimTex(THREE, id === 'hoodie' ? '#3f5f8f' : '#2b3446');
      const top = id === 'hoodie' ? '#8d939b' : '#f2f2f2';
      setMat(mats.torso, top, null, { roughness: 0.9 });
      setMat(mats.pelvis, '#ffffff', jeans, { roughness: 0.9 });
      setMat(mats.upperArm, id === 'hoodie' ? top : '#3d5a3d', null, { roughness: 0.9 });
      setMat(mats.forearm, id === 'hoodie' ? top : '#3d5a3d', null, { roughness: 0.9 });
      setMat(mats.hand, SKIN);
      setMat(mats.upperLeg, '#ffffff', jeans, { roughness: 0.9 });
      setMat(mats.lowerLeg, '#ffffff', jeans, { roughness: 0.9 });
      setMat(mats.shoe, '#f4f4f4');
      setMat(mats.neck, SKIN);
      setMat(mats.head, SKIN);
      setMat(mats.hood, top, null, { roughness: 0.9 });
      setMat(mats.jacket, '#3d5a3d', null, { roughness: 0.8 });
    }
  }
  applyOutfit('classic', true);

  return { root, shoulderL, shoulderR, hipL, hipR, elbows, knees, headGrp, applyOutfit };
}
