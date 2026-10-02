// Boss fights: the Giant Rage Brute (city plaza arena) and the Stone Titan
// (helipad on the tallest rooftop). Once both are beaten, the rooftop hosts a
// rematch against both at once. Every boss uses four telegraphed attacks —
// ground-smash shockwave, car throw, charge and jump slam — and each wind-up
// triggers the hero's "danger sense" (see App.jsx: slow-mo + DODGE).
//
// Boss models are built with feet at y = 0 and ~7 units tall (the hero is ~2.5).

export const ARENA = { x: 0, z: -118, r: 30 };

const rand = (a, b) => a + Math.random() * (b - a);
const std = (THREE, color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });

function joint(THREE, parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function part(THREE, parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// ---------- models ----------
function makeBrute(THREE) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const skin = std(THREE, 0x7d6b94, { roughness: 0.65 });
  const pants = std(THREE, 0x2d3442, { roughness: 0.9 });
  const eyes = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const S = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
  const Cy = (a, b, l) => new THREE.CylinderGeometry(a, b, l, 16);

  const legs = [-1, 1].map(sx => {
    const hip = joint(THREE, body, sx * 0.75, 2.8, 0);
    part(THREE, hip, Cy(0.62, 0.5, 1.5), pants, 0, -0.75, 0);
    // ragged hem: a slightly wider, shorter cylinder
    part(THREE, hip, Cy(0.66, 0.62, 0.25), pants, 0, -1.45, 0);
    const knee = joint(THREE, hip, 0, -1.5, 0);
    part(THREE, knee, Cy(0.5, 0.42, 1.2), skin, 0, -0.6, 0);
    part(THREE, knee, new THREE.BoxGeometry(0.9, 0.4, 1.4), skin, 0, -1.25, 0.2);
    return { hip, knee };
  });
  part(THREE, body, new THREE.BoxGeometry(2.1, 1.0, 1.3), pants, 0, 3.0, 0);
  part(THREE, body, S(1.15), skin, 0, 3.75, 0.1, 1, 0.9, 0.85);
  part(THREE, body, S(1.55), skin, 0, 4.7, 0, 1.2, 0.95, 0.8);
  for (const sx of [-1, 1]) part(THREE, body, S(0.75), skin, sx * 0.62, 4.95, 0.78, 1, 0.8, 0.5);
  part(THREE, body, S(0.85), skin, 0, 5.6, -0.15, 1.6, 0.7, 0.9);
  const head = joint(THREE, body, 0, 6.1, 0.35);
  part(THREE, head, S(0.6), skin, 0, 0, 0, 1, 1.05, 1);
  part(THREE, head, new THREE.BoxGeometry(1.0, 0.18, 0.3), skin, 0, 0.18, 0.45);
  part(THREE, head, new THREE.BoxGeometry(0.9, 0.4, 0.7), skin, 0, -0.35, 0.18);
  for (const sx of [-1, 1]) part(THREE, head, S(0.1, 10, 8), eyes, sx * 0.22, 0.06, 0.55);
  const arms = [-1, 1].map(sx => {
    const sh = joint(THREE, body, sx * 1.85, 5.2, 0);
    part(THREE, sh, S(0.85), skin);
    part(THREE, sh, Cy(0.62, 0.52, 1.7), skin, 0, -0.85, 0);
    const el = joint(THREE, sh, 0, -1.7, 0);
    part(THREE, el, Cy(0.6, 0.5, 1.5), skin, 0, -0.75, 0);
    const hand = joint(THREE, el, 0, -1.7, 0);
    part(THREE, hand, S(0.7), skin);
    return { sh, el, hand };
  });
  return { group, body, legs, arms, height: 6.9, radius: 2.0, flashMats: [skin], baseEmissive: 0x000000 };
}

function makeTitan(THREE) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const rock = std(THREE, 0x6d6862, { roughness: 1, flatShading: true });
  const rock2 = std(THREE, 0x57524c, { roughness: 1, flatShading: true });
  const lava = new THREE.MeshStandardMaterial({ color: 0x331000, emissive: 0xff5a14, emissiveIntensity: 1.6 });
  const eyes = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const I = (r) => new THREE.IcosahedronGeometry(r, 0);
  const S = (r) => new THREE.SphereGeometry(r, 14, 10);

  const legs = [-1, 1].map(sx => {
    const hip = joint(THREE, body, sx * 0.85, 2.9, 0);
    part(THREE, hip, S(0.55), lava, 0, -0.7, 0);
    part(THREE, hip, I(0.8), rock, 0, -0.75, 0, 1, 1.15, 1);
    const knee = joint(THREE, hip, 0, -1.55, 0);
    part(THREE, knee, S(0.5), lava, 0, -0.55, 0);
    part(THREE, knee, I(0.72), rock2, 0, -0.6, 0, 1, 1.1, 1);
    part(THREE, knee, I(0.6), rock, 0, -1.2, 0.25, 1.3, 0.6, 1.5);
    return { hip, knee };
  });
  part(THREE, body, S(1.0), lava, 0, 3.2, 0);
  part(THREE, body, I(1.2), rock2, 0, 3.15, 0, 1.3, 0.8, 1);
  part(THREE, body, S(1.45), lava, 0, 4.7, 0);
  part(THREE, body, I(1.8), rock, 0, 4.75, 0, 1.15, 1, 0.8);
  part(THREE, body, I(0.8), rock2, -0.7, 5.3, 0.9);
  part(THREE, body, I(0.7), rock2, 0.8, 4.3, 0.95);
  const head = joint(THREE, body, 0, 6.35, 0.2);
  part(THREE, head, I(0.72), rock, 0, 0, 0, 1, 0.95, 1);
  for (const sx of [-1, 1]) part(THREE, head, S(0.12), eyes, sx * 0.25, 0.05, 0.6);
  const arms = [-1, 1].map(sx => {
    const sh = joint(THREE, body, sx * 2.0, 5.4, 0);
    part(THREE, sh, S(0.6), lava);
    part(THREE, sh, I(0.95), rock2);
    part(THREE, sh, I(0.7), rock, 0, -1.0, 0, 1, 1.2, 1);
    const el = joint(THREE, sh, 0, -1.8, 0);
    part(THREE, el, S(0.5), lava);
    part(THREE, el, I(0.75), rock2, 0, -0.85, 0, 1, 1.2, 1);
    const hand = joint(THREE, el, 0, -1.8, 0);
    part(THREE, hand, I(0.9), rock);
    return { sh, el, hand };
  });
  return { group, body, legs, arms, height: 7.1, radius: 2.2, flashMats: [rock, rock2], baseEmissive: 0x000000 };
}

function makeCarMesh(THREE) {
  const g = new THREE.Group();
  const col = [0xd23c3c, 0x3c6fd2, 0xd2c23c, 0xe8e8e8, 0x3c3c3c][Math.floor(Math.random() * 5)];
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.2), std(THREE, col, { metalness: 0.4, roughness: 0.4 }));
  b.position.y = 0.35;
  g.add(b);
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 2.0), std(THREE, 0x1a2230, { metalness: 0.3, roughness: 0.5 }));
  c.position.set(0, 0.95, -0.2);
  g.add(c);
  return g;
}

// ---------- system ----------
// api: { hero, heroVel, damagePlayer(amount, dir, force), spawnBurst(pos, color, n, opts),
//        triggerShake(mag, dur), playTone(o), playNoise(o), showMsg(text, ms),
//        onHud(list|null), onDanger(bool), onDefeated(type, rematch), bothBeaten(),
//        roof: { x, y, z, half } }
export function createBosses(THREE, scene, api) {
  const hero = api.hero;
  const zones = {
    arena: { name: 'arena', x: ARENA.x, z: ARENA.z, y: 0, shape: 'circle', r: ARENA.r, armed: true },
    roof: { name: 'roof', x: api.roof.x, z: api.roof.z, y: api.roof.y, shape: 'square', r: api.roof.half, armed: true },
  };
  let fight = null; // { zone, bosses, rematch }
  const shockwaves = [];
  const cars = [];
  let lastHudKey = '';
  let dangerOn = false;

  const ringGeo = new THREE.RingGeometry(0.93, 1.0, 72);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffa040, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const targetMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });

  function inZone(z, p, pad = 0) {
    if (p.y < z.y + 1.5 - 1 || p.y > z.y + 14) return false;
    if (z.shape === 'circle') return Math.hypot(p.x - z.x, p.z - z.z) < z.r + pad;
    return Math.abs(p.x - z.x) < z.r + pad && Math.abs(p.z - z.z) < z.r + pad;
  }
  function clampToZone(z, pos, margin) {
    if (z.shape === 'circle') {
      const dx = pos.x - z.x, dz = pos.z - z.z, d = Math.hypot(dx, dz), max = z.r - margin;
      if (d > max) { pos.x = z.x + dx / d * max; pos.z = z.z + dz / d * max; return true; }
      return false;
    }
    const lim = z.r - margin;
    const cx = Math.max(z.x - lim, Math.min(z.x + lim, pos.x));
    const cz = Math.max(z.z - lim, Math.min(z.z + lim, pos.z));
    const hit = cx !== pos.x || cz !== pos.z;
    pos.x = cx; pos.z = cz;
    return hit;
  }

  function spawnBoss(type, zone, rematch, offset) {
    const rig = type === 'brute' ? makeBrute(THREE) : makeTitan(THREE);
    const maxHp = Math.round((type === 'brute' ? 450 : 550) * (rematch ? 1.2 : 1));
    // start on the far side of the zone from the hero
    const away = new THREE.Vector3(zone.x - hero.position.x, 0, zone.z - hero.position.z);
    if (away.lengthSq() < 1) away.set(0, 0, -1);
    away.normalize().multiplyScalar(zone.r * 0.5);
    rig.group.position.set(zone.x + away.x + offset, zone.y, zone.z + away.z);
    scene.add(rig.group);
    return {
      type, rig, zone, rematch, maxHp, hp: maxHp,
      name: type === 'brute' ? 'GIANT RAGE BRUTE' : 'STONE TITAN',
      state: 'roar', stateT: 1.6, cooldown: 1.5, attack: null, data: {},
      speed: type === 'brute' ? 7.5 : 5.5, cd: rematch ? 0.7 : 1, flashT: 0, walkPhase: 0, dangerT: 0, deadT: 0,
      pose: { shL: 0, shR: 0, elL: -0.2, elR: -0.2, hipL: 0, hipR: 0, knL: 0, knR: 0, lean: 0, crouch: 0 },
    };
  }

  function startFight(zone) {
    const rematch = zone.name === 'roof' && api.bothBeaten();
    const bosses = zone.name === 'arena' ? [spawnBoss('brute', zone, false, 0)]
      : rematch ? [spawnBoss('brute', zone, true, -6), spawnBoss('titan', zone, true, 6)]
        : [spawnBoss('titan', zone, false, 0)];
    fight = { zone, bosses, rematch };
    zone.armed = false;
    api.showMsg(rematch ? 'REMATCH! Both bosses at once!' : `${bosses[0].name} awakens!`, 2500);
    api.triggerShake(0.4, 0.8);
    api.playNoise({ duration: 0.9, gain: 0.35, filterFreq: 220 });
    api.playTone({ freq: 110, freqEnd: 55, duration: 0.9, type: 'sawtooth', gain: 0.18 });
  }
  function endFight() {
    if (!fight) return;
    for (const b of fight.bosses) scene.remove(b.rig.group);
    for (const s of shockwaves.splice(0)) scene.remove(s.mesh);
    for (const c of cars.splice(0)) scene.remove(c.mesh);
    fight = null;
  }

  // ---------- attacks ----------
  const WINDUP = { smash: 0.95, throw: 1.05, charge: 0.8, jump: 0.6 };
  function chooseAttack(b, dist) {
    const opts = [];
    if (dist < 14) opts.push('smash', 'smash');
    if (dist > 8) opts.push('throw', 'jump');
    opts.push('charge');
    if (dist > 18) opts.push('jump', 'throw');
    return opts[Math.floor(Math.random() * opts.length)];
  }
  function beginAttack(b, attack) {
    b.attack = attack;
    b.state = 'windup';
    b.stateT = WINDUP[attack] * (b.rematch ? 0.85 : 1);
    b.dangerT = b.stateT + 0.5;
    b.data = {};
    if (attack === 'throw') {
      const car = makeCarMesh(THREE);
      car.scale.setScalar(0.8);
      car.position.set(0, 0.3, 0);
      b.rig.arms[1].hand.add(car);
      b.data.car = car;
    }
    if (attack === 'jump') {
      const t = new THREE.Mesh(ringGeo, targetMat);
      t.rotation.x = -Math.PI / 2;
      b.data.target = new THREE.Vector3(hero.position.x, b.zone.y, hero.position.z);
      clampToZone(b.zone, b.data.target, 3);
      t.position.set(b.data.target.x, b.zone.y + 0.12, b.data.target.z);
      t.scale.setScalar(6);
      scene.add(t);
      b.data.targetMesh = t;
    }
    api.playTone({ freq: 90, freqEnd: 70, duration: 0.5, type: 'sawtooth', gain: 0.12 });
  }
  function spawnShockwave(center, y, maxR, speed, dmg) {
    const mesh = new THREE.Mesh(ringGeo, ringMat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, y + 0.15, center.z);
    scene.add(mesh);
    shockwaves.push({ mesh, x: center.x, z: center.z, y, r: 0.5, maxR, speed, dmg, hit: false });
  }
  function executeAttack(b) {
    const g = b.rig.group;
    if (b.attack === 'smash') {
      spawnShockwave(g.position, b.zone.y, 34, 17, 18);
      api.triggerShake(0.5, 0.4);
      api.spawnBurst(g.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xcfc7b3, 16, { speed: 9, life: 0.7, gravity: -20, size: 1.2 });
      api.playNoise({ duration: 0.5, gain: 0.4, filterFreq: 160 });
      b.state = 'recover'; b.stateT = 0.9;
    } else if (b.attack === 'throw') {
      const car = b.data.car;
      const start = new THREE.Vector3();
      car.getWorldPosition(start);
      b.rig.arms[1].hand.remove(car);
      car.position.copy(start);
      car.scale.setScalar(1);
      scene.add(car);
      const T = 1.15;
      const target = hero.position.clone().addScaledVector(api.heroVel, T * 0.4);
      target.y = hero.position.y - 1.0;
      const vel = target.clone().sub(start).divideScalar(T);
      vel.y = (target.y - start.y) / T + 0.5 * 28 * T;
      cars.push({ mesh: car, vel, spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3)), groundY: b.zone.y, hit: false, zone: b.zone });
      api.playTone({ freq: 300, freqEnd: 120, duration: 0.3, type: 'triangle', gain: 0.12 });
      b.state = 'recover'; b.stateT = 0.7;
    } else if (b.attack === 'charge') {
      const dir = new THREE.Vector3(hero.position.x - g.position.x, 0, hero.position.z - g.position.z).normalize();
      b.data.dir = dir;
      b.data.left = 1.1;
      b.data.hit = false;
      b.state = 'charging';
      api.playNoise({ duration: 0.3, gain: 0.25, filterFreq: 400 });
    } else if (b.attack === 'jump') {
      b.data.from = g.position.clone();
      b.data.t = 0;
      b.data.T = 1.1;
      b.state = 'leaping';
    }
  }

  function setPose(b, p, k) {
    for (const key of Object.keys(p)) b.pose[key] += (p[key] - b.pose[key]) * Math.min(1, k);
    const r = b.rig, q = b.pose;
    r.arms[0].sh.rotation.x = q.shL; r.arms[1].sh.rotation.x = q.shR;
    r.arms[0].el.rotation.x = q.elL; r.arms[1].el.rotation.x = q.elR;
    r.legs[0].hip.rotation.x = q.hipL; r.legs[1].hip.rotation.x = q.hipR;
    r.legs[0].knee.rotation.x = q.knL; r.legs[1].knee.rotation.x = q.knR;
    r.body.rotation.x = q.lean;
    r.body.position.y = q.crouch;
  }

  function faceHero(b, dt, rate = 4) {
    const g = b.rig.group;
    const target = Math.atan2(hero.position.x - g.position.x, hero.position.z - g.position.z);
    let d = target - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * rate);
  }

  function hurtHero(amount, from, force) {
    const dir = new THREE.Vector3(hero.position.x - from.x, 0, hero.position.z - from.z);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    api.damagePlayer(amount, dir, force);
    api.heroVel.y = Math.max(api.heroVel.y, force * 0.5);
  }

  function updateBoss(b, dt, t) {
    const g = b.rig.group;
    if (b.flashT > 0) b.flashT -= dt;
    const flash = b.flashT > 0 ? 0x661111 : b.rig.baseEmissive;
    for (const m of b.rig.flashMats) m.emissive.setHex(flash);
    if (b.dangerT > 0) b.dangerT -= dt;

    if (b.state === 'dead') {
      b.deadT += dt;
      g.rotation.x = Math.max(-Math.PI / 2, g.rotation.x - dt * 1.4);
      g.position.y = b.zone.y - Math.max(0, b.deadT - 1.2) * 2;
      return;
    }
    const dx = hero.position.x - g.position.x, dz = hero.position.z - g.position.z;
    const dist = Math.hypot(dx, dz);

    switch (b.state) {
      case 'roar':
        faceHero(b, dt);
        setPose(b, { shL: -2.6, shR: -2.6, elL: -0.6, elR: -0.6, lean: -0.25, crouch: 0, hipL: 0, hipR: 0, knL: 0, knR: 0 }, dt * 5);
        if ((b.stateT -= dt) <= 0) b.state = 'chase';
        break;
      case 'chase': {
        faceHero(b, dt);
        if (dist > 7) {
          g.position.x += dx / dist * b.speed * dt;
          g.position.z += dz / dist * b.speed * dt;
          clampToZone(b.zone, g.position, 3);
          b.walkPhase += dt * b.speed * 0.7;
        }
        const s = Math.sin(b.walkPhase) * (dist > 7 ? 0.45 : 0.05);
        setPose(b, { shL: -s * 0.8, shR: s * 0.8, elL: -0.4, elR: -0.4, hipL: s, hipR: -s, knL: Math.max(0, s) * 0.9, knR: Math.max(0, -s) * 0.9, lean: 0.08, crouch: -Math.abs(s) * 0.25 }, dt * 8);
        if ((b.cooldown -= dt) <= 0) beginAttack(b, chooseAttack(b, dist));
        break;
      }
      case 'windup': {
        faceHero(b, dt, b.attack === 'charge' ? 6 : 3);
        const P = {
          smash: { shL: -2.9, shR: -2.9, elL: -0.4, elR: -0.4, lean: -0.2, crouch: 0, hipL: 0, hipR: 0, knL: 0, knR: 0 },
          throw: { shL: -0.7, shR: -3.0, elL: -0.5, elR: -0.3, lean: -0.15, crouch: 0, hipL: -0.2, hipR: 0.2, knL: 0.1, knR: 0.1 },
          charge: { shL: 0.7, shR: 0.7, elL: -0.6, elR: -0.6, lean: 0.45, crouch: -0.4, hipL: -0.5, hipR: 0.4, knL: 0.6, knR: 0.3 },
          jump: { shL: 0.9, shR: 0.9, elL: -0.3, elR: -0.3, lean: 0.3, crouch: -1.0, hipL: -0.9, hipR: -0.9, knL: 1.4, knR: 1.4 },
        }[b.attack];
        setPose(b, P, dt * 6);
        if ((b.stateT -= dt) <= 0) executeAttack(b);
        break;
      }
      case 'charging': {
        const step = (b.type === 'brute' ? 30 : 26) * dt;
        g.position.addScaledVector(b.data.dir, step);
        b.walkPhase += dt * 16;
        const s = Math.sin(b.walkPhase) * 0.7;
        setPose(b, { shL: -s, shR: s, elL: -0.8, elR: -0.8, hipL: s, hipR: -s, knL: Math.max(0, s), knR: Math.max(0, -s), lean: 0.4, crouch: -0.2 }, dt * 12);
        if (Math.random() < 0.5) api.spawnBurst(g.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xcfc7b3, 2, { speed: 3, life: 0.4, size: 0.8 });
        const hitWall = clampToZone(b.zone, g.position, 3);
        if (!b.data.hit && dist < b.rig.radius + 1.4 && Math.abs(hero.position.y - 1.5 - b.zone.y) < 3) {
          b.data.hit = true;
          hurtHero(22, g.position, 18);
          api.triggerShake(0.45, 0.3);
        }
        if ((b.data.left -= dt) <= 0 || hitWall) {
          if (hitWall) { api.triggerShake(0.35, 0.3); api.playNoise({ duration: 0.3, gain: 0.3, filterFreq: 200 }); }
          b.state = 'recover'; b.stateT = 1.1;
        }
        break;
      }
      case 'leaping': {
        b.data.t += dt;
        const u = Math.min(1, b.data.t / b.data.T);
        g.position.lerpVectors(b.data.from, b.data.target, u);
        g.position.y = b.zone.y + Math.sin(u * Math.PI) * 11;
        setPose(b, { shL: -2.7, shR: -2.7, elL: -0.2, elR: -0.2, hipL: -0.6, hipR: -0.6, knL: 1.2, knR: 1.2, lean: 0, crouch: 0 }, dt * 8);
        if (u >= 1) {
          g.position.y = b.zone.y;
          scene.remove(b.data.targetMesh);
          spawnShockwave(g.position, b.zone.y, 12, 20, 15);
          api.triggerShake(0.6, 0.45);
          api.spawnBurst(g.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xcfc7b3, 20, { speed: 10, life: 0.8, gravity: -20, size: 1.3 });
          api.playNoise({ duration: 0.6, gain: 0.45, filterFreq: 140 });
          if (dist < 5.5 && hero.position.y - 1.5 < b.zone.y + 2.5) hurtHero(25, g.position, 14);
          b.state = 'recover'; b.stateT = 1.0;
        }
        break;
      }
      case 'recover':
        faceHero(b, dt, 2);
        setPose(b, { shL: 0.1, shR: 0.1, elL: -0.3, elR: -0.3, hipL: 0, hipR: 0, knL: 0.15, knR: 0.15, lean: 0.25, crouch: -0.15 + Math.sin(t * 8) * 0.05 }, dt * 5);
        if ((b.stateT -= dt) <= 0) { b.state = 'chase'; b.cooldown = rand(1.5, 2.5) * b.cd; }
        break;
      default:
        break;
    }

    // keep the hero from walking through the boss
    if (Math.abs(hero.position.y - 1.5 - g.position.y) < b.rig.height) {
      const ddx = hero.position.x - g.position.x, ddz = hero.position.z - g.position.z, d = Math.hypot(ddx, ddz);
      const minD = b.rig.radius + 0.5;
      if (d < minD && d > 0.001) {
        hero.position.x = g.position.x + ddx / d * minD;
        hero.position.z = g.position.z + ddz / d * minD;
      }
    }
  }

  function updateHazards(dt) {
    const feet = hero.position.y - 1.5;
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.r += s.speed * dt;
      s.mesh.scale.setScalar(s.r);
      s.mesh.material.opacity = 0.9 * (1 - s.r / s.maxR);
      const d = Math.hypot(hero.position.x - s.x, hero.position.z - s.z);
      if (!s.hit && Math.abs(d - s.r) < 1.4 && feet < s.y + 0.9) {
        s.hit = true;
        hurtHero(s.dmg, { x: s.x, z: s.z }, 9);
      }
      if (s.r >= s.maxR) { scene.remove(s.mesh); s.mesh.material.dispose(); shockwaves.splice(i, 1); }
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.vel.y -= 28 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
      const p = c.mesh.position;
      if (!c.hit && p.distanceTo(hero.position) < 2.6) {
        c.hit = true;
        hurtHero(22, p, 12);
      }
      if (p.y <= c.groundY + 0.4) {
        api.spawnBurst(p.clone(), 0xff7a2a, 18, { speed: 9, life: 0.7, size: 1.2, gravity: -12 });
        api.triggerShake(0.3, 0.3);
        api.playNoise({ duration: 0.5, gain: 0.4, filterFreq: 500 });
        if (!c.hit && p.distanceTo(hero.position) < 4.5) hurtHero(14, p, 9);
        scene.remove(c.mesh);
        cars.splice(i, 1);
      }
    }
  }

  function computeDanger() {
    if (!fight) return false;
    if (cars.length) return true;
    for (const b of fight.bosses) {
      if (b.state === 'dead') continue;
      if (b.dangerT > 0 || b.state === 'charging' || b.state === 'leaping') return true;
    }
    for (const s of shockwaves) {
      const d = Math.hypot(hero.position.x - s.x, hero.position.z - s.z);
      if (!s.hit && d > s.r && d - s.r < 9 && d < s.maxR) return true;
    }
    return false;
  }

  function pushHud() {
    const list = fight ? fight.bosses.map(b => ({ name: b.name, hp: Math.max(0, b.hp), max: b.maxHp })) : null;
    const key = JSON.stringify(list);
    if (key !== lastHudKey) { lastHudKey = key; api.onHud(list); }
  }

  return {
    zones,
    get inFight() { return !!fight; },
    get fight() { return fight; }, // for the ?debug test hook
    update(dt, t) {
      // arm zones once the hero has left them; start a fight on entry
      for (const z of Object.values(zones)) {
        if (!z.armed && !(fight && fight.zone === z) && !inZone(z, hero.position, 12)) z.armed = true;
        if (!fight && z.armed && inZone(z, hero.position, -2)) startFight(z);
      }
      if (fight) {
        if (!inZone(fight.zone, hero.position, 25)) {
          api.showMsg('You left the fight', 1500);
          endFight();
        } else {
          for (const b of fight.bosses) updateBoss(b, dt, t);
          updateHazards(dt);
          if (fight.bosses.every(b => b.state === 'dead' && b.deadT > 2.5)) {
            const rematch = fight.rematch;
            api.onDefeated(fight.bosses.map(b => b.type), rematch);
            endFight();
          }
        }
      }
      const d = computeDanger();
      if (d !== dangerOn) { dangerOn = d; api.onDanger(d); }
      pushHud();
    },
    // hero punch: returns how many bosses were hit
    punch(range) {
      if (!fight) return 0;
      let hits = 0;
      for (const b of fight.bosses) {
        if (b.state === 'dead') continue;
        const g = b.rig.group;
        const d = Math.hypot(hero.position.x - g.position.x, hero.position.z - g.position.z);
        const dy = hero.position.y - 1.5 - g.position.y;
        if (d < b.rig.radius + range && dy > -2 && dy < b.rig.height) {
          hits++;
          b.hp -= 22;
          b.flashT = 0.15;
          api.spawnBurst(g.position.clone().add(new THREE.Vector3(0, 3.5, 0)), 0xffe066, 8, { speed: 6, life: 0.35, size: 0.8 });
          if (b.hp <= 0) {
            b.state = 'dead';
            b.deadT = 0;
            if (b.data.targetMesh) scene.remove(b.data.targetMesh);
            if (b.data.car) b.rig.arms[1].hand.remove(b.data.car);
            api.triggerShake(0.7, 0.8);
            api.spawnBurst(g.position.clone().add(new THREE.Vector3(0, 3, 0)), b.type === 'brute' ? 0xb48cff : 0xff7a2a, 30, { speed: 12, life: 1.0, size: 1.4 });
            api.playNoise({ duration: 1.2, gain: 0.45, filterFreq: 120 });
            api.showMsg(`${b.name} defeated!`, 2500);
          }
        }
      }
      pushHud();
      return hits;
    },
    // direction the hero should dodge: sideways from the nearest threat
    dodgeDir(sideHint) {
      let from = null, best = Infinity;
      if (fight) {
        for (const b of fight.bosses) {
          if (b.state === 'dead') continue;
          const d = b.rig.group.position.distanceTo(hero.position);
          if (d < best) { best = d; from = b.rig.group.position; }
        }
      }
      if (!from) return null;
      const away = new THREE.Vector3(hero.position.x - from.x, 0, hero.position.z - from.z).normalize();
      const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(sideHint >= 0 ? 1 : -1);
      return side.multiplyScalar(0.8).addScaledVector(away, 0.6).normalize();
    },
  };
}
