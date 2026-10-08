// Story mode ("like GTA 5, but a superhero"). Your best friend Kai phones you
// to start missions, a STORY menu lists them, and camera-swoop movie scenes
// (letterbox + text at the bottom) tell the story between gameplay.
//
// Plan agreed with Max (2026-10-08): 13 missions, henchman fights on 3/6/9/12
// (win or lose — losing plays a "you lost" scene and the story goes on; the
// henchmen you lost to come back in mission 13), mission 13 reveals Kai as the
// mystery boss. Part 1 = missions 1-3 (built here); 4-13 are listed as coming
// soon. Money and the 1 trillion coin prize come in part 3.
//
// App.jsx owns the hero, input and HUD; this module only gets an `api` object
// (see createStory) and reports UI state back through api.onUi.

import { ARENA } from './bosses.js';

export const MISSIONS = [
  { title: 'Fire on the Roof', type: 'Rescue', ready: true },
  { title: 'The Getaway Car', type: 'Chase', ready: true },
  { title: 'Shadow Ninja', type: 'Henchman fight', ready: true, henchman: true },
  { title: 'Storm Signal', type: 'Race' },
  { title: 'Tornado Alley', type: 'Rescue' },
  { title: 'Storm Master', type: 'Henchman fight', henchman: true },
  { title: 'Drone Heist', type: 'Chase' },
  { title: 'Spare Parts', type: 'Collecting' },
  { title: 'Mech Pilot', type: 'Henchman fight', henchman: true },
  { title: 'Rooftop Blaze', type: 'Rescue' },
  { title: 'Trail of Flames', type: 'Chase' },
  { title: 'Fire Monster', type: 'Henchman fight', henchman: true },
  { title: '???', type: 'Final battle' },
];
const READY = MISSIONS.filter(m => m.ready).length;
const KAI = '📱 KAI';
const NINJA = 'SHADOW NINJA';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ease = (u) => u * u * (3 - 2 * u);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function normalizeProgress(p) {
  return { next: (p && p.next) || 0, results: (p && p.results) || {} };
}

// ---------- models ----------
function std(THREE, color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }); }
function joint(THREE, parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function part(THREE, parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// civilian, feet at y = 0, ~1.75 tall
function makePerson(THREE) {
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
  return { group, armL, armR, legL, legR };
}

// Shadow Ninja, feet at y = 0, ~2.2 tall after scaling
function makeNinja(THREE) {
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
function makeGetawayCar(THREE) {
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
function flameTexture(THREE) {
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

function glowTexture(THREE, inner, outer) {
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

// ---------- system ----------
// api: { hero, heroVel, heroRig, camera, buildings, CITY_SIZE, damagePlayer(amount, dir, force),
//        spawnBurst, triggerShake, playTone, playNoise, showMsg, healHero(),
//        onUi(ui), onHud(list|null), onDanger(bool), getProgress(), setProgress(p),
//        busyReason() -> string|null, freezeHero(), resetCamera(), setBossesPaused(bool) }
export function createStory(THREE, scene, api) {
  const hero = api.hero;
  const camera = api.camera;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const fireTex = flameTexture(THREE);
  const smokeTex = glowTexture(THREE, 'rgba(70,70,78,0.85)', 'rgba(70,70,78,0)');
  const darkSmokeTex = glowTexture(THREE, 'rgba(28,26,30,0.9)', 'rgba(28,26,30,0)');

  let progress = normalizeProgress(api.getProgress());
  let mission = null;
  let cut = null;
  let call = null;
  let freeT = 0;
  let bannerT = 0;
  let danger = false;
  let hudKey = '';
  let ui = { cut: null, call: null, hud: null, result: null, banner: null };
  let uiKey = '';
  function setUi(p) {
    ui = { ...ui, ...p };
    const k = JSON.stringify(ui);
    if (k !== uiKey) { uiKey = k; api.onUi(JSON.parse(k)); }
  }
  function setDanger(on) { if (on !== danger) { danger = on; api.onDanger(on); } }
  function setBoss(list) {
    const k = JSON.stringify(list);
    if (k !== hudKey) { hudKey = k; api.onHud(list); }
  }
  function setHud(h) { setUi({ hud: h }); }
  function banner(title, sub, secs = 4) { setUi({ banner: { title, sub } }); bannerT = secs; }

  // ---------- smoke puffs (ninja teleports) ----------
  const puffs = [];
  function puff(pos, size = 1) {
    api.spawnBurst(pos.clone(), 0x3a3f4a, 18, { speed: 5 * size, life: 0.7, gravity: 3, size: 1.8 * size });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false }));
      s.position.copy(pos).add(V(rand(-0.6, 0.6), rand(0, 1.2), rand(-0.6, 0.6)));
      s.scale.setScalar(1.5 * size);
      scene.add(s);
      puffs.push({ s, life: 1.1, grow: rand(2.5, 4) * size });
    }
    api.playNoise({ duration: 0.4, gain: 0.25, filterFreq: 900 });
  }
  function updatePuffs(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life -= dt;
      p.s.scale.addScalar(p.grow * dt);
      p.s.position.y += dt * 0.8;
      p.s.material.opacity = Math.max(0, p.life / 1.1);
      if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); }
    }
  }

  // ---------- target beacon (like a GTA mission marker) ----------
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 160, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  beacon.visible = false;
  scene.add(beacon);
  let target = null;
  function setTarget(p) {
    target = p ? p.clone() : null;
    beacon.visible = !!p;
    if (p) beacon.position.set(p.x, p.y + 80, p.z);
  }

  // ---------- movie scenes ----------
  // shot: { who, text, cam(u, T) -> { pos, look }, enter(), update(u, dt), dur, snap }
  const camRay = new THREE.Raycaster();
  const camPos = V(), camLook = V();
  function playScene(shots, onDone) {
    api.freezeHero();
    setDanger(false);
    const dir = V();
    camera.getWorldDirection(dir);
    camPos.copy(camera.position);
    camLook.copy(camera.position).addScaledVector(dir, 10);
    cut = { shots, i: -1, t: 0, T: 0, onDone, cam: null };
    nextShot();
  }
  function nextShot() {
    cut.i++;
    if (cut.i >= cut.shots.length) {
      const done = cut.onDone;
      cut = null;
      setUi({ cut: null });
      api.resetCamera();
      if (done) done();
      return;
    }
    const s = cut.shots[cut.i];
    cut.t = 0;
    s.dur = s.dur || Math.max(3, 1.6 + (s.text || '').length * 0.055);
    if (s.cam) cut.cam = s.cam;
    if (s.enter) s.enter();
    if (s.snap) cut.snap = true;
    setUi({ cut: { who: s.who || '', text: s.text || '' } });
  }
  function updateCut(dt) {
    cut.t += dt;
    cut.T += dt;
    const s = cut.shots[cut.i];
    const u = Math.min(1, cut.t / s.dur);
    if (s.update) s.update(u, dt);
    if (!cut) return; // a shot's update may end the scene
    if (cut.cam) {
      const { pos, look } = cut.cam(ease(u), cut.T);
      // don't put the camera inside a building
      const toCam = pos.clone().sub(look);
      const dist = toCam.length();
      if (dist > 0.01) {
        camRay.set(look, toCam.normalize());
        camRay.far = dist;
        const hit = camRay.intersectObjects(api.buildings, false)[0];
        if (hit) pos.copy(look).addScaledVector(toCam, Math.max(1, hit.distance - 0.6));
      }
      if (cut.snap) { camPos.copy(pos); camLook.copy(look); cut.snap = false; }
      const k = 1 - Math.exp(-3.5 * dt);
      camPos.lerp(pos, k);
      camLook.lerp(look, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    }
    if (cut.t > s.dur) nextShot();
  }
  // camera helpers
  const heroC = () => hero.position.clone().add(V(0, -0.3, 0));
  function orbit(center, r, h, a0, a1, lookUp = 0) {
    return (u) => {
      const c = typeof center === 'function' ? center() : center;
      const a = a0 + (a1 - a0) * u;
      return { pos: V(c.x + Math.cos(a) * r, c.y + h, c.z + Math.sin(a) * r), look: V(c.x, c.y + lookUp, c.z) };
    };
  }
  // slow continuous orbit around the hero while Kai talks on the phone
  function phoneCam() {
    const a0 = Math.atan2(camera.position.z - hero.position.z, camera.position.x - hero.position.x);
    return (u, T) => {
      const c = heroC();
      const a = a0 + T * 0.18;
      return { pos: V(c.x + Math.cos(a) * 4.5, c.y + 0.9, c.z + Math.sin(a) * 4.5), look: c.add(V(0, 0.4, 0)) };
    };
  }
  function phone(lines) {
    const cam = phoneCam();
    return lines.map((text, i) => ({ who: KAI, text, cam: i === 0 ? cam : undefined }));
  }

  // ---------- mission flow ----------
  const ctx = {
    THREE, scene, api, hero, V, puff, setHud, setBoss, setDanger, setTarget, orbit, phone, heroC,
    play: playScene,
    finish(result, shots) {
      if (!mission || mission.ending) return;
      const m = mission;
      m.ending = true;
      setHud(null); setBoss(null); setDanger(false); setTarget(null);
      playScene(shots, () => {
        endMission();
        record(m.n, result);
      });
    },
    fail(reason) {
      if (!mission || mission.ending) return;
      const n = mission.n;
      endMission();
      setUi({ result: { title: 'MISSION FAILED', sub: reason, n } });
      api.playTone({ freq: 400, freqEnd: 150, duration: 0.6, type: 'sawtooth', gain: 0.12 });
    },
  };
  function endMission() {
    if (mission) mission.cleanup();
    mission = null;
    setHud(null); setBoss(null); setDanger(false); setTarget(null);
    api.setBossesPaused(false);
    freeT = 0;
  }
  function record(n, result) {
    const p = { next: progress.next, results: { ...progress.results } };
    if (n - 1 === p.next) p.next = n;
    if (result === 'won' || result === 'lost') {
      p.results[n] = p.results[n] === 'won' || result === 'won' ? 'won' : 'lost';
    }
    progress = p;
    api.setProgress(p);
    api.playTone({ freq: 660, duration: 0.15, type: 'triangle', gain: 0.12 });
    api.playTone({ freq: 880, duration: 0.15, type: 'triangle', gain: 0.12, delay: 0.15 });
    api.playTone({ freq: 1320, duration: 0.35, type: 'triangle', gain: 0.12, delay: 0.3 });
    const title = result === 'won' ? 'YOU WON! 🏆' : result === 'lost' ? 'YOU LOST... BUT THE STORY GOES ON!' : 'MISSION COMPLETE! ✅';
    const sub = p.next >= READY && n === READY
      ? 'TO BE CONTINUED... Missions 4-13 are coming in Part 2!'
      : p.next < READY && n === p.next ? 'Kai will call you soon about the next mission 📱' : `Mission ${n}: ${MISSIONS[n - 1].title}`;
    banner(title, sub, 6);
  }
  function startMission(i) {
    if (cut || !MISSIONS[i] || !MISSIONS[i].ready || i > progress.next) return false;
    const reason = api.busyReason();
    if (reason) { api.showMsg(reason, 2200); return false; }
    if (mission) endMission();
    call = null;
    setUi({ call: null, result: null, banner: null });
    api.setBossesPaused(true);
    api.healHero();
    mission = FACTORIES[i](ctx);
    mission.n = i + 1;
    mission.begin();
    return true;
  }

  // ---------- phone ----------
  function ring() {
    call = { t: 0, beep: 0 };
    setUi({ call: { from: 'KAI', sub: 'Your best friend' } });
  }
  function updatePhone(dt) {
    if (call) {
      call.t += dt;
      call.beep -= dt;
      if (call.beep <= 0) {
        call.beep = 1.4;
        api.playTone({ freq: 1180, duration: 0.12, type: 'sine', gain: 0.1 });
        api.playTone({ freq: 1480, duration: 0.12, type: 'sine', gain: 0.1, delay: 0.16 });
        api.playTone({ freq: 1180, duration: 0.12, type: 'sine', gain: 0.1, delay: 0.32 });
      }
      if (call.t > 16 || api.busyReason()) {
        call = null;
        setUi({ call: null });
        freeT = -40;
        api.showMsg('Missed call from Kai 📱 (open 📖 STORY to play)', 2600);
      }
      return;
    }
    if (mission || ui.result || progress.next >= READY || api.busyReason()) return;
    freeT += dt;
    if (freeT > (progress.next === 0 ? 8 : 20)) ring();
  }

  // =====================================================================
  // Mission 1 — Fire on the Roof (rescue)
  // =====================================================================
  function missionFire(ctx) {
    const tops = (b) => b.position.y + b.geometry.parameters.height / 2;
    const all = api.buildings.filter(b => b.geometry.parameters.height > 14);
    let cands = all.filter(b => {
      const h = b.geometry.parameters.height;
      const d = Math.hypot(b.position.x - hero.position.x, b.position.z - hero.position.z);
      return h >= 18 && h <= 42 && d > 45 && d < 120;
    });
    if (!cands.length) cands = all.filter(b => b.geometry.parameters.height <= 50);
    const b = pick(cands.length ? cands : all);
    const P = b.geometry.parameters;
    const top = tops(b), cx = b.position.x, cz = b.position.z, hw = P.width / 2, hd = P.depth / 2;
    const root = new THREE.Group();
    scene.add(root);

    // flames on all four faces and along the roof
    const flames = [];
    const fireMat = new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, fog: false });
    const addFlame = (x, y, z, s) => {
      const sp = new THREE.Sprite(fireMat);
      sp.position.set(x, y, z);
      sp.scale.setScalar(s);
      root.add(sp);
      flames.push({ sp, s, ph: Math.random() * 10 });
    };
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 0; i < 7; i++) {
        const along = rand(-0.85, 0.85);
        const x = cx + nx * (hw + 0.5) + (nz ? along * hw : 0);
        const z = cz + nz * (hd + 0.5) + (nx ? along * hd : 0);
        addFlame(x, rand(0.4, 0.97) * top, z, rand(3.5, 6.5));
      }
    }
    // big flames along the roof edges (people stand in the middle)
    for (let i = 0; i < 10; i++) {
      const edge = i % 2 === 0;
      addFlame(cx + (edge ? pick([-1, 1]) * hw * 0.95 : rand(-hw, hw) * 0.9), top + 2, cz + (edge ? rand(-hd, hd) * 0.9 : pick([-1, 1]) * hd * 0.95), rand(3.5, 5));
    }
    const smoke = [];
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: darkSmokeTex, transparent: true, depthWrite: false }));
      root.add(sp);
      smoke.push({ sp, y: rand(0, 22) });
    }

    // five people waving on the roof (away from the stair hut in the +x/+z corner)
    const people = [];
    for (let i = 0; i < 5; i++) {
      let x, z, tries = 0;
      do {
        x = cx + rand(-hw + 1.2, hw - 1.2);
        z = cz + rand(-hd + 1.2, hd - 1.2);
        tries++;
      } while (tries < 20 && ((x > cx + hw - 3.4 && z > cz + hd - 3.4) || people.some(p => Math.hypot(p.home.x - x, p.home.z - z) < 1.8)));
      const pp = makePerson(THREE);
      pp.group.position.set(x, top, z);
      pp.group.rotation.y = rand(0, Math.PI * 2);
      root.add(pp.group);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
      arrow.rotation.x = Math.PI;
      arrow.position.y = 2.6;
      pp.group.add(arrow);
      people.push({ ...pp, arrow, home: V(x, top, z), state: 'wait', t: 0, ph: Math.random() * 6 });
    }
    let rescued = 0;
    let timeLeft = 150;
    let out = 0; // fire fading out, 0..1

    function launch(p) {
      // nearest face: hop to the edge, then float down under a web parachute
      const dx = p.home.x - cx, dz = p.home.z - cz;
      const useX = Math.abs(dx) / hw > Math.abs(dz) / hd;
      const edge = useX ? V(cx + Math.sign(dx || 1) * (hw + 1.6), top, p.home.z) : V(p.home.x, top, cz + Math.sign(dz || 1) * (hd + 1.6));
      p.state = 'hop';
      p.t = 0;
      p.edge = edge;
      p.arrow.visible = false;
      const chute = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xf6f6ff, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      chute.position.y = 3.0;
      chute.scale.setScalar(0.01);
      p.group.add(chute);
      p.chute = chute;
    }
    function animPeople(dt, t) {
      for (const p of people) {
        const g = p.group;
        if (p.state === 'wait') {
          p.armR.rotation.z = 2.5 + Math.sin(t * 7 + p.ph) * 0.4;
          p.armL.rotation.z = -2.5 - Math.sin(t * 7 + p.ph) * 0.4;
          p.arrow.position.y = 2.6 + Math.sin(t * 4 + p.ph) * 0.25;
          p.arrow.rotation.y += dt * 3;
        } else if (p.state === 'hop') {
          p.t += dt;
          const u = Math.min(1, p.t / 0.7);
          g.position.lerpVectors(p.home, p.edge, u);
          g.position.y = top + Math.sin(u * Math.PI) * 1.2;
          p.chute.scale.setScalar(u);
          if (u >= 1) p.state = 'fall';
        } else if (p.state === 'fall') {
          g.position.y = Math.max(0, g.position.y - dt * 5);
          g.rotation.z = Math.sin(t * 2 + p.ph) * 0.08;
          p.armL.rotation.z = -2.8; p.armR.rotation.z = 2.8;
          p.legL.rotation.x = Math.sin(t * 5) * 0.3; p.legR.rotation.x = -Math.sin(t * 5) * 0.3;
          if (g.position.y <= 0) {
            p.state = 'safe';
            g.rotation.z = 0;
            p.group.remove(p.chute);
            p.legL.rotation.x = p.legR.rotation.x = 0;
          }
        } else if (p.state === 'safe') {
          // cheering: little jumps with arms up
          g.position.y = Math.abs(Math.sin(t * 6 + p.ph)) * 0.35;
          p.armL.rotation.z = -2.7 - Math.sin(t * 12 + p.ph) * 0.2;
          p.armR.rotation.z = 2.7 + Math.sin(t * 12 + p.ph) * 0.2;
        }
      }
    }
    function hud() {
      setHud({
        title: 'MISSION 1: FIRE ON THE ROOF',
        objective: 'Swing up to the burning roof ⭐ and touch each person to save them',
        info: `Rescued ${rescued}/5`,
        timer: Math.max(0, Math.ceil(timeLeft)),
        warn: timeLeft < 30 ? 'Hurry! The fire is spreading!' : '',
      });
    }

    // a different rooftop nearby where the Shadow Ninja secretly watches
    const spot = (() => {
      const near = api.buildings.filter(o => {
        if (o === b) return false;
        const h = o.geometry.parameters.height, d = Math.hypot(o.position.x - cx, o.position.z - cz);
        return h > 12 && h < 60 && d > 22 && d < 70;
      });
      const o = near.length ? pick(near) : null;
      return o ? V(o.position.x, tops(o), o.position.z) : V(cx + hw + 14, 0, cz);
    })();
    const ninja = makeNinja(THREE);
    ninja.group.visible = false;
    ninja.group.position.copy(spot);
    ninja.group.rotation.y = Math.atan2(cx - spot.x, cz - spot.z);
    root.add(ninja.group);
    const roofC = V(cx, top, cz);
    const awayFromFire = V(spot.x - cx, 0, spot.z - cz).normalize();

    return {
      debug: { people, top },
      begin() {
        setTarget(roofC);
        const a = Math.atan2(hero.position.z - cz, hero.position.x - cx);
        ctx.play([
          ...phone([
            "Hey, it's Kai! Are you watching the news?!",
            'A building downtown is on FIRE... and people are stuck on the roof!',
          ]),
          { text: 'Five people are trapped on the burning roof!', cam: orbit(roofC, 26, 14, a - 0.5, a + 0.5) },
          { who: KAI, text: "You're the only one who can reach them. Swing up there and grab them all — quick!", cam: phoneCam() },
        ], hud);
      },
      anim(dt, t) {
        for (const f of flames) {
          const k = (1 - out) * (0.8 + Math.sin(t * 11 + f.ph) * 0.15 + Math.sin(t * 23 + f.ph * 2) * 0.08);
          f.sp.scale.set(f.s * k, f.s * k * 1.7, 1);
        }
        for (const s of smoke) {
          s.y += dt * 3.5;
          if (s.y > 24) s.y = 0;
          s.sp.position.set(cx + Math.sin(s.y * 0.3 + s.sp.id) * 2, top + 2 + s.y, cz + Math.cos(s.y * 0.25 + s.sp.id) * 2);
          s.sp.scale.setScalar(4 + s.y * 0.7);
          s.sp.material.opacity = (1 - out) * 0.85 * (1 - s.y / 24);
        }
        animPeople(dt, t);
      },
      update(dt) {
        timeLeft -= dt;
        const feet = hero.position.y - 1.5;
        for (const p of people) {
          if (p.state !== 'wait') continue;
          if (Math.hypot(hero.position.x - p.home.x, hero.position.z - p.home.z) < 2.4 && Math.abs(feet - top) < 2.5) {
            launch(p);
            rescued++;
            api.playTone({ freq: 700, freqEnd: 1300, duration: 0.2, type: 'triangle', gain: 0.14 });
            api.showMsg(rescued < 5 ? `Saved! ${5 - rescued} to go` : 'Everyone is safe!', 1400);
          }
        }
        hud();
        if (rescued >= 5) {
          const crowd = () => {
            const c = V();
            for (const p of people) c.add(p.group.position);
            return c.multiplyScalar(1 / people.length);
          };
          ctx.finish('done', [
            { text: 'All five people float safely down to the street!', cam: orbit(() => crowd().add(V(0, 1, 0)), 11, 11, a0(), a0() + 0.8), dur: 6,
              update: (u) => { out = Math.min(1, u * 1.5); } },
            { who: KAI, text: 'YOU DID IT! The whole city is cheering for you!', cam: phoneCam(), update: () => { out = 1; } },
            { who: KAI, text: 'But the firefighters say someone started that fire on PURPOSE... who would do that?' },
            { who: '???', text: 'So... this city has a hero now.', snap: true,
              enter: () => { ninja.group.visible = true; puff(spot.clone().add(V(0, 1, 0)), 0.8); },
              cam: () => ({ pos: spot.clone().add(awayFromFire.clone().multiplyScalar(4.5)).add(V(0, 3.2, 0)), look: spot.clone().add(V(0, 1.9, 0)) }) },
            { who: '???', text: 'The Boss is NOT going to like this...',
              update: (u) => { if (u > 0.85 && ninja.group.visible) { ninja.group.visible = false; puff(spot.clone().add(V(0, 1, 0))); } } },
          ]);
        } else if (timeLeft <= 0) {
          ctx.fail('The fire got too big! Try again — swing fast!');
        }
        function a0() { return Math.atan2(hero.position.z - cz, hero.position.x - cx); }
      },
      cleanup() { scene.remove(root); },
    };
  }

  // =====================================================================
  // Mission 2 — The Getaway Car (chase)
  // =====================================================================
  function missionChase(ctx) {
    const CITY = api.CITY_SIZE;
    const solid = api.buildings.filter(b => b.geometry.parameters.height > 2); // not the helipad
    function blocked(x, z, m) {
      if (Math.abs(x) > CITY - 10 || Math.abs(z) > CITY - 10) return true;
      for (const b of solid) {
        const p = b.geometry.parameters;
        if (Math.abs(x - b.position.x) < p.width / 2 + m && Math.abs(z - b.position.z) < p.depth / 2 + m) return true;
      }
      return false;
    }
    const car = makeGetawayCar(THREE);
    scene.add(car.group);
    let heading = 0;
    let speed = 0;
    let caught = 0;
    let farT = 0;
    let stuckT = 0;
    const lastPos = V();
    const pos = () => car.group.position;
    // put the car somewhere clear, 30-45 from the hero, heading away
    function place() {
      let x = 0, z = 0;
      for (let i = 0; i < 80; i++) {
        const a = rand(0, Math.PI * 2), d = rand(30, 45);
        x = hero.position.x + Math.cos(a) * d;
        z = hero.position.z + Math.sin(a) * d;
        if (!blocked(x, z, 3)) break;
      }
      heading = Math.atan2(x - hero.position.x, z - hero.position.z);
      car.group.position.set(x, 0.02, z);
      car.group.rotation.y = heading;
      lastPos.copy(car.group.position);
      speed = 0;
    }
    place();

    function drive(dt, flee = true) {
      const p = pos();
      const dHero = Math.hypot(hero.position.x - p.x, hero.position.z - p.z);
      let want = heading;
      if (flee && dHero < 55) {
        const away = Math.atan2(p.x - hero.position.x, p.z - hero.position.z);
        want = heading + angDiff(away, heading) * 0.35;
      }
      const look = 5 + speed * 0.45;
      const clear = (a) => !blocked(p.x + Math.sin(a) * look, p.z + Math.cos(a) * look, 2.2)
        && !blocked(p.x + Math.sin(a) * look * 0.5, p.z + Math.cos(a) * look * 0.5, 2.2);
      if (!clear(want)) {
        let found = false;
        const first = Math.random() < 0.5 ? 1 : -1;
        for (const off of [0.4, 0.8, 1.2, 1.6, 2.1, 2.7]) {
          for (const sg of [first, -first]) {
            if (clear(want + off * sg)) { want += off * sg; found = true; break; }
          }
          if (found) break;
        }
        if (!found) want = heading + Math.PI;
      }
      const diff = angDiff(want, heading);
      heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      const targetSpeed = 15.5 - Math.min(7, Math.abs(diff) * 7);
      speed += (targetSpeed - speed) * Math.min(1, dt * 1.5);
      const nx = p.x + Math.sin(heading) * speed * dt, nz = p.z + Math.cos(heading) * speed * dt;
      // (if it has already scraped into a wall, let it drive back out)
      if (!blocked(nx, nz, 1.2) || blocked(p.x, p.z, 1.2)) { p.x = nx; p.z = nz; } else { heading += 1.2 * dt * 10; speed *= 0.5; }
      // stuck for a while? pick any clear direction and go
      stuckT += dt;
      if (stuckT > 1.5) {
        if (p.distanceTo(lastPos) < 3) {
          const opts = [0, 1, 2, 3, 4, 5, 6, 7].map(k => k * Math.PI / 4).filter(clear);
          heading = opts.length ? pick(opts) : heading + Math.PI;
        }
        stuckT = 0;
        lastPos.copy(p);
      }
      car.group.rotation.y = heading;
      car.group.rotation.z = -diff * 0.08;
      for (const w of car.wheels) w.rotation.x += speed * dt * 2.4;
      if (Math.random() < dt * 10) api.spawnBurst(p.clone().add(V(-Math.sin(heading) * 2.4, 0.5, -Math.cos(heading) * 2.4)), 0x9aa0aa, 2, { speed: 1.5, life: 0.5, gravity: 2, size: 0.9 });
    }
    function hud() {
      setHud({
        title: 'MISSION 2: THE GETAWAY CAR',
        objective: 'Catch the black car! Stay close to it to make it stop',
        meter: { label: 'CATCH', value: Math.min(1, caught) },
        warn: farT > 0 ? `It's getting away! ${Math.ceil(7 - farT)}` : '',
      });
    }
    const chaseCam = (u) => {
      const p = pos(), f = V(Math.sin(heading), 0, Math.cos(heading));
      return { pos: p.clone().addScaledVector(f, -9).add(V(0, 3.5, 0)), look: p.clone().addScaledVector(f, 4).add(V(0, 1, 0)) };
    };
    const ninja = makeNinja(THREE);
    ninja.group.visible = false;
    scene.add(ninja.group);

    return {
      debug: { car, get caught() { return caught; } },
      begin() {
        ctx.play([
          ...phone([
            'Remember that fire? The police saw someone running away from it...',
            "They're driving a black car — and wearing a NINJA mask!",
          ]),
          { text: 'The getaway car is speeding through the city!', cam: chaseCam, snap: true, dur: 4.5, update: (u, dt) => drive(dt, false) },
          { who: KAI, text: 'Catch that car! Stay close to it and it will have to stop!', cam: phoneCam(), snap: true },
        ], () => {
          // the chase starts with the car just ahead, not already far away
          if (Math.hypot(pos().x - hero.position.x, pos().z - hero.position.z) > 50) place();
          hud();
        });
      },
      update(dt) {
        drive(dt);
        setTarget(pos().clone());
        const p = pos();
        const d = Math.hypot(hero.position.x - p.x, hero.position.z - p.z);
        const dy = hero.position.y - 1.5 - p.y;
        if (d < 9 && dy < 8) {
          caught += dt / 3.5;
          if (Math.random() < dt * 3) api.playTone({ freq: 900 + caught * 600, duration: 0.05, type: 'square', gain: 0.05 });
        }
        if (d > 95) farT += dt; else farT = 0;
        hud();
        if (farT > 7) { ctx.fail('The getaway car escaped! Try again — use your web to keep up!'); return; }
        if (caught >= 1) {
          const roofSpot = () => pos().clone().add(V(0, 1.5, 0));
          ctx.finish('done', [
            { text: 'SCREEEECH! The getaway car spins to a stop!', cam: orbit(() => pos().clone().add(V(0, 1, 0)), 10, 4, heading + 1.2, heading + 2.4), snap: true, dur: 3.5,
              update: (u, dt) => {
                speed *= Math.pow(0.15, dt);
                const p2 = pos();
                p2.x += Math.sin(heading) * speed * dt;
                p2.z += Math.cos(heading) * speed * dt;
                car.group.rotation.y += speed * dt * 0.12;
              } },
            { who: NINJA, text: "Hmph. You're faster than you look, hero.", snap: true,
              enter: () => {
                car.driver.visible = false;
                ninja.group.position.copy(roofSpot());
                ninja.group.rotation.y = Math.atan2(hero.position.x - pos().x, hero.position.z - pos().z);
                ninja.group.visible = true;
                puff(roofSpot().add(V(0, 1, 0)), 0.8);
              },
              cam: () => {
                const f = V(Math.sin(ninja.group.rotation.y), 0, Math.cos(ninja.group.rotation.y));
                return { pos: roofSpot().addScaledVector(f, 5).add(V(0, 2.4, 0)), look: roofSpot().add(V(0, 1.9, 0)) };
              } },
            { who: NINJA, text: 'Come to the old PLAZA if you want a real fight. I will be waiting!' },
            { text: 'POOF! He vanished in a cloud of smoke!', dur: 3,
              enter: () => { ninja.group.visible = false; puff(roofSpot().add(V(0, 1, 0)), 1.2); } },
            { who: KAI, text: "The plaza? It's a trap for sure... but you HAVE to stop him. Be careful!", cam: phoneCam(), snap: true },
          ]);
        }
      },
      cleanup() { scene.remove(car.group); scene.remove(ninja.group); },
    };
  }

  // =====================================================================
  // Mission 3 — Shadow Ninja (henchman fight at the plaza arena)
  // =====================================================================
  function missionNinja(ctx) {
    const N = makeNinja(THREE);
    const g = N.group;
    g.position.set(ARENA.x, 0.03, ARENA.z);
    scene.add(g);
    const MAX = 330;
    const nj = { hp: MAX, state: 'idle', t: 0, cd: 1.5, attack: null, dir: V(), hit: false, flash: 0, phase: 0, strafe: 1, gone: false };
    const stars = [];
    let phase = 'travel'; // travel -> fight -> over
    let leaveT = 0;
    const pose = { shL: 0, shR: 0, elL: -0.2, elR: -0.2, hipL: 0, hipR: 0, knL: 0, knR: 0, lean: 0, crouch: 0 };
    function setPose(p, k) {
      for (const key of Object.keys(p)) pose[key] += (p[key] - pose[key]) * Math.min(1, k);
      N.arms[0].sh.rotation.x = pose.shL; N.arms[1].sh.rotation.x = pose.shR;
      N.arms[0].el.rotation.x = pose.elL; N.arms[1].el.rotation.x = pose.elR;
      N.legs[0].hip.rotation.x = pose.hipL; N.legs[1].hip.rotation.x = pose.hipR;
      N.legs[0].knee.rotation.x = pose.knL; N.legs[1].knee.rotation.x = pose.knR;
      N.body.rotation.x = pose.lean;
      N.body.position.y = pose.crouch;
    }
    const IDLE = { shL: 0.2, shR: -0.9, elL: -0.5, elR: -0.9, hipL: -0.25, hipR: 0.25, knL: 0.35, knR: 0.35, lean: 0.12, crouch: -0.1 };
    const KNEEL = { shL: 0.3, shR: 0.3, elL: -0.3, elR: -0.3, hipL: -1.5, hipR: 0.2, knL: 1.6, knR: 2.0, lean: 0.35, crouch: -0.55 };
    const center = V(ARENA.x, 0, ARENA.z);
    const head = () => g.position.clone().add(V(0, 2.0, 0));
    function face(dt, rate = 8) {
      const want = Math.atan2(hero.position.x - g.position.x, hero.position.z - g.position.z);
      g.rotation.y += angDiff(want, g.rotation.y) * Math.min(1, dt * rate);
    }
    function clampArena(p) {
      const dx = p.x - ARENA.x, dz = p.z - ARENA.z, d = Math.hypot(dx, dz), max = ARENA.r - 2;
      if (d > max) { p.x = ARENA.x + dx / d * max; p.z = ARENA.z + dz / d * max; return true; }
      return false;
    }
    function teleportBehindHero(dist = 3) {
      puff(g.position.clone().add(V(0, 1, 0)), 0.7);
      const f = V(Math.sin(hero.rotation.y), 0, Math.cos(hero.rotation.y));
      g.position.set(hero.position.x - f.x * dist, 0.03, hero.position.z - f.z * dist);
      clampArena(g.position);
      g.rotation.y = Math.atan2(hero.position.x - g.position.x, hero.position.z - g.position.z);
      puff(g.position.clone().add(V(0, 1, 0)), 0.7);
    }
    function throwStars() {
      const from = g.position.clone().add(V(0, 1.6, 0));
      const to = hero.position.clone().add(V(0, -0.3, 0));
      const base = to.clone().sub(from).normalize();
      for (const off of [-0.22, 0, 0.22]) {
        const dir = base.clone().applyAxisAngle(V(0, 1, 0), off);
        const m = new THREE.Group();
        const sm = std(THREE, 0xc9ced8, { metalness: 0.9, roughness: 0.25 });
        for (let i = 0; i < 2; i++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.12), sm);
          blade.rotation.y = i * Math.PI / 2;
          m.add(blade);
        }
        m.position.copy(from);
        scene.add(m);
        stars.push({ m, vel: dir.multiplyScalar(22), life: 2.2 });
      }
      api.playTone({ freq: 1600, freqEnd: 900, duration: 0.15, type: 'square', gain: 0.06 });
    }
    function startAttack(a) {
      nj.attack = a;
      nj.state = 'windup';
      nj.t = a === 'stars' ? 0.7 : a === 'tele' ? 0.55 : 0.65;
      if (a === 'tele') {
        teleportBehindHero(3.2);
        nj.attack = 'slash';
      }
      api.playTone({ freq: 220, freqEnd: 330, duration: 0.25, type: 'sawtooth', gain: 0.08 });
    }
    function hud() {
      setBoss([{ name: NINJA, hp: Math.max(0, nj.hp), max: MAX }]);
      setHud({
        title: 'MISSION 3: SHADOW NINJA',
        objective: 'Defeat the Shadow Ninja! When your danger sense flashes — DODGE!',
        warn: leaveT > 0 ? `Get back to the plaza! ${Math.ceil(6 - leaveT)}` : '',
      });
    }
    function clearStars() { for (const s of stars.splice(0)) scene.remove(s.m); }

    function lose(how) {
      phase = 'over';
      clearStars();
      const down = how === 'down';
      const hc = () => V(hero.position.x, 0.5, hero.position.z);
      const shots = [];
      if (down) {
        shots.push({ text: 'The hero is knocked down!', snap: true, cam: orbit(hc, 5, 2.2, g.rotation.y + 1, g.rotation.y + 1.8),
          enter: () => {
            api.heroRig.flip.rotation.x = -Math.PI / 2;
            hero.position.y = 0.45;
            // ninja steps up next to the hero
            const f = V(hero.position.x - g.position.x, 0, hero.position.z - g.position.z).normalize();
            g.position.set(hero.position.x - f.x * 2.2, 0.03, hero.position.z - f.z * 2.2);
            g.rotation.y = Math.atan2(f.x, f.z);
            setPose(IDLE, 1);
          } });
        shots.push({ who: NINJA, text: 'Too slow, hero. MUCH too slow.',
          cam: () => {
            const f = V(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
            return { pos: g.position.clone().addScaledVector(f, 3.8).add(V(0.8, 1.2, 0)), look: head() };
          } });
      } else {
        shots.push({ who: NINJA, text: 'Running away? Ha! I knew you were scared.', snap: true,
          cam: () => ({ pos: head().add(V(Math.sin(g.rotation.y) * 4, 0.6, Math.cos(g.rotation.y) * 4)), look: head() }) });
      }
      shots.push({ who: NINJA, text: 'Go tell your little city... the Boss is coming!' });
      shots.push({ text: 'POOF! The Shadow Ninja escaped...', dur: 3, enter: () => { puff(g.position.clone().add(V(0, 1, 0)), 1.2); g.visible = false; } });
      shots.push({ who: KAI, text: "Are you okay?! He got away... but don't worry. We'll get him next time. I promise!",
        cam: down ? orbit(hc, 6, 3, 0.3, 1.0) : phoneCam(),
        update: (u) => {
          if (down && u > 0.6) { api.heroRig.flip.rotation.x = 0; hero.position.y = 1.5; }
        } });
      ctx.finish('lost', shots);
    }
    function win() {
      phase = 'over';
      clearStars();
      nj.state = 'beaten';
      const closeCam = () => {
        const f = V(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
        return { pos: g.position.clone().addScaledVector(f, 3.6).add(V(0.9, 1.0, 0)), look: g.position.clone().add(V(0, 1.2, 0)) };
      };
      ctx.finish('won', [
        { text: 'The Shadow Ninja drops to one knee!', snap: true, cam: orbit(() => g.position.clone().add(V(0, 1, 0)), 6, 2.5, g.rotation.y, g.rotation.y + 1.2),
          update: (u, dt) => setPose(KNEEL, dt * 6) },
        { who: NINJA, text: 'Impossible... YOU beat ME?!', cam: closeCam, update: (u, dt) => setPose(KNEEL, dt * 6) },
        { who: NINJA, text: 'It does not matter. The Boss has three more of us...' },
        { who: NINJA, text: '...and the Boss is much CLOSER to you than you think!' },
        { text: 'POOF! He vanished in a cloud of smoke!', dur: 3, enter: () => { puff(g.position.clone().add(V(0, 1, 0)), 1.2); g.visible = false; } },
        { who: KAI, text: 'You WON! That was AMAZING!', cam: phoneCam(), snap: true },
        { who: KAI, text: 'Wait... what did he mean, "closer than you think"?' },
      ]);
    }
    function startFight() {
      phase = 'fight';
      setTarget(null);
      api.healHero();
      const f = () => V(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
      ctx.play([
        { who: NINJA, text: 'So... you came. Brave. Or foolish.', snap: true,
          enter: () => { g.rotation.y = Math.atan2(hero.position.x - g.position.x, hero.position.z - g.position.z); },
          cam: () => ({ pos: g.position.clone().addScaledVector(f(), 4).add(V(0.7, 2.2, 0)), look: head() }) },
        { who: NINJA, text: "Let's see if you can keep up!", update: (u, dt) => setPose({ ...IDLE, shR: -2.6, elR: -0.3 }, dt * 6) },
      ], () => { nj.state = 'chase'; nj.cd = 1.2; hud(); });
    }

    return {
      debug: { nj, g, get phase() { return phase; } },
      begin() {
        setTarget(V(ARENA.x, 0, ARENA.z));
        const a = Math.atan2(hero.position.z - ARENA.z, hero.position.x - ARENA.x);
        ctx.play([
          ...phone([
            'This is it. The Shadow Ninja is waiting for you at the plaza.',
            'He is super fast and he can TELEPORT. Listen to your danger sense and DODGE!',
          ]),
          { text: 'Swing to the plaza ⭐ to face the Shadow Ninja.', snap: true, cam: orbit(V(ARENA.x, 1, ARENA.z), 18, 7, a - 0.6, a + 0.3) },
        ], () => setHud({ title: 'MISSION 3: SHADOW NINJA', objective: 'Swing to the plaza ⭐ — the Shadow Ninja is waiting' }));
      },
      anim(dt, t) {
        N.scarf.rotation.x = 0.4 + Math.sin(t * 6) * 0.15;
        if (nj.flash > 0) nj.flash -= dt;
        for (const m of N.flashMats) m.emissive.setHex(nj.flash > 0 ? 0x661111 : 0x000000);
        if (phase === 'travel' || nj.state === 'idle') {
          face(dt, 2);
          setPose({ ...IDLE, crouch: -0.1 + Math.sin(t * 2) * 0.03 }, dt * 4);
        }
      },
      update(dt, t) {
        if (phase === 'travel') {
          const d = Math.hypot(hero.position.x - ARENA.x, hero.position.z - ARENA.z);
          if (d < ARENA.r - 2 && hero.position.y < 9) startFight();
          return;
        }
        if (phase !== 'fight' || nj.state === 'idle') return;
        const dx = hero.position.x - g.position.x, dz = hero.position.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        switch (nj.state) {
          case 'chase': {
            face(dt);
            const sp = dist > 4.5 ? 9 : 0;
            if (sp) { g.position.x += dx / dist * sp * dt; g.position.z += dz / dist * sp * dt; }
            else { // circle around the hero
              g.position.x += (-dz / dist) * nj.strafe * 4 * dt;
              g.position.z += (dx / dist) * nj.strafe * 4 * dt;
            }
            clampArena(g.position);
            nj.phase += dt * (sp ? 12 : 7);
            const s = Math.sin(nj.phase) * 0.7;
            setPose({ shL: -s * 0.8, shR: -0.9, elL: -0.6, elR: -0.9, hipL: s, hipR: -s, knL: Math.max(0, s) * 1.1, knR: Math.max(0, -s) * 1.1, lean: 0.3, crouch: -0.08 }, dt * 12);
            if ((nj.cd -= dt) <= 0) {
              const r = Math.random();
              startAttack(dist < 9 ? (r < 0.55 ? 'slash' : r < 0.78 ? 'tele' : 'stars') : (r < 0.45 ? 'stars' : r < 0.8 ? 'tele' : 'slash'));
            }
            break;
          }
          case 'windup':
            face(dt, 10);
            setPose(nj.attack === 'stars'
              ? { shL: 0.3, shR: -2.6, elL: -0.4, elR: -0.5, hipL: -0.4, hipR: 0.3, knL: 0.5, knR: 0.3, lean: -0.1, crouch: -0.15 }
              : { shL: 0.5, shR: -2.8, elL: -0.6, elR: -0.2, hipL: -0.7, hipR: 0.5, knL: 0.9, knR: 0.4, lean: 0.35, crouch: -0.35 }, dt * 10);
            if ((nj.t -= dt) <= 0) {
              if (nj.attack === 'stars') { throwStars(); nj.state = 'recover'; nj.t = 0.6; }
              else {
                nj.state = 'dash';
                nj.t = 0.42;
                nj.hit = false;
                nj.dir.set(dx, 0, dz).normalize();
                api.playNoise({ duration: 0.25, gain: 0.2, filterFreq: 2500 });
              }
            }
            break;
          case 'dash': {
            g.position.addScaledVector(nj.dir, 26 * dt);
            const wall = clampArena(g.position);
            setPose({ shL: 0.6, shR: 1.2, elL: -0.4, elR: -0.1, hipL: -0.9, hipR: 0.7, knL: 0.6, knR: 0.3, lean: 0.5, crouch: -0.3 }, dt * 18);
            if (Math.random() < 0.6) api.spawnBurst(g.position.clone().add(V(0, 1.2, 0)), 0x1a1c22, 2, { speed: 1, life: 0.35, gravity: 0, size: 1.4 });
            const d2 = Math.hypot(hero.position.x - g.position.x, hero.position.z - g.position.z);
            if (!nj.hit && d2 < 2.2 && hero.position.y - 1.5 < 2.5) {
              nj.hit = true;
              api.damagePlayer(14, nj.dir.clone(), 10);
              api.spawnBurst(hero.position.clone(), 0xff3344, 8, { speed: 6, life: 0.3, size: 0.6 });
            }
            if ((nj.t -= dt) <= 0 || wall) { nj.state = 'recover'; nj.t = 0.7; }
            break;
          }
          case 'recover':
            face(dt, 4);
            setPose(IDLE, dt * 8);
            if ((nj.t -= dt) <= 0) { nj.state = 'chase'; nj.cd = rand(1.0, 1.8); nj.strafe = Math.random() < 0.5 ? 1 : -1; }
            break;
          default: break;
        }
        // throwing stars
        let starDanger = false;
        for (let i = stars.length - 1; i >= 0; i--) {
          const s = stars[i];
          s.m.position.addScaledVector(s.vel, dt);
          s.m.rotation.y += dt * 20;
          s.life -= dt;
          const toHero = hero.position.clone().sub(s.m.position);
          if (toHero.length() < 12 && toHero.dot(s.vel) > 0) starDanger = true;
          if (toHero.length() < 1.2) {
            scene.remove(s.m);
            stars.splice(i, 1);
            api.damagePlayer(9, s.vel.clone().normalize(), 4);
            if (phase !== 'fight') return; // knocked out: the lose scene took over
            continue;
          }
          if (s.life <= 0) { scene.remove(s.m); stars.splice(i, 1); }
        }
        if (phase !== 'fight') return; // damagePlayer may have ended the fight
        setDanger(nj.state === 'windup' || nj.state === 'dash' || starDanger);
        // keep the hero from walking through the ninja
        if (dist < 1.1 && dist > 0.001 && hero.position.y - 1.5 < 2.4) {
          hero.position.x = g.position.x + dx / dist * 1.1;
          hero.position.z = g.position.z + dz / dist * 1.1;
        }
        const fromCenter = Math.hypot(hero.position.x - ARENA.x, hero.position.z - ARENA.z);
        if (fromCenter > ARENA.r + 18) leaveT += dt; else leaveT = 0;
        hud();
        if (leaveT > 6) lose('left');
      },
      punch(range) {
        if (phase !== 'fight' || !['chase', 'windup', 'dash', 'recover'].includes(nj.state)) return 0;
        const d = Math.hypot(hero.position.x - g.position.x, hero.position.z - g.position.z);
        const dy = hero.position.y - 1.5 - g.position.y;
        if (d > range + 0.4 || dy < -2 || dy > 3) return 0;
        // sometimes he vanishes before your punch lands
        if ((nj.state === 'chase' || nj.state === 'recover') && nj.hp > 60 && Math.random() < 0.18) {
          teleportBehindHero(5);
          api.showMsg('Too slow!', 900);
          nj.state = 'recover';
          nj.t = 0.4;
          return 0;
        }
        nj.hp -= 22;
        nj.flash = 0.15;
        api.spawnBurst(g.position.clone().add(V(0, 1.4, 0)), 0xffe066, 8, { speed: 6, life: 0.35, size: 0.7 });
        const k = V(g.position.x - hero.position.x, 0, g.position.z - hero.position.z).normalize().multiplyScalar(1.6);
        g.position.add(k);
        clampArena(g.position);
        if (nj.state === 'windup' && Math.random() < 0.5) { nj.state = 'recover'; nj.t = 0.5; } // punch can interrupt
        hud();
        if (nj.hp <= 0) win();
        return 1;
      },
      dodgeDir(side) {
        if (phase !== 'fight') return null;
        const away = V(hero.position.x - g.position.x, 0, hero.position.z - g.position.z).normalize();
        const s = V(-away.z, 0, away.x).multiplyScalar(side >= 0 ? 1 : -1);
        return s.multiplyScalar(0.8).addScaledVector(away, 0.6).normalize();
      },
      heroDown() {
        if (phase !== 'fight') return false;
        lose('down');
        return true;
      },
      cleanup() {
        clearStars();
        scene.remove(g);
        api.heroRig.flip.rotation.x = 0;
        if (hero.position.y < 1.5) hero.position.y = 1.5;
      },
    };
  }

  const FACTORIES = [missionFire, missionChase, missionNinja];

  return {
    get inCutscene() { return !!cut; },
    get active() { return !!mission; },
    get markers() { return target ? [{ x: target.x, z: target.z }] : []; },
    get progress() { return progress; },
    get mission() { return mission; }, // for the ?debug test hook
    update(dt, t) {
      if (bannerT > 0 && (bannerT -= dt) <= 0) setUi({ banner: null });
      updatePuffs(dt);
      if (beacon.visible) beacon.material.opacity = 0.18 + Math.sin(t * 4) * 0.08;
      if (mission && mission.anim) mission.anim(dt, t);
      if (cut) { updateCut(dt); return; }
      if (mission && !mission.ending) mission.update(dt, t);
      updatePhone(dt);
    },
    advance() { if (cut && cut.t > 0.3) nextShot(); },
    skip() {
      if (!cut) return;
      const s = cut.shots;
      // run every remaining shot's enter/update so the scene ends in the right state
      for (let i = cut.i + 1; i < s.length; i++) if (s[i].enter) s[i].enter();
      for (let i = cut.i; i < s.length; i++) if (s[i].update) s[i].update(1, 0.016);
      if (!cut) return;
      cut.i = s.length - 1;
      nextShot();
    },
    answerCall() { if (call) { call = null; setUi({ call: null }); startMission(progress.next); } },
    declineCall() { if (call) { call = null; setUi({ call: null }); freeT = -40; } },
    startMission,
    quitMission() {
      if (!mission || mission.ending || cut) return;
      endMission();
      api.showMsg('Mission quit', 1500);
    },
    retry() { const r = ui.result; setUi({ result: null }); if (r) startMission(r.n - 1); },
    closeResult() { setUi({ result: null }); freeT = 0; },
    punch(range) { return mission && !mission.ending && mission.punch ? mission.punch(range) : 0; },
    dodgeDir(side) { return mission && mission.dodgeDir ? mission.dodgeDir(side) : null; },
    heroDown() { return !!(mission && !mission.ending && mission.heroDown && mission.heroDown()); },
  };
}
