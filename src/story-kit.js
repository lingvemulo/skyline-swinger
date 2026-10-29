import { peopleReady, makeRealPerson, randomCivilian } from './people.js';

// Shared pieces for story mode: small math helpers, models (civilian, Shadow
// Ninja, getaway car) and canvas textures. Used by story.js and story2.js.

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const ease = (u) => u * u * (3 - 2 * u);
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ---------- models ----------
export function std(THREE, color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }); }
export function joint(THREE, parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
export function part(THREE, parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// civilian, feet at y = 0, ~1.75 tall
export function makePerson(THREE) {
  const group = new THREE.Group();
  const skin = std(THREE, pick([0xe8b98c, 0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d]), { roughness: 0.8 });
  const shirt = std(THREE, pick([0x3b6ea5, 0x8a3b3b, 0x3b8a5e, 0x6b5b95, 0xd08a2a, 0xc04880]));
  const pants = std(THREE, pick([0x2b2b3a, 0x40403f, 0x333944, 0x4a3a2a]));
  part(THREE, group, new THREE.CylinderGeometry(0.22, 0.26, 0.6, 8), shirt, 0, 1.1, 0);
  part(THREE, group, new THREE.SphereGeometry(0.17, 10, 10), skin, 0, 1.58, 0);
  const arm = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6);
  const armL = joint(THREE, group, -0.28, 1.35, 0); part(THREE, armL, arm, shirt, 0, -0.25, 0);
  const armR = joint(THREE, group, 0.28, 1.35, 0); part(THREE, armR, arm, shirt, 0, -0.25, 0);
  const leg = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 6);
  const legL = joint(THREE, group, -0.11, 0.65, 0); part(THREE, legL, leg, pants, 0, -0.32, 0);
  const legR = joint(THREE, group, 0.11, 0.65, 0); part(THREE, legR, leg, pants, 0, -0.32, 0);
  // realistic version (when loaded): the simple shapes above are hidden, and
  // update(dt, state) plays the matching animation
  const real = peopleReady() ? makeRealPerson(randomCivilian()) : null;
  if (real) {
    for (const c of [...group.children]) c.visible = false;
    group.add(real.group);
  }
  const STATE = { wait: ['Idle_Loop', 0, 1], hop: ['Jump_Loop', 1, 0], fall: ['Jump_Loop', 1, 0], safe: ['Dance_Loop', 0, 0], stand: ['Idle_Loop', 0, 0], walk: ['Walk_Loop', 0, 0], cheer: ['Dance_Loop', 0, 0] };
  function update(dt, state = 'stand') {
    if (!real) return;
    const [clip, up, wave] = STATE[state] || STATE.stand;
    real.play(clip);
    real.armsUp += (up - real.armsUp) * Math.min(1, dt * 8);
    real.wave += (wave - real.wave) * Math.min(1, dt * 8);
    real.update(dt);
  }
  return { group, armL, armR, legL, legR, real, update };
}

// Shadow Ninja, feet at y = 0, ~2.2 tall after scaling.
// Realistic version (when the people models have loaded): a real body in a
// black suit with a red eye slit, red scarf and a katana in his right hand.
export const NINJA_LOOK = {
  sex: 'male', skin: '#c18a63', hair: null, scale: 1.22, slim: 0.35, idle: 'Sword_Idle',
  outfit: { mode: 'suit', main: '#16181e', second: '#262a33', accent: '#07070a', hex: 0.18, mask: true, maskCol: '#121318', lens: '#ff2a3c', metal: 0.15, rough: 0.6 },
};
function makeRealNinja(THREE) {
  const real = makeRealPerson(NINJA_LOOK);
  if (!real) return null;
  const inv = 1 / NINJA_LOOK.scale; // bones live inside the scaled model
  // katana in the right hand
  const steel = std(THREE, 0xdfe5ee, { metalness: 0.9, roughness: 0.2 });
  const wrap = std(THREE, 0x343844, { roughness: 0.8 });
  const sword = new THREE.Group();
  part(THREE, sword, new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), wrap, 0, 0.06, 0);
  part(THREE, sword, new THREE.BoxGeometry(0.14, 0.025, 0.035), steel, 0, 0.19, 0);
  part(THREE, sword, new THREE.BoxGeometry(0.03, 0.85, 0.01), steel, 0, 0.62, 0);
  sword.scale.setScalar(inv);
  const hand = real.bone('hand_r');
  if (hand) { sword.position.set(0, 0.05 * inv, 0.03 * inv); sword.rotation.set(0, 0, -Math.PI / 2); hand.add(sword); }
  // red scarf tied round the neck with tails flying behind
  const scarfMat = std(THREE, 0xc8102e, { side: THREE.DoubleSide });
  const scarf = new THREE.Group();
  const neck = real.bone('neck_01');
  part(THREE, scarf, new THREE.TorusGeometry(0.075, 0.025, 6, 14), scarfMat, 0, 0, 0).rotation.x = Math.PI / 2;
  const tail = part(THREE, scarf, new THREE.PlaneGeometry(0.1, 0.55), scarfMat, 0.03, -0.27, -0.08);
  tail.rotation.x = 0.4;
  scarf.scale.setScalar(inv * 1.1);
  if (neck) neck.add(scarf);
  const dj = () => new THREE.Group();
  return {
    group: real.group, body: dj(), head: dj(), scarf, flashMats: [real.bodyMat], real,
    arms: [0, 1].map(() => ({ sh: dj(), el: dj(), hand: dj() })), legs: [0, 1].map(() => ({ hip: dj(), knee: dj() })),
    play: real.play, update: real.update,
  };
}
export function makeNinja(THREE) {
  const r = peopleReady() ? makeRealNinja(THREE) : null;
  if (r) return r;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const suit = std(THREE, 0x16181e, { roughness: 0.55 });
  const wrap = std(THREE, 0x343844, { roughness: 0.8 });
  const scarfMat = std(THREE, 0xc8102e, { side: THREE.DoubleSide });
  const eye = new THREE.MeshBasicMaterial({ color: 0xff3344 });
  const steel = std(THREE, 0xdfe5ee, { metalness: 0.9, roughness: 0.2 });
  const C = (a, b, l) => new THREE.CylinderGeometry(a, b, l, 10);

  const legs = [-1, 1].map(sx => {
    const hip = joint(THREE, body, sx * 0.13, 0.95, 0);
    part(THREE, hip, C(0.11, 0.09, 0.5), suit, 0, -0.25, 0);
    const knee = joint(THREE, hip, 0, -0.5, 0);
    part(THREE, knee, C(0.09, 0.07, 0.45), wrap, 0, -0.22, 0);
    part(THREE, knee, new THREE.BoxGeometry(0.13, 0.08, 0.28), suit, 0, -0.46, 0.05);
    return { hip, knee };
  });
  part(THREE, body, new THREE.BoxGeometry(0.42, 0.2, 0.25), suit, 0, 0.98, 0);
  part(THREE, body, C(0.21, 0.17, 0.62), suit, 0, 1.33, 0).scale.z = 0.75;
  part(THREE, body, new THREE.BoxGeometry(0.44, 0.08, 0.3), scarfMat, 0, 1.08, 0); // red belt
  const sheath = part(THREE, body, new THREE.BoxGeometry(0.07, 0.9, 0.05), wrap, 0, 1.35, -0.2);
  sheath.rotation.z = 0.6;
  const head = joint(THREE, body, 0, 1.78, 0);
  part(THREE, head, new THREE.SphereGeometry(0.17, 14, 12), suit);
  part(THREE, head, new THREE.BoxGeometry(0.28, 0.045, 0.06), eye, 0, 0.02, 0.14);
  const scarf = joint(THREE, body, 0, 1.62, -0.12);
  const tail = part(THREE, scarf, new THREE.PlaneGeometry(0.16, 0.9), scarfMat, 0.06, -0.45, 0);
  tail.rotation.y = 0.2;
  part(THREE, body, new THREE.TorusGeometry(0.15, 0.05, 6, 12), scarfMat, 0, 1.63, 0).rotation.x = Math.PI / 2;
  const arms = [-1, 1].map(sx => {
    const sh = joint(THREE, body, sx * 0.28, 1.56, 0);
    part(THREE, sh, C(0.07, 0.06, 0.42), suit, 0, -0.21, 0);
    const el = joint(THREE, sh, 0, -0.42, 0);
    part(THREE, el, C(0.06, 0.05, 0.38), wrap, 0, -0.19, 0);
    const hand = joint(THREE, el, 0, -0.42, 0);
    part(THREE, hand, new THREE.SphereGeometry(0.065, 8, 6), suit);
    return { sh, el, hand };
  });
  // sword in the right hand, blade pointing forward
  const sword = new THREE.Group();
  part(THREE, sword, C(0.025, 0.025, 0.25), wrap, 0, 0, 0).rotation.x = Math.PI / 2;
  part(THREE, sword, new THREE.BoxGeometry(0.16, 0.03, 0.04), steel, 0, 0, 0.13);
  part(THREE, sword, new THREE.BoxGeometry(0.035, 0.012, 1.0), steel, 0, 0, 0.65);
  arms[1].hand.add(sword);
  group.scale.setScalar(1.15);
  return { group, body, legs, arms, head, scarf, flashMats: [suit, wrap] };
}

// black getaway car with the ninja at the wheel; faces +z, origin at the road
export function makeGetawayCar(THREE) {
  const group = new THREE.Group();
  const paint = std(THREE, 0x0d0f14, { metalness: 0.6, roughness: 0.3 });
  const stripe = std(THREE, 0xc8102e, { metalness: 0.4, roughness: 0.4 });
  const glass = std(THREE, 0x1a2230, { metalness: 0.5, roughness: 0.2 });
  const tyre = std(THREE, 0x111111, { roughness: 0.9 });
  part(THREE, group, new THREE.BoxGeometry(2.3, 0.7, 4.6), paint, 0, 0.65, 0);
  part(THREE, group, new THREE.BoxGeometry(0.5, 0.72, 4.62), stripe, 0, 0.66, 0);
  part(THREE, group, new THREE.BoxGeometry(1.9, 0.55, 2.1), glass, 0, 1.25, -0.3);
  part(THREE, group, new THREE.BoxGeometry(2.3, 0.12, 0.5), paint, 0, 1.15, -2.2); // spoiler
  const wheels = [];
  for (const [x, z] of [[-1.1, 1.5], [1.1, 1.5], [-1.1, -1.5], [1.1, -1.5]]) {
    const w = part(THREE, group, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), tyre, x, 0.42, z);
    w.rotation.z = Math.PI / 2;
    wheels.push(w);
  }
  const head = new THREE.MeshBasicMaterial({ color: 0xfff4c8 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2030 });
  for (const x of [-0.75, 0.75]) {
    part(THREE, group, new THREE.BoxGeometry(0.45, 0.16, 0.05), head, x, 0.75, 2.31);
    part(THREE, group, new THREE.BoxGeometry(0.45, 0.16, 0.05), tail, x, 0.75, -2.31);
  }
  // the driver: black head with the glowing red eye band
  const driver = new THREE.Group();
  part(THREE, driver, new THREE.SphereGeometry(0.22, 12, 10), paint);
  part(THREE, driver, new THREE.BoxGeometry(0.36, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3344 }), 0, 0.02, 0.19);
  driver.position.set(-0.45, 1.45, 0.1);
  group.add(driver);
  return { group, wheels, driver };
}

// tall flame: red-orange outside, yellow-white core (normal blending so it
// stays orange in front of bright windows)
export function flameTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  const blob = (cy, ry, rx, stops) => {
    const g = ctx.createRadialGradient(32, cy, 0, 32, cy, ry);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    ctx.save();
    ctx.translate(32, cy);
    ctx.scale(rx / ry, 1);
    ctx.translate(-32, -cy);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(32, cy, ry, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  blob(74, 54, 30, [[0, 'rgba(255,90,10,0.95)'], [0.6, 'rgba(230,40,0,0.6)'], [1, 'rgba(160,20,0,0)']]);
  blob(84, 36, 20, [[0, 'rgba(255,200,40,1)'], [0.7, 'rgba(255,120,10,0.7)'], [1, 'rgba(255,90,0,0)']]);
  blob(94, 18, 11, [[0, 'rgba(255,255,210,1)'], [1, 'rgba(255,220,90,0)']]);
  return new THREE.CanvasTexture(c);
}

export function glowTexture(THREE, inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

