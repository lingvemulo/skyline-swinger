// Story mode part 2: missions 4-13. Storm Master (4-6), Mech Pilot (7-9),
// Fire Monster (10-12) and the finale (13), where Kai turns out to be the Boss.
//
// Each mission is a factory (ctx) => { begin, anim, update, cleanup, punch?,
// dodgeDir?, heroDown? } like missions 1-3 in story.js. Shared building
// blocks live here: rescuers (people to save), building fires, runners
// (things you chase), and a fight kit + fighter AI used by every henchman.

import { ARENA } from './bosses.js';
import { rand, pick, angDiff, std, joint, part, makePerson, makeNinja } from './story-kit.js';
import { peopleReady, makeRealPerson } from './people.js';
import { rockMaterial, metalMaterial, lavaMaterial } from './surfaces.js';

const KAI = '📱 KAI';
const YOU = '🦸 YOU';
const topOf = (b) => b.position.y + b.geometry.parameters.height / 2;

// =====================================================================
// shared helpers
// =====================================================================
function pickBuilding(ctx, o = {}) {
  const { api, hero } = ctx;
  const { minH = 18, maxH = 42, minD = 45, maxD = 120, from = hero.position, exclude = [] } = o;
  const ok = (b, h0, h1, d0, d1) => {
    const h = b.geometry.parameters.height;
    if (h <= 2 || exclude.includes(b) || h < h0 || h > h1) return false;
    const d = Math.hypot(b.position.x - from.x, b.position.z - from.z);
    return d > d0 && d < d1;
  };
  let c = api.buildings.filter(b => ok(b, minH, maxH, minD, maxD));
  if (!c.length) c = api.buildings.filter(b => ok(b, 14, 55, 0, 1e9));
  return pick(c);
}

// a random spot on a roof (away from the stair hut in the +x/+z corner) and
// the point just off the nearest edge where a rescued person hops to
function roofSpot(ctx, b, taken = []) {
  const { V } = ctx;
  const P = b.geometry.parameters, cx = b.position.x, cz = b.position.z, hw = P.width / 2, hd = P.depth / 2, top = topOf(b);
  let x = cx, z = cz;
  for (let i = 0; i < 25; i++) {
    x = cx + rand(-hw + 1.2, hw - 1.2);
    z = cz + rand(-hd + 1.2, hd - 1.2);
    if (x > cx + hw - 3.4 && z > cz + hd - 3.4) continue;
    if (taken.some(p => Math.hypot(p.x - x, p.z - z) < 1.8)) continue;
    break;
  }
  const dx = x - cx, dz = z - cz;
  const useX = Math.abs(dx) / hw > Math.abs(dz) / hd;
  const edge = useX ? V(cx + Math.sign(dx || 1) * (hw + 1.6), top, z) : V(x, top, cz + Math.sign(dz || 1) * (hd + 1.6));
  return { pos: V(x, top, z), edge };
}

// people waiting to be saved: touch one and they float down on a web parachute
function rescuers(ctx, root, spots) {
  const { THREE, V, api, hero } = ctx;
  const people = spots.map(sp => {
    const pp = makePerson(THREE);
    pp.group.position.copy(sp.pos);
    pp.group.rotation.y = sp.facing !== undefined ? sp.facing : rand(0, Math.PI * 2);
    root.add(pp.group);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    arrow.rotation.x = Math.PI;
    arrow.position.y = 2.6;
    pp.group.add(arrow);
    return { ...pp, arrow, home: sp.pos.clone(), edge: sp.edge.clone(), state: 'wait', t: 0, ph: Math.random() * 6 };
  });
  let saved = 0;
  function launch(p) {
    p.state = 'hop';
    p.t = 0;
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
  return {
    people,
    get saved() { return saved; },
    get total() { return people.length; },
    waiting() { return people.filter(p => p.state === 'wait'); },
    check() {
      const feet = hero.position.y - 1.5;
      for (const p of people) {
        if (p.state !== 'wait') continue;
        if (Math.hypot(hero.position.x - p.home.x, hero.position.z - p.home.z) < 2.4 && Math.abs(feet - p.home.y) < 2.5) {
          launch(p);
          saved++;
          api.playTone({ freq: 700, freqEnd: 1300, duration: 0.2, type: 'triangle', gain: 0.14 });
          api.showMsg(saved < people.length ? `Saved! ${people.length - saved} to go` : 'Everyone is safe!', 1400);
        }
      }
    },
    center() {
      const c = V();
      for (const p of people) c.add(p.group.position);
      return c.multiplyScalar(1 / Math.max(1, people.length));
    },
    anim(dt, t) {
      for (const p of people) {
        const g = p.group;
        if (p.update) p.update(dt, p.state);
        if (p.state === 'wait') {
          p.armR.rotation.z = 2.5 + Math.sin(t * 7 + p.ph) * 0.4;
          p.armL.rotation.z = -2.5 - Math.sin(t * 7 + p.ph) * 0.4;
          p.arrow.position.y = 2.6 + Math.sin(t * 4 + p.ph) * 0.25;
          p.arrow.rotation.y += dt * 3;
        } else if (p.state === 'hop') {
          p.t += dt;
          const u = Math.min(1, p.t / 0.7);
          g.position.lerpVectors(p.home, p.edge, u);
          g.position.y = p.home.y + Math.sin(u * Math.PI) * 1.2;
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
          g.position.y = Math.abs(Math.sin(t * 6 + p.ph)) * 0.35;
          p.armL.rotation.z = -2.7 - Math.sin(t * 12 + p.ph) * 0.2;
          p.armR.rotation.z = 2.7 + Math.sin(t * 12 + p.ph) * 0.2;
        }
      }
    },
  };
}

// flames up the walls and along the roof edges, plus a column of smoke
function buildingFire(ctx, root, b) {
  const { THREE, tex } = ctx;
  const P = b.geometry.parameters;
  const top = topOf(b), cx = b.position.x, cz = b.position.z, hw = P.width / 2, hd = P.depth / 2;
  const flames = [];
  const fireMat = new THREE.SpriteMaterial({ map: tex.fire, transparent: true, depthWrite: false, fog: false });
  const add = (x, y, z, s) => {
    const sp = new THREE.Sprite(fireMat);
    sp.position.set(x, y, z);
    root.add(sp);
    flames.push({ sp, s, ph: Math.random() * 10 });
  };
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 0; i < 6; i++) {
      const along = rand(-0.85, 0.85);
      add(cx + nx * (hw + 0.5) + (nz ? along * hw : 0), rand(0.4, 0.97) * top, cz + nz * (hd + 0.5) + (nx ? along * hd : 0), rand(3.5, 6.5));
    }
  }
  for (let i = 0; i < 8; i++) {
    const edge = i % 2 === 0;
    add(cx + (edge ? pick([-1, 1]) * hw * 0.95 : rand(-hw, hw) * 0.9), top + 2, cz + (edge ? rand(-hd, hd) * 0.9 : pick([-1, 1]) * hd * 0.95), rand(3.5, 5));
  }
  const smoke = [];
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.darkSmoke, transparent: true, depthWrite: false }));
    root.add(sp);
    smoke.push({ sp, y: rand(0, 22) });
  }
  const fire = {
    b, top, cx, cz, hw, hd, out: 0,
    center: () => ctx.V(cx, top, cz),
    anim(dt, t) {
      for (const f of flames) {
        const k = (1 - fire.out) * (0.8 + Math.sin(t * 11 + f.ph) * 0.15 + Math.sin(t * 23 + f.ph * 2) * 0.08);
        f.sp.scale.set(f.s * k, f.s * k * 1.7, 1);
      }
      for (const s of smoke) {
        s.y += dt * 3.5;
        if (s.y > 24) s.y = 0;
        s.sp.position.set(cx + Math.sin(s.y * 0.3 + s.sp.id) * 2, top + 2 + s.y, cz + Math.cos(s.y * 0.25 + s.sp.id) * 2);
        s.sp.scale.setScalar(4 + s.y * 0.7);
        s.sp.material.opacity = (1 - fire.out) * 0.85 * (1 - s.y / 24);
      }
    },
  };
  return fire;
}

// something that drives/flies away from the hero, steering around buildings
function runner(ctx, obj, o = {}) {
  const { api, hero } = ctx;
  const { speed: topSpeed = 15.5, alt = null } = o;
  const CITY = api.CITY_SIZE;
  const solid = api.buildings.filter(b => b.geometry.parameters.height > 2 && (alt === null || topOf(b) > alt - 4));
  function blocked(x, z, m) {
    if (Math.abs(x) > CITY - 10 || Math.abs(z) > CITY - 10) return true;
    for (const b of solid) {
      const p = b.geometry.parameters;
      if (Math.abs(x - b.position.x) < p.width / 2 + m && Math.abs(z - b.position.z) < p.depth / 2 + m) return true;
    }
    return false;
  }
  let heading = 0, speed = 0, stuckT = 0;
  const last = obj.position.clone();
  const r = {
    get heading() { return heading; },
    get speed() { return speed; },
    set speed(v) { speed = v; },
    blocked,
    place(d0 = 30, d1 = 45) {
      let x = 0, z = 0;
      for (let i = 0; i < 80; i++) {
        const a = rand(0, Math.PI * 2), d = rand(d0, d1);
        x = hero.position.x + Math.cos(a) * d;
        z = hero.position.z + Math.sin(a) * d;
        if (!blocked(x, z, 3)) break;
      }
      heading = Math.atan2(x - hero.position.x, z - hero.position.z);
      obj.position.set(x, alt === null ? 0.02 : alt, z);
      obj.rotation.y = heading;
      last.copy(obj.position);
      speed = 0;
    },
    drive(dt, flee = true) {
      const p = obj.position;
      let want = heading;
      if (flee && Math.hypot(hero.position.x - p.x, hero.position.z - p.z) < 55) {
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
      const target = topSpeed - Math.min(7, Math.abs(diff) * 7);
      speed += (target - speed) * Math.min(1, dt * 1.5);
      const nx = p.x + Math.sin(heading) * speed * dt, nz = p.z + Math.cos(heading) * speed * dt;
      if (!blocked(nx, nz, 1.2) || blocked(p.x, p.z, 1.2)) { p.x = nx; p.z = nz; } else { heading += 12 * dt; speed *= 0.5; }
      stuckT += dt;
      if (stuckT > 1.5) {
        if (p.distanceTo(last) < 3) {
          const opts = [0, 1, 2, 3, 4, 5, 6, 7].map(k => k * Math.PI / 4).filter(clear);
          heading = opts.length ? pick(opts) : heading + Math.PI;
        }
        stuckT = 0;
        last.copy(p);
      }
      obj.rotation.y = heading;
      return diff;
    },
  };
  return r;
}

// a chase mission: stay close to the runner until the CATCH bar fills
function chaseMission(ctx, cfg) {
  const { V, api, hero, scene } = ctx;
  const obj = cfg.obj;
  scene.add(obj);
  const r = runner(ctx, obj, { speed: cfg.speed, alt: cfg.alt });
  r.place();
  let caught = 0, farT = 0;
  const pos = () => obj.position;
  const c = { r, obj, pos, chaseCam: () => {
    const p = pos(), f = V(Math.sin(r.heading), 0, Math.cos(r.heading));
    const up = cfg.alt === null ? 3.5 : 5;
    return { pos: p.clone().addScaledVector(f, -10).add(V(0, up, 0)), look: p.clone().addScaledVector(f, 4).add(V(0, 1, 0)) };
  } };
  function hud() {
    ctx.setHud({
      title: cfg.title,
      objective: cfg.objective,
      meter: { label: 'CATCH', value: Math.min(1, caught) },
      warn: farT > 0 ? `It's getting away! ${Math.ceil(7 - farT)}` : '',
    });
  }
  return {
    debug: { obj, get caught() { return caught; } },
    begin() {
      ctx.play(cfg.intro(c), () => {
        if (Math.hypot(pos().x - hero.position.x, pos().z - hero.position.z) > 50) r.place();
        hud();
      });
    },
    anim(dt, t) { if (cfg.anim) cfg.anim(dt, t, c); },
    update(dt, t) {
      r.drive(dt);
      if (cfg.tick) cfg.tick(dt, t, c);
      ctx.setTarget(pos().clone());
      const p = pos();
      const d = Math.hypot(hero.position.x - p.x, hero.position.z - p.z);
      const dy = cfg.alt === null ? hero.position.y - 1.5 - p.y : Math.abs(hero.position.y - p.y);
      if (d < (cfg.catchDist || 9) && dy < (cfg.dyMax || 8)) {
        caught += dt / 3.5;
        if (Math.random() < dt * 3) api.playTone({ freq: 900 + caught * 600, duration: 0.05, type: 'square', gain: 0.05 });
      }
      if (d > 95) farT += dt; else farT = 0;
      hud();
      if (farT > 7) { ctx.fail(cfg.failText); return; }
      if (caught >= 1) ctx.finish('done', cfg.outro(c));
    },
    cleanup() { scene.remove(obj); if (cfg.cleanup) cfg.cleanup(); },
  };
}

// lightning bolt from the sky down to a point
function bolt(ctx, root, to) {
  const { THREE, V, api } = ctx;
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push(V(to.x + (i && i < 8 ? rand(-1.5, 1.5) : 0), to.y + (1 - u) * 45, to.z + (i && i < 8 ? rand(-1.5, 1.5) : 0)));
  }
  const m = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 24, 0.22, 5, false),
    new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 1, fog: false })
  );
  root.add(m);
  let life = 0.3;
  const id = setInterval(() => {
    life -= 0.05;
    m.material.opacity = Math.max(0, life / 0.3);
    if (life <= 0) { clearInterval(id); root.remove(m); m.geometry.dispose(); }
  }, 50);
  api.spawnBurst(to.clone().add(V(0, 0.5, 0)), 0xbfe8ff, 14, { speed: 8, life: 0.5, size: 0.9 });
  api.playNoise({ duration: 0.7, gain: 0.4, filterFreq: 600 });
  api.triggerShake(0.25, 0.25);
}

// =====================================================================
// fight kit: projectiles, shockwave rings, telegraphed strikes, ground hazards
// =====================================================================
function fightKit(ctx, zone) {
  const { THREE, scene, api, hero, V } = ctx;
  const root = new THREE.Group();
  scene.add(root);
  const ringGeo = new THREE.RingGeometry(0.93, 1.0, 72);
  const F = { zone, root, over: false, projectiles: [], rings: [], strikes: [], hazards: [] };
  F.feet = () => hero.position.y - 1.5;
  F.inZone = (p, pad = 0) => zone.shape === 'circle'
    ? Math.hypot(p.x - zone.x, p.z - zone.z) < zone.r + pad
    : Math.abs(p.x - zone.x) < zone.r + pad && Math.abs(p.z - zone.z) < zone.r + pad;
  F.clamp = (p, m = 2) => {
    if (zone.shape === 'circle') {
      const dx = p.x - zone.x, dz = p.z - zone.z, d = Math.hypot(dx, dz), max = zone.r - m;
      if (d > max) { p.x = zone.x + dx / d * max; p.z = zone.z + dz / d * max; return true; }
      return false;
    }
    const lim = zone.r - m;
    const cx = Math.max(zone.x - lim, Math.min(zone.x + lim, p.x)), cz = Math.max(zone.z - lim, Math.min(zone.z + lim, p.z));
    const hit = cx !== p.x || cz !== p.z;
    p.x = cx; p.z = cz;
    return hit;
  };
  F.hurt = (amount, from, force = 6) => {
    if (F.over) return;
    const dir = V(hero.position.x - from.x, 0, hero.position.z - from.z);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    api.damagePlayer(amount, dir.normalize(), force);
    if (!F.over) api.heroVel.y = Math.max(api.heroVel.y, force * 0.4);
  };
  F.shoot = (o) => {
    o.mesh.position.copy(o.from);
    root.add(o.mesh);
    F.projectiles.push({ gravity: 0, dmg: 10, r: 1.2, life: 3, spin: 0, groundY: zone.y, ...o });
  };
  F.shockwave = (center, maxR, speed, dmg, color = 0xffa040) => {
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, zone.y + 0.15, center.z);
    root.add(mesh);
    F.rings.push({ mesh, x: center.x, z: center.z, r: 0.5, maxR, speed, dmg, hit: false });
  };
  F.strike = (o) => {
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: o.color || 0xff3030, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(o.pos.x, o.pos.y + 0.12, o.pos.z);
    mesh.scale.setScalar(o.r || 3);
    root.add(mesh);
    F.strikes.push({ r: 3, dmg: 15, ...o, t: o.delay || 1, mesh });
  };
  F.hazard = (o) => {
    root.add(o.mesh);
    F.hazards.push({ r: 2, dmg: 6, life: 5, tick: 0.5, cd: 0, ...o });
  };
  // a burning puddle on the ground
  F.firePool = (pos, life = 5, r = 2.2) => {
    const mesh = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.75, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    mesh.add(disc);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.tex.fire, transparent: true, depthWrite: false }));
    fl.scale.set(r * 1.4, r * 2, 1);
    fl.position.y = r * 0.8;
    mesh.add(fl);
    mesh.position.set(pos.x, zone.y + 0.08, pos.z);
    F.hazard({ mesh, pos: mesh.position, r, dmg: 6, life, anim: (dt, t, h) => {
      const k = Math.min(1, h.life) * (0.85 + Math.sin(t * 13 + pos.x) * 0.15);
      fl.scale.set(r * 1.4 * k, r * 2 * k, 1);
      disc.material.opacity = 0.75 * Math.min(1, h.life);
    } });
  };
  const rm = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); root.remove(x.mesh); };
  F.update = (dt, t) => {
    let danger = false;
    const feet = F.feet();
    for (const p of F.projectiles.slice()) {
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spin) p.mesh.rotation.y += p.spin * dt;
      p.life -= dt;
      const toHero = hero.position.clone().sub(p.mesh.position);
      const dist = toHero.length();
      if (dist < 14 && toHero.dot(p.vel) > 0) danger = true;
      if (dist < p.r) {
        rm(F.projectiles, p);
        F.hurt(p.dmg, p.mesh.position, 6);
        if (F.over) return false;
      } else if (p.gravity && p.mesh.position.y <= p.groundY + 0.2) {
        rm(F.projectiles, p);
        if (p.splash) p.splash(p.mesh.position.clone());
      } else if (p.life <= 0) rm(F.projectiles, p);
    }
    for (const s of F.rings.slice()) {
      s.r += s.speed * dt;
      s.mesh.scale.setScalar(s.r);
      s.mesh.material.opacity = 0.9 * (1 - s.r / s.maxR);
      const d = Math.hypot(hero.position.x - s.x, hero.position.z - s.z);
      if (!s.hit && d > s.r && d - s.r < 9 && d < s.maxR) danger = true;
      if (!s.hit && Math.abs(d - s.r) < 1.4 && feet < zone.y + 1) {
        s.hit = true;
        F.hurt(s.dmg, { x: s.x, z: s.z }, 9);
        if (F.over) return false;
      }
      if (s.r >= s.maxR) rm(F.rings, s);
    }
    for (const k of F.strikes.slice()) {
      k.t -= dt;
      k.mesh.material.opacity = 0.35 + 0.3 * Math.sin(t * 20);
      const d = Math.hypot(hero.position.x - k.pos.x, hero.position.z - k.pos.z);
      if (d < k.r + 1.5) danger = true;
      if (k.t <= 0) {
        rm(F.strikes, k);
        if (k.onStrike) k.onStrike(k.pos);
        if (d < k.r && Math.abs(feet - k.pos.y) < 3.5) {
          F.hurt(k.dmg, k.pos, 8);
          if (F.over) return false;
        }
      }
    }
    for (const h of F.hazards.slice()) {
      h.life -= dt;
      h.cd -= dt;
      if (h.anim) h.anim(dt, t, h);
      const d = Math.hypot(hero.position.x - h.pos.x, hero.position.z - h.pos.z);
      if (h.cd <= 0 && d < h.r && feet - h.pos.y < (h.height || 1.2) && feet > h.pos.y - 1) {
        h.cd = h.tick;
        if (h.onTouch) h.onTouch(h);
        F.hurt(h.dmg, h.pos, h.force || 2);
        if (F.over) return false;
      }
      if (h.life <= 0) rm(F.hazards, h);
    }
    return danger;
  };
  F.clearAttacks = () => {
    for (const a of [F.projectiles, F.rings, F.strikes, F.hazards]) for (const x of a.splice(0)) root.remove(x.mesh);
  };
  F.dispose = () => { F.clearAttacks(); scene.remove(root); };
  return F;
}

// =====================================================================
// fighters: a model + a set of attacks, run by one shared AI
// =====================================================================
const ZERO = { shL: 0, shR: 0, elL: 0, elR: 0, hipL: 0, hipR: 0, knL: 0, knR: 0, lean: 0, crouch: 0 };
function poser(m) {
  const pose = { ...ZERO };
  return (target, k) => {
    for (const key of Object.keys(ZERO)) pose[key] += ((target[key] || 0) - pose[key]) * Math.min(1, k);
    if (m.arms[0]) { m.arms[0].sh.rotation.x = pose.shL; m.arms[0].el.rotation.x = pose.elL; }
    if (m.arms[1]) { m.arms[1].sh.rotation.x = pose.shR; m.arms[1].el.rotation.x = pose.elR; }
    if (m.legs[0]) { m.legs[0].hip.rotation.x = pose.hipL; m.legs[0].knee.rotation.x = pose.knL; }
    if (m.legs[1]) { m.legs[1].hip.rotation.x = pose.hipR; m.legs[1].knee.rotation.x = pose.knR; }
    m.body.rotation.x = pose.lean;
    m.body.position.y = pose.crouch;
  };
}
const WALK = (s, lean = 0.15) => ({ shL: -s * 0.8, shR: s * 0.8, elL: -0.5, elR: -0.5, hipL: s, hipR: -s, knL: Math.max(0, s) * 1.1, knR: Math.max(0, -s) * 1.1, lean, crouch: -Math.abs(s) * 0.08 });
const KNEEL = { shL: 0.3, shR: 0.3, elL: -0.3, elR: -0.3, hipL: -1.5, hipR: 0.2, knL: 1.6, knR: 2.0, lean: 0.35, crouch: -0.55 };

// o: { name, title, maxHp, model, radius, height, speed, keep, hover, cd: [a, b], attacks: { id: attack },
//      poses: { idle, windup: { id: pose }, act: { id: pose }, down }, crouchScale, onHurt(f) -> true to dodge, heavy }
// attack: { w(dist) -> weight, windup, start?(f), exec(f), act?(f, dt) -> done, recover, track }
function makeFighter(ctx, F, o) {
  const { V, api, hero, scene } = ctx;
  const m = o.model;
  const g = m.group;
  scene.add(g);
  const setPose = poser(m);
  const cs = o.crouchScale || 1;
  const scaled = (p) => (cs === 1 ? p : { ...p, crouch: (p.crouch || 0) * cs });
  const f = {
    name: o.name, title: o.title || o.name, maxHp: o.maxHp, hp: o.maxHp, group: g, model: m,
    radius: o.radius, height: o.height, state: 'idle', t: 0, cd: 1.5, attack: null, data: {},
    walk: 0, flash: 0, strafe: 1, moving: false, downT: 0, gone: false,
  };
  f.headPos = () => g.position.clone().add(V(0, o.height * 0.85, 0));
  f.fwd = () => V(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
  f.toHero = () => V(hero.position.x - g.position.x, 0, hero.position.z - g.position.z);
  f.dist = () => Math.hypot(hero.position.x - g.position.x, hero.position.z - g.position.z);
  f.face = (dt, rate = 6) => {
    const want = Math.atan2(hero.position.x - g.position.x, hero.position.z - g.position.z);
    g.rotation.y += angDiff(want, g.rotation.y) * Math.min(1, dt * rate);
  };
  f.ground = () => F.zone.y;
  f.closeCam = () => {
    const fw = f.fwd();
    return { pos: g.position.clone().addScaledVector(fw, 3 + o.radius * 1.6).add(V(0.8, o.height * 0.65, 0)), look: f.headPos() };
  };
  f.place = (p) => { g.position.set(p.x, F.zone.y, p.z); };
  f.vanish = () => { if (g.visible) { ctx.puff(g.position.clone().add(V(0, o.height * 0.4, 0)), Math.max(1, o.radius)); g.visible = false; } };
  f.appear = () => { g.visible = true; ctx.puff(g.position.clone().add(V(0, o.height * 0.4, 0)), Math.max(1, o.radius)); };
  f.animate = (dt, t) => {
    if (f.flash > 0) f.flash -= dt;
    for (const mat of m.flashMats || []) mat.emissive.setHex(f.flash > 0 ? 0x661111 : (mat.userData.baseEmissive || 0));
    if (o.hover) g.position.y = F.zone.y + o.hover + Math.sin(t * 2.2) * 0.25;
    const A = o.attacks[f.attack] || {};
    if (m.real && o.clips) {
      const C = o.clips;
      const clip = f.state === 'down' ? C.down
        : f.state === 'chase' ? (f.moving ? C.run : C.idle)
          : f.state === 'windup' ? ((C.windup || {})[f.attack] || C.idle)
            : f.state === 'act' ? ((C.act || {})[f.attack] || C.run)
              : C.idle;
      m.real.play(clip || 'Idle_Loop', { speed: f.state === 'act' ? 1.5 : 1 });
      m.real.update(dt);
      if (m.tick) m.tick(dt, t, f, A);
      return;
    }
    if (f.state === 'down') setPose(scaled(o.poses.down || KNEEL), dt * 5);
    else if (f.state === 'chase') setPose(scaled(WALK(Math.sin(f.walk) * (f.moving ? 0.6 : 0.12), o.lean || 0.15)), dt * 10);
    else if (f.state === 'windup') setPose(scaled((o.poses.windup || {})[f.attack] || o.poses.idle), dt * 9);
    else if (f.state === 'act') setPose(scaled((o.poses.act || {})[f.attack] || (o.poses.windup || {})[f.attack] || o.poses.idle), dt * 14);
    else setPose(scaled(o.poses.idle), dt * 5);
    if (m.tick) m.tick(dt, t, f, A);
  };
  f.update = (dt, t) => {
    const A = o.attacks[f.attack];
    const toH = f.toHero(), dist = toH.length();
    f.moving = false;
    switch (f.state) {
      case 'chase': {
        f.face(dt);
        if (dist > o.keep) {
          g.position.addScaledVector(toH.normalize(), o.speed * dt);
          f.moving = true;
        } else if (dist > 0.01) {
          g.position.x += (-toH.z / dist) * f.strafe * o.speed * 0.4 * dt;
          g.position.z += (toH.x / dist) * f.strafe * o.speed * 0.4 * dt;
          f.moving = true;
        }
        F.clamp(g.position, o.radius + 1);
        f.walk += dt * (6 + o.speed * 0.5);
        if ((f.cd -= dt) <= 0) {
          const ids = Object.keys(o.attacks);
          const ws = ids.map(id => Math.max(0, o.attacks[id].w(dist)));
          let r = Math.random() * ws.reduce((a, b) => a + b, 0);
          let id = ids[0];
          for (let i = 0; i < ids.length; i++) { r -= ws[i]; if (r <= 0) { id = ids[i]; break; } }
          f.attack = id;
          f.state = 'windup';
          f.data = {};
          const B = o.attacks[id];
          f.t = B.windup;
          if (B.start) B.start(f);
          api.playTone({ freq: 160, freqEnd: 260, duration: 0.25, type: 'sawtooth', gain: 0.07 });
        }
        break;
      }
      case 'windup':
        f.face(dt, A.track || 8);
        if ((f.t -= dt) <= 0) {
          A.exec(f);
          if (F.over) return;
          if (A.act) f.state = 'act';
          else { f.state = 'recover'; f.t = A.recover || 0.7; }
        }
        break;
      case 'act':
        if (A.act(f, dt)) { f.state = 'recover'; f.t = A.recover || 0.7; }
        if (F.over) return;
        break;
      case 'recover':
        f.face(dt, 3);
        if ((f.t -= dt) <= 0) {
          f.state = 'chase';
          f.cd = rand(o.cd[0], o.cd[1]) * (f.hp < f.maxHp * 0.4 ? 0.75 : 1); // angrier when hurt
          f.strafe = Math.random() < 0.5 ? 1 : -1;
        }
        break;
      default: break;
    }
    // keep the hero from walking through it
    const d = f.dist();
    if (d < o.radius + 0.6 && d > 0.001 && Math.abs(F.feet() - g.position.y) < o.height) {
      hero.position.x = g.position.x + (hero.position.x - g.position.x) / d * (o.radius + 0.6);
      hero.position.z = g.position.z + (hero.position.z - g.position.z) / d * (o.radius + 0.6);
    }
  };
  f.danger = () => {
    const A = o.attacks[f.attack];
    return (f.state === 'windup' && (!A || A.danger !== false)) || (f.state === 'act' && (!A || A.danger !== false));
  };
  f.hurt = (dmg) => {
    if (o.onHurt && o.onHurt(f)) return false;
    f.hp -= dmg;
    f.flash = 0.15;
    api.spawnBurst(g.position.clone().add(V(0, o.height * 0.55, 0)), 0xffe066, 8, { speed: 6, life: 0.35, size: 0.8 });
    if (!o.heavy) {
      g.position.add(V(g.position.x - hero.position.x, 0, g.position.z - hero.position.z).normalize().multiplyScalar(1.2));
      F.clamp(g.position, o.radius + 1);
      if (f.state === 'windup' && Math.random() < 0.3) { f.state = 'recover'; f.t = 0.5; }
    }
    if (f.hp <= 0) {
      f.hp = 0;
      f.state = 'down';
      f.downT = 0;
      api.triggerShake(0.4, 0.5);
      api.playNoise({ duration: 0.8, gain: 0.35, filterFreq: 300 });
    }
    return true;
  };
  return f;
}

// ---------- attacks ----------
function dashAttack(ctx, F, o = {}) {
  const { V, api } = ctx;
  const { speed = 26, time = 0.42, dmg = 14, force = 10, windup = 0.65, w = (d) => (d < 9 ? 3 : 1), trail = null, recover = 0.7 } = o;
  return {
    w, windup, recover,
    exec(f) {
      f.data.dir = f.toHero().normalize();
      f.data.left = time;
      f.data.hit = false;
      api.playNoise({ duration: 0.25, gain: 0.2, filterFreq: 2500 });
    },
    act(f, dt) {
      const g = f.group;
      g.position.addScaledVector(f.data.dir, speed * dt);
      const wall = F.clamp(g.position, f.radius + 1);
      if (trail) trail(f, dt);
      if (!f.data.hit && f.dist() < f.radius + 1.3 && F.feet() < f.ground() + f.height * 0.9) {
        f.data.hit = true;
        F.hurt(dmg, g.position, force);
      }
      return (f.data.left -= dt) <= 0 || wall;
    },
  };
}
function throwingStars(ctx, F) {
  const { THREE, V, api, hero } = ctx;
  return {
    w: (d) => (d < 9 ? 1 : 3), windup: 0.7, recover: 0.6,
    exec(f) {
      const from = f.group.position.clone().add(V(0, 1.6, 0));
      const base = hero.position.clone().add(V(0, -0.3, 0)).sub(from).normalize();
      const sm = std(THREE, 0xc9ced8, { metalness: 0.9, roughness: 0.25 });
      for (const off of [-0.22, 0, 0.22]) {
        const mesh = new THREE.Group();
        for (let i = 0; i < 2; i++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.12), sm);
          blade.rotation.y = i * Math.PI / 2;
          mesh.add(blade);
        }
        F.shoot({ from, vel: base.clone().applyAxisAngle(V(0, 1, 0), off).multiplyScalar(22), mesh, dmg: 9, life: 2.2, spin: 20 });
      }
      api.playTone({ freq: 1600, freqEnd: 900, duration: 0.15, type: 'square', gain: 0.06 });
    },
  };
}
function teleportSlash(ctx, F) {
  const { V, hero } = ctx;
  const dash = dashAttack(ctx, F, { windup: 0.5 });
  return {
    ...dash, w: () => 2,
    start(f) {
      ctx.puff(f.group.position.clone().add(V(0, 1, 0)), 0.7);
      const fw = V(Math.sin(hero.rotation.y), 0, Math.cos(hero.rotation.y));
      f.group.position.set(hero.position.x - fw.x * 3.2, F.zone.y, hero.position.z - fw.z * 3.2);
      F.clamp(f.group.position, f.radius + 1);
      f.group.rotation.y = Math.atan2(hero.position.x - f.group.position.x, hero.position.z - f.group.position.z);
      ctx.puff(f.group.position.clone().add(V(0, 1, 0)), 0.7);
    },
  };
}
function lightningAttack(ctx, F, n = 3) {
  const { V, hero } = ctx;
  return {
    w: () => 3, windup: 0.55, recover: 0.8, track: 3,
    exec(f) {
      for (let i = 0; i < n; i++) {
        const p = V(hero.position.x + (i ? rand(-6, 6) : 0), F.zone.y, hero.position.z + (i ? rand(-6, 6) : 0));
        F.clamp(p, 1);
        F.strike({ pos: p, delay: 0.9 + i * 0.15, r: 3.2, dmg: 15, color: 0x8fd8ff, onStrike: (q) => bolt(ctx, F.root, q) });
      }
      ctx.api.playTone({ freq: 2200, freqEnd: 600, duration: 0.4, type: 'sawtooth', gain: 0.06 });
    },
  };
}
function missileAttack(ctx, F, n = 4) {
  const { THREE, V, hero, api } = ctx;
  return {
    w: (d) => (d > 8 ? 3 : 1.5), windup: 0.9, recover: 0.8, track: 3,
    exec(f) {
      for (let i = 0; i < n; i++) {
        const p = V(hero.position.x + (i ? rand(-7, 7) : 0), F.zone.y, hero.position.z + (i ? rand(-7, 7) : 0));
        F.clamp(p, 1);
        const delay = 1.2 + i * 0.12;
        // a missile falling onto the target circle
        const mis = new THREE.Group();
        part(THREE, mis, new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), std(THREE, 0xdddddd, { metalness: 0.6 }));
        part(THREE, mis, new THREE.ConeGeometry(0.18, 0.4, 8), std(THREE, 0xd02020), 0, -0.8, 0).rotation.x = Math.PI;
        F.hazard({ mesh: mis, pos: mis.position, r: 0, dmg: 0, life: delay, anim: (dt, t, h) => {
          mis.position.set(p.x, p.y + 0.6 + h.life * 30, p.z);
        } });
        F.strike({ pos: p, delay, r: 3, dmg: 15, onStrike: (q) => {
          api.spawnBurst(q.clone().add(V(0, 0.5, 0)), 0xff7a2a, 16, { speed: 9, life: 0.6, size: 1.1, gravity: -12 });
          api.playNoise({ duration: 0.45, gain: 0.35, filterFreq: 500 });
          api.triggerShake(0.25, 0.25);
        } });
      }
      api.playTone({ freq: 500, freqEnd: 1400, duration: 0.5, type: 'square', gain: 0.06 });
    },
  };
}
function fireballAttack(ctx, F, n = 3) {
  const { THREE, V, hero, api } = ctx;
  return {
    w: (d) => (d > 7 ? 3 : 1), windup: 0.7, recover: 0.6,
    exec(f) {
      const from = f.group.position.clone().add(V(0, f.height * 0.8, 0));
      for (let i = 0; i < n; i++) {
        const target = V(hero.position.x + (i ? rand(-4, 4) : 0), F.zone.y, hero.position.z + (i ? rand(-4, 4) : 0));
        const T = 1.0 + i * 0.12;
        const vel = target.clone().sub(from).divideScalar(T);
        vel.y = (target.y - from.y) / T + 0.5 * 20 * T;
        const mesh = new THREE.Group();
        mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb030 })));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.tex.fire, transparent: true, depthWrite: false }));
        glow.scale.set(2, 2.6, 1);
        mesh.add(glow);
        F.shoot({ from, vel, gravity: 20, mesh, dmg: 12, r: 1.4, life: 4, splash: (q) => {
          F.firePool(q, 5);
          api.spawnBurst(q.clone().add(V(0, 0.4, 0)), 0xff7a2a, 10, { speed: 6, life: 0.5, size: 0.9 });
        } });
      }
      api.playNoise({ duration: 0.4, gain: 0.25, filterFreq: 900 });
    },
  };
}

// ---------- models ----------
function makeStormMaster(THREE, tex) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const coat = std(THREE, 0x1b2a4a, { roughness: 0.6 });
  const trim = std(THREE, 0xc8d4e6, { metalness: 0.7, roughness: 0.3 });
  const skin = std(THREE, 0x9fb3c8, { roughness: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x8fe3ff });
  part(THREE, body, new THREE.CylinderGeometry(0.3, 0.75, 1.5, 14, 1, true), coat, 0, 0.8, 0).material.side = THREE.DoubleSide;
  part(THREE, body, new THREE.CylinderGeometry(0.27, 0.31, 0.75, 12), coat, 0, 1.85, 0);
  part(THREE, body, new THREE.TorusGeometry(0.31, 0.05, 6, 16), glow, 0, 1.5, 0).rotation.x = Math.PI / 2;
  part(THREE, body, new THREE.CylinderGeometry(0.26, 0.22, 0.28, 12, 1, true), trim, 0, 2.3, -0.02).material.side = THREE.DoubleSide;
  const head = joint(THREE, body, 0, 2.48, 0);
  part(THREE, head, new THREE.SphereGeometry(0.2, 14, 12), skin);
  for (const sx of [-1, 1]) part(THREE, head, new THREE.BoxGeometry(0.09, 0.04, 0.04), glow, sx * 0.08, 0.03, 0.18);
  for (let i = 0; i < 5; i++) {
    const spike = part(THREE, head, new THREE.ConeGeometry(0.07, 0.4, 6), trim, (i - 2) * 0.08, 0.2, -0.08);
    spike.rotation.x = -0.7;
    spike.rotation.z = (i - 2) * -0.25;
  }
  const cape = joint(THREE, body, 0, 2.2, -0.25);
  part(THREE, cape, new THREE.PlaneGeometry(0.9, 2.0), coat, 0, -1.0, 0).material.side = THREE.DoubleSide;
  for (const sx of [-1, 1]) part(THREE, body, new THREE.SphereGeometry(0.15, 10, 8), trim, sx * 0.34, 2.15, 0);
  const arms = [-1, 1].map(sx => {
    const sh = joint(THREE, body, sx * 0.36, 2.12, 0);
    part(THREE, sh, new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), coat, 0, -0.22, 0);
    const el = joint(THREE, sh, 0, -0.45, 0);
    part(THREE, el, new THREE.CylinderGeometry(0.07, 0.06, 0.42, 8), coat, 0, -0.21, 0);
    const hand = joint(THREE, el, 0, -0.45, 0);
    part(THREE, hand, new THREE.SphereGeometry(0.1, 10, 8), glow);
    return { sh, el, hand };
  });
  // swirling storm clouds where legs would be
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.smoke, transparent: true, depthWrite: false, opacity: 0.9 }));
    s.scale.setScalar(1.3);
    group.add(s);
    clouds.push(s);
  }
  group.scale.setScalar(1.15);
  return {
    group, body, arms, legs: [], head, flashMats: [coat],
    tick(dt, t, f) {
      cape.rotation.x = 0.25 + Math.sin(t * 5) * 0.12;
      clouds.forEach((s, i) => {
        const a = t * 2.5 + i * 1.26;
        s.position.set(Math.cos(a) * 0.55, 0.15 + (i % 2) * 0.25, Math.sin(a) * 0.55);
      });
      const sparks = f.state === 'windup' ? 1.6 + Math.sin(t * 40) * 0.6 : 1;
      for (const a of arms) a.hand.scale.setScalar(sparks);
    },
  };
}

function makeMech(THREE) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  // worn armour plating: gunmetal, dark steel and scratched yellow paint
  const metal = metalMaterial(THREE, { color: '#5f6774', panels: 4, rust: 0.25 });
  const dark = metalMaterial(THREE, { color: '#2c313a', panels: 3, rust: 0.4 });
  const yellow = metalMaterial(THREE, { color: '#e8ad08', panels: 2, stripes: true, rust: 0.15, metalness: 0.35, roughness: 0.4 });
  const red = new THREE.MeshBasicMaterial({ color: 0xff3322 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.55, metalness: 0.3, roughness: 0.1, emissive: 0x113355 });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const legs = [-1, 1].map(sx => {
    const hip = joint(THREE, body, sx * 1.0, 2.9, 0);
    part(THREE, hip, B(0.8, 1.5, 0.9), metal, 0, -0.75, 0);
    const knee = joint(THREE, hip, 0, -1.5, 0);
    part(THREE, knee, B(0.7, 1.4, 0.8), dark, 0, -0.7, 0);
    part(THREE, knee, B(1.1, 0.4, 1.6), metal, 0, -1.3, 0.2);
    part(THREE, knee, B(0.72, 0.3, 0.82), yellow, 0, -0.1, 0);
    return { hip, knee };
  });
  part(THREE, body, B(2.2, 0.6, 1.2), dark, 0, 2.95, 0);
  part(THREE, body, B(2.6, 1.9, 1.8), metal, 0, 4.1, 0);
  for (const sx of [-1, 1]) part(THREE, body, B(0.25, 1.9, 1.82), yellow, sx * 1.0, 4.1, 0);
  part(THREE, body, B(1.2, 0.8, 0.1), glass, 0, 4.4, 0.92);
  // the pilot inside the cockpit
  part(THREE, body, new THREE.SphereGeometry(0.25, 12, 10), std(THREE, 0xe8b98c), 0, 4.35, 0.55);
  part(THREE, body, new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), yellow, 0, 4.4, 0.55);
  const head = joint(THREE, body, 0, 5.3, 0);
  part(THREE, head, B(0.9, 0.5, 0.8), dark);
  const visor = part(THREE, head, B(0.7, 0.12, 0.05), red, 0, 0.02, 0.41);
  const pods = [-1, 1].map(sx => {
    const pod = joint(THREE, body, sx * 1.75, 5.15, 0);
    part(THREE, pod, B(0.8, 0.8, 1.2), dark);
    for (const [x, y] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.18], [0.18, -0.18]]) {
      part(THREE, pod, new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), red, x, y, 0.62).rotation.x = Math.PI / 2;
    }
    return pod;
  });
  const arms = [-1, 1].map(sx => {
    const sh = joint(THREE, body, sx * 1.6, 4.6, 0);
    part(THREE, sh, B(0.6, 1.3, 0.6), metal, 0, -0.65, 0);
    const el = joint(THREE, sh, 0, -1.3, 0);
    part(THREE, el, B(0.7, 1.2, 0.7), dark, 0, -0.6, 0);
    const hand = joint(THREE, el, 0, -1.3, 0);
    part(THREE, hand, new THREE.CylinderGeometry(0.28, 0.32, 0.6, 10), metal, 0, -0.1, 0);
    return { sh, el, hand };
  });
  return {
    group, body, arms, legs, head, flashMats: [metal],
    tick(dt, t, f) {
      const charging = f.state === 'windup';
      visor.material.color.setHex(charging && Math.sin(t * 30) > 0 ? 0xffffff : 0xff3322);
      for (const p of pods) p.rotation.x = f.state === 'windup' && f.attack === 'missiles' ? -0.5 : 0;
    },
  };
}

function makeFireMonster(THREE, tex) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  // dark volcanic rock with lava glowing through the cracks
  const rock = rockMaterial(THREE, { color: '#3a2418', lava: true, flat: true, repeat: 1.5, glow: 1.8 });
  const lava = lavaMaterial(THREE); // glowing molten rock
  const eyes = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const I = (r) => new THREE.IcosahedronGeometry(r, 1);
  const S = (r) => new THREE.SphereGeometry(r, 12, 10);
  const legs = [-1, 1].map(sx => {
    const hip = joint(THREE, body, sx * 0.5, 1.7, 0);
    part(THREE, hip, S(0.32), lava, 0, -0.4, 0);
    part(THREE, hip, I(0.45), rock, 0, -0.45, 0).scale.set(1, 1.3, 1);
    const knee = joint(THREE, hip, 0, -0.9, 0);
    part(THREE, knee, I(0.38), rock, 0, -0.4, 0).scale.set(1, 1.3, 1);
    part(THREE, knee, I(0.35), rock, 0, -0.75, 0.15).scale.set(1.2, 0.6, 1.5);
    return { hip, knee };
  });
  part(THREE, body, S(0.75), lava, 0, 2.55, 0);
  part(THREE, body, I(0.9), rock, 0, 2.6, -0.1).scale.set(1.1, 1, 0.75);
  part(THREE, body, I(0.45), rock, 0.35, 2.9, 0.45);
  part(THREE, body, I(0.4), rock, -0.4, 2.3, 0.45);
  const head = joint(THREE, body, 0, 3.5, 0.1);
  part(THREE, head, I(0.45), rock);
  for (const sx of [-1, 1]) part(THREE, head, new THREE.BoxGeometry(0.14, 0.06, 0.05), eyes, sx * 0.15, 0.05, 0.4);
  part(THREE, head, new THREE.BoxGeometry(0.3, 0.08, 0.05), lava, 0, -0.17, 0.4);
  const arms = [-1, 1].map(sx => {
    const sh = joint(THREE, body, sx * 1.0, 3.1, 0);
    part(THREE, sh, S(0.3), lava);
    part(THREE, sh, I(0.4), rock, 0, -0.45, 0).scale.set(1, 1.3, 1);
    const el = joint(THREE, sh, 0, -0.95, 0);
    part(THREE, el, I(0.36), rock, 0, -0.4, 0).scale.set(1, 1.3, 1);
    const hand = joint(THREE, el, 0, -0.9, 0);
    part(THREE, hand, S(0.32), lava);
    return { sh, el, hand };
  });
  // flames on the head, shoulders and fists
  const flames = [];
  const flameMat = new THREE.SpriteMaterial({ map: tex.fire, transparent: true, depthWrite: false });
  const addFlame = (parent, x, y, z, s) => {
    const sp = new THREE.Sprite(flameMat);
    sp.position.set(x, y, z);
    parent.add(sp);
    flames.push({ sp, s, ph: Math.random() * 10 });
  };
  addFlame(head, 0, 0.6, 0, 1.4);
  addFlame(head, 0.2, 0.45, -0.1, 0.9);
  addFlame(head, -0.2, 0.45, -0.1, 0.9);
  for (const a of arms) { addFlame(a.sh, 0, 0.4, 0, 1.0); addFlame(a.hand, 0, 0.2, 0, 0.8); }
  group.scale.setScalar(1.1);
  return {
    group, body, arms, legs, head, flashMats: [rock],
    tick(dt, t, f) {
      const k = f.state === 'down' ? Math.max(0, 1 - f.downT * 0.6) : 1;
      for (const fl of flames) {
        const s = fl.s * k * (0.8 + Math.sin(t * 12 + fl.ph) * 0.2);
        fl.sp.scale.set(s, s * 1.6, 1);
      }
    },
  };
}

function makeBossSuit(THREE) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const armor = std(THREE, 0x1a1424, { metalness: 0.7, roughness: 0.3 });
  const plate = std(THREE, 0x2e2240, { metalness: 0.6, roughness: 0.35 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xb46bff });
  const capeMat = std(THREE, 0x3b1366, { side: THREE.DoubleSide });
  const C = (a, b, l) => new THREE.CylinderGeometry(a, b, l, 10);
  const legs = [-1, 1].map(sx => {
    const hip = joint(THREE, body, sx * 0.14, 1.0, 0);
    part(THREE, hip, C(0.12, 0.1, 0.52), armor, 0, -0.26, 0);
    const knee = joint(THREE, hip, 0, -0.52, 0);
    part(THREE, knee, C(0.1, 0.08, 0.46), plate, 0, -0.23, 0);
    part(THREE, knee, new THREE.BoxGeometry(0.15, 0.09, 0.3), armor, 0, -0.47, 0.05);
    return { hip, knee };
  });
  part(THREE, body, new THREE.BoxGeometry(0.44, 0.22, 0.26), armor, 0, 1.03, 0);
  part(THREE, body, C(0.24, 0.19, 0.66), plate, 0, 1.4, 0).scale.z = 0.75;
  part(THREE, body, new THREE.OctahedronGeometry(0.11), glow, 0, 1.5, 0.17);
  const head = joint(THREE, body, 0, 1.88, 0);
  part(THREE, head, new THREE.SphereGeometry(0.19, 14, 12), armor);
  part(THREE, head, new THREE.BoxGeometry(0.3, 0.06, 0.06), glow, 0, 0.03, 0.16);
  part(THREE, head, new THREE.ConeGeometry(0.06, 0.3, 6), plate, 0, 0.25, -0.02);
  const cape = joint(THREE, body, 0, 1.7, -0.18);
  part(THREE, cape, new THREE.PlaneGeometry(0.75, 1.5), capeMat, 0, -0.75, 0);
  for (const sx of [-1, 1]) {
    part(THREE, body, new THREE.SphereGeometry(0.15, 10, 8), plate, sx * 0.3, 1.67, 0);
    part(THREE, body, new THREE.ConeGeometry(0.06, 0.28, 6), glow, sx * 0.36, 1.85, 0).rotation.z = -sx * 0.5;
  }
  const arms = [-1, 1].map(sx => {
    const sh = joint(THREE, body, sx * 0.3, 1.65, 0);
    part(THREE, sh, C(0.08, 0.07, 0.44), armor, 0, -0.22, 0);
    const el = joint(THREE, sh, 0, -0.44, 0);
    part(THREE, el, C(0.07, 0.06, 0.4), plate, 0, -0.2, 0);
    const hand = joint(THREE, el, 0, -0.44, 0);
    part(THREE, hand, new THREE.SphereGeometry(0.075, 8, 6), glow);
    return { sh, el, hand };
  });
  group.scale.setScalar(1.25);
  return {
    group, body, arms, legs, head, flashMats: [armor],
    tick(dt, t) { cape.rotation.x = 0.3 + Math.sin(t * 5) * 0.12; },
  };
}

// Kai, your best friend: teal hoodie, jeans and a phone in hand (~hero size)
const KAI_LOOK = {
  sex: 'male', skin: '#c18a63', hair: 'buzzed', hairColour: '#1a1410', scale: 1.3, slim: 0.5, idle: 'Idle_Talking_Loop',
  outfit: { mode: 'clothes', top: '#1e9e8a', legs: '#2b4a7a', shoes: '#f2f2f2' },
};
function makeKai(THREE) {
  const real = peopleReady() ? makeRealPerson(KAI_LOOK) : null;
  if (real) {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.015), std(THREE, 0x111111));
    const hand = real.bone('hand_r');
    if (hand) { phone.position.set(0, 0.08, 0.03); phone.scale.setScalar(1 / 1.3); hand.add(phone); }
    real.play('Idle_Talking_Loop', { fade: 0 });
    // armR is a stand-in for the old model's joint (the story code still pokes it)
    return { group: real.group, armR: new THREE.Group(), armL: new THREE.Group(), real, update: (dt) => real.update(dt) };
  }
  const p = makePerson(THREE);
  const hoodie = std(THREE, 0x1e9e8a, { roughness: 0.85 });
  const jeans = std(THREE, 0x2b4a7a, { roughness: 0.85 });
  const skin = std(THREE, 0xc68642, { roughness: 0.8 });
  p.group.traverse(o => {
    if (!o.isMesh) return;
    const y = o.getWorldPosition(new THREE.Vector3()).y;
    o.material = y > 1.5 ? skin : y > 0.75 ? hoodie : jeans;
  });
  for (const a of [p.armL, p.armR]) a.children[0].material = hoodie;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(THREE, 0x2a1a10));
  hair.position.y = 1.6;
  p.group.add(hair);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12, Math.PI), hoodie);
  hood.position.set(0, 1.45, -0.1);
  hood.rotation.x = -0.3;
  p.group.add(hood);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
    eye.position.set(sx * 0.065, 1.6, 0.155);
    p.group.add(eye);
  }
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.02), std(THREE, 0x111111));
  phone.position.set(0, -0.5, 0.06);
  p.armR.add(phone);
  p.group.scale.setScalar(1.35);
  return p;
}

// ---------- fighter roster ----------
function ninjaFighter(ctx, F, hpMul = 1) {
  const m = makeNinja(ctx.THREE);
  return makeFighter(ctx, F, {
    name: 'SHADOW NINJA', title: 'Shadow Ninja', maxHp: Math.round(330 * hpMul), model: m, radius: 0.7, height: 2.2, speed: 9, keep: 4.5, cd: [1.0, 1.8],
    clips: { idle: 'Sword_Idle', run: 'Sprint_Loop', down: 'Fixing_Kneeling',
      windup: { slash: 'Crouch_Idle_Loop', tele: 'Crouch_Idle_Loop', stars: 'Spell_Simple_Enter' }, act: { slash: 'Sword_Attack', tele: 'Sword_Attack' } },
    attacks: { slash: dashAttack(ctx, F), stars: throwingStars(ctx, F), tele: teleportSlash(ctx, F) },
    poses: {
      idle: { shL: 0.2, shR: -0.9, elL: -0.5, elR: -0.9, hipL: -0.25, hipR: 0.25, knL: 0.35, knR: 0.35, lean: 0.12, crouch: -0.1 },
      windup: {
        slash: { shL: 0.5, shR: -2.8, elL: -0.6, elR: -0.2, hipL: -0.7, hipR: 0.5, knL: 0.9, knR: 0.4, lean: 0.35, crouch: -0.35 },
        tele: { shL: 0.5, shR: -2.8, elL: -0.6, elR: -0.2, hipL: -0.7, hipR: 0.5, knL: 0.9, knR: 0.4, lean: 0.35, crouch: -0.35 },
        stars: { shL: 0.3, shR: -2.6, elL: -0.4, elR: -0.5, hipL: -0.4, hipR: 0.3, knL: 0.5, knR: 0.3, lean: -0.1, crouch: -0.15 },
      },
      act: { slash: { shL: 0.6, shR: 1.2, elL: -0.4, elR: -0.1, hipL: -0.9, hipR: 0.7, knL: 0.6, knR: 0.3, lean: 0.5, crouch: -0.3 } },
    },
    onHurt(f) {
      if ((f.state === 'chase' || f.state === 'recover') && f.hp > 60 && Math.random() < 0.18) {
        teleportSlash(ctx, F).start(f);
        ctx.api.showMsg('Too slow!', 900);
        f.state = 'recover';
        f.t = 0.4;
        return true;
      }
      return false;
    },
  });
}
const STORM_LOOK = {
  sex: 'male', skin: '#b9c6d6', hair: 'buzzed', beard: true, hairColour: '#dfe6f0', scale: 1.55, slim: 0.25, idle: 'Spell_Simple_Idle_Loop',
  outfit: { mode: 'suit', main: '#1b2a4a', second: '#24365c', accent: '#8fe3ff', emblem: '#e8fbff', emblemOn: true, hex: 0.25, mask: false, metal: 0.3, rough: 0.4 },
};
function makeRealStorm(THREE, tex) {
  const real = makeRealPerson(STORM_LOOK);
  if (!real) return null;
  const inv = 1 / STORM_LOOK.scale;
  const glow = new THREE.MeshBasicMaterial({ color: 0x8fe3ff });
  const hands = ['hand_l', 'hand_r'].map(n => {
    const b = real.bone(n);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07 * inv * 1.5, 10, 8), glow);
    if (b) b.add(orb);
    return orb;
  });
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.smoke, transparent: true, depthWrite: false, opacity: 0.9 }));
    sp.scale.setScalar(1.5);
    real.group.add(sp);
    clouds.push(sp);
  }
  return {
    group: real.group, body: new THREE.Group(), arms: [], legs: [], flashMats: [real.bodyMat], real,
    tick(dt, t, f) {
      clouds.forEach((sp, i) => {
        const a = t * 2.5 + i * 1.26;
        sp.position.set(Math.cos(a) * 0.7, 0.1 + (i % 2) * 0.3, Math.sin(a) * 0.7);
      });
      const k = f.state === 'windup' ? 1.6 + Math.sin(t * 40) * 0.6 : 1;
      for (const h of hands) h.scale.setScalar(k);
    },
  };
}
function stormFighter(ctx, F, hpMul = 1) {
  const { THREE, V, api, hero } = ctx;
  const m = (peopleReady() && makeRealStorm(THREE, ctx.tex)) || makeStormMaster(THREE, ctx.tex);
  const funnelMat = new THREE.MeshBasicMaterial({ color: 0xaab4c4, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  return makeFighter(ctx, F, {
    name: 'STORM MASTER', title: 'Storm Master', maxHp: Math.round(380 * hpMul), model: m, radius: 0.8, height: 3.0, speed: 6, keep: 9, hover: 0.9, cd: [1.1, 2.0],
    clips: { idle: 'Spell_Simple_Idle_Loop', run: 'Swim_Fwd_Loop', down: 'Fixing_Kneeling',
      windup: { lightning: 'Spell_Simple_Enter', gust: 'Spell_Simple_Enter', whirl: 'Spell_Simple_Enter' } },
    attacks: {
      lightning: lightningAttack(ctx, F),
      gust: {
        w: (d) => (d < 15 ? 3 : 0.5), windup: 0.8, recover: 0.7,
        exec(f) {
          const fw = f.toHero().normalize();
          for (let i = 0; i < 14; i++) {
            const p = f.group.position.clone().add(V(0, 1.5, 0)).addScaledVector(fw, 2 + i * 1.1).add(V(rand(-1.5, 1.5), rand(-1, 1), rand(-1.5, 1.5)));
            api.spawnBurst(p, 0xe8f4ff, 2, { speed: 10, life: 0.4, gravity: 0, size: 0.8 });
          }
          api.playNoise({ duration: 0.8, gain: 0.3, filterFreq: 1800 });
          const toH = f.toHero(), d = toH.length();
          if (d < 16 && toH.normalize().dot(f.fwd()) > 0.5) {
            F.hurt(10, f.group.position, 22);
          }
        },
      },
      whirl: {
        w: () => 1.5, windup: 0.6, recover: 0.5,
        exec(f) {
          const mesh = new THREE.Group();
          for (let i = 0; i < 4; i++) {
            const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.7 + i * 0.45, 0.5 + i * 0.45, 1.2, 14, 1, true), funnelMat);
            ring.position.y = 0.6 + i * 1.1;
            mesh.add(ring);
          }
          const pos = f.group.position.clone();
          pos.y = F.zone.y;
          mesh.position.copy(pos);
          F.hazard({ mesh, pos: mesh.position, r: 2.0, dmg: 12, life: 5, tick: 1.0, height: 4.5, force: 6,
            onTouch: () => { api.heroVel.y = 14; },
            anim: (dt, t, h) => {
              const dir = V(hero.position.x - h.pos.x, 0, hero.position.z - h.pos.z);
              if (dir.lengthSq() > 0.01) h.pos.addScaledVector(dir.normalize(), 6 * dt);
              F.clamp(h.pos, 1);
              mesh.children.forEach((c, i) => { c.rotation.y += dt * (8 - i); });
              mesh.scale.setScalar(Math.min(1, h.life));
            } });
        },
      },
    },
    poses: {
      idle: { shL: -0.3, shR: -0.3, elL: -0.6, elR: -0.6 },
      windup: {
        lightning: { shL: -3.0, shR: -3.0, elL: -0.1, elR: -0.1, lean: -0.2 },
        gust: { shL: 0.8, shR: 0.8, elL: -0.3, elR: -0.3, lean: -0.3 },
        whirl: { shL: -1.6, shR: -1.6, elL: -0.2, elR: -0.2 },
      },
      down: { shL: 0.4, shR: 0.4, elL: -0.2, elR: -0.2, lean: 0.6, crouch: -0.6 },
    },
  });
}
function mechFighter(ctx, F, hpMul = 1) {
  const { THREE, V, api } = ctx;
  const m = makeMech(THREE);
  return makeFighter(ctx, F, {
    name: 'MECH PILOT', title: 'Mech Pilot', maxHp: Math.round(520 * hpMul), model: m, radius: 2.0, height: 6.2, speed: 5, keep: 7, cd: [1.4, 2.4], heavy: true, crouchScale: 2.5, lean: 0.05,
    attacks: {
      stomp: {
        w: (d) => (d < 14 ? 3 : 0.5), windup: 0.9, recover: 0.9,
        exec(f) {
          F.shockwave(f.group.position, 26, 16, 16, 0xffd23f);
          api.triggerShake(0.5, 0.4);
          api.spawnBurst(f.group.position.clone().add(V(0, 0.5, 0)), 0xcfc7b3, 16, { speed: 9, life: 0.7, gravity: -20, size: 1.2 });
          api.playNoise({ duration: 0.5, gain: 0.4, filterFreq: 160 });
        },
      },
      missiles: missileAttack(ctx, F),
      laser: {
        w: (d) => (d > 6 ? 2 : 0.5), windup: 1.0, recover: 0.6, track: 4,
        exec(f) {
          const from = f.group.position.clone().add(V(0, 5.3, 0)).addScaledVector(f.fwd(), 0.6);
          const to = ctx.hero.position.clone().add(V(0, -0.3, 0));
          const dir = to.sub(from).normalize();
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.2), new THREE.MeshBasicMaterial({ color: 0xff3322 }));
          mesh.lookAt(dir);
          F.shoot({ from, vel: dir.multiplyScalar(42), mesh, dmg: 16, r: 1.5, life: 2 });
          api.playTone({ freq: 1800, freqEnd: 300, duration: 0.3, type: 'sawtooth', gain: 0.1 });
        },
      },
      charge: dashAttack(ctx, F, { speed: 22, time: 1.0, dmg: 20, force: 18, windup: 0.8, w: (d) => (d > 8 ? 2 : 1), recover: 1.1 }),
    },
    poses: {
      idle: { shL: -0.2, shR: -0.2, elL: -0.5, elR: -0.5, knL: 0.15, knR: 0.15, crouch: -0.05 },
      windup: {
        stomp: { hipL: -1.2, knL: 1.2, shL: -0.5, shR: -0.5, elL: -0.6, elR: -0.6, crouch: 0.05 },
        missiles: { shL: 0.3, shR: 0.3, elL: -0.4, elR: -0.4, knL: 0.4, knR: 0.4, crouch: -0.15 },
        laser: { shL: -1.4, shR: -0.3, elL: -0.1, elR: -0.5, lean: -0.1 },
        charge: { shL: 0.6, shR: 0.6, elL: -0.8, elR: -0.8, lean: 0.35, crouch: -0.2, hipL: -0.5, hipR: 0.4, knL: 0.6, knR: 0.3 },
      },
      down: { shL: 0.3, shR: 0.3, elL: -0.3, elR: -0.3, hipL: -1.4, hipR: -1.4, knL: 1.6, knR: 1.6, lean: 0.3, crouch: -0.6 },
    },
  });
}
function fireFighter(ctx, F, hpMul = 1) {
  const { THREE, V, api } = ctx;
  const m = makeFireMonster(THREE, ctx.tex);
  let trailT = 0;
  return makeFighter(ctx, F, {
    name: 'FIRE MONSTER', title: 'Fire Monster', maxHp: Math.round(450 * hpMul), model: m, radius: 1.3, height: 4.5, speed: 7, keep: 5, cd: [1.0, 1.9], heavy: true, crouchScale: 1.6,
    attacks: {
      fireball: fireballAttack(ctx, F),
      ring: {
        w: (d) => (d < 12 ? 3 : 0.7), windup: 0.9, recover: 0.8,
        exec(f) {
          F.shockwave(f.group.position, 22, 15, 15, 0xff5a14);
          api.spawnBurst(f.group.position.clone().add(V(0, 1, 0)), 0xff7a2a, 20, { speed: 10, life: 0.7, size: 1.2 });
          api.playNoise({ duration: 0.6, gain: 0.4, filterFreq: 300 });
          api.triggerShake(0.35, 0.3);
        },
      },
      charge: dashAttack(ctx, F, { speed: 24, time: 0.9, dmg: 18, force: 16, windup: 0.8, w: (d) => (d > 6 ? 2 : 1), recover: 0.9,
        trail: (f, dt) => {
          trailT -= dt;
          if (trailT <= 0) { trailT = 0.15; F.firePool(f.group.position, 4, 1.6); }
        } }),
    },
    poses: {
      idle: { shL: -0.2, shR: -0.2, elL: -0.7, elR: -0.7, knL: 0.2, knR: 0.2, lean: 0.15, crouch: -0.05 },
      windup: {
        fireball: { shL: 0.2, shR: -2.8, elL: -0.5, elR: -0.3, lean: -0.15 },
        ring: { shL: -2.9, shR: -2.9, elL: -0.4, elR: -0.4, lean: -0.2 },
        charge: { shL: 0.7, shR: 0.7, elL: -0.6, elR: -0.6, lean: 0.45, crouch: -0.4, hipL: -0.5, hipR: 0.4, knL: 0.6, knR: 0.3 },
      },
    },
  });
}
const BOSS_LOOK = {
  sex: 'male', skin: '#c18a63', hair: null, scale: 1.4, slim: 0.2, idle: 'Idle_Loop',
  outfit: { mode: 'suit', main: '#1a1424', second: '#2e2240', accent: '#b46bff', emblem: '#e2c6ff', emblemOn: true, hex: 0.35, mask: true, maskCol: '#1a1424', lens: '#c896ff', metal: 0.65, rough: 0.3 },
};
function makeRealBoss(THREE) {
  const real = makeRealPerson(BOSS_LOOK);
  if (!real) return null;
  const inv = 1 / BOSS_LOOK.scale;
  const capeMat = std(THREE, 0x3b1366, { side: THREE.DoubleSide });
  const cape = new THREE.Group();
  const capeMesh = part(THREE, cape, new THREE.PlaneGeometry(0.62, 1.25), capeMat, 0, -0.62, -0.02);
  capeMesh.castShadow = true;
  cape.scale.setScalar(inv * 1.3);
  const spine = real.bone('spine_03');
  if (spine) { cape.position.set(0, 0.12 * inv, -0.14 * inv); spine.add(cape); }
  return {
    group: real.group, body: new THREE.Group(), arms: [], legs: [], flashMats: [real.bodyMat], real,
    tick(dt, t) { cape.rotation.x = 0.25 + Math.sin(t * 5) * 0.1; },
  };
}
function bossFighter(ctx, F) {
  const m = (peopleReady() && makeRealBoss(ctx.THREE)) || makeBossSuit(ctx.THREE);
  return makeFighter(ctx, F, {
    name: 'THE BOSS (KAI)', title: 'Boss', maxHp: 650, model: m, radius: 0.8, height: 2.6, speed: 10, keep: 5, cd: [0.9, 1.6],
    clips: { idle: 'Idle_Loop', run: 'Sprint_Loop', down: 'Fixing_Kneeling',
      windup: { slash: 'Crouch_Idle_Loop', tele: 'Crouch_Idle_Loop', lightning: 'Spell_Simple_Enter', missiles: 'Spell_Simple_Enter', fireball: 'Spell_Simple_Enter' },
      act: { slash: 'Punch_Cross', tele: 'Punch_Cross' } },
    attacks: {
      slash: dashAttack(ctx, F, { dmg: 15 }),
      tele: teleportSlash(ctx, F),
      lightning: { ...lightningAttack(ctx, F, 2), w: () => 1.5 },
      missiles: { ...missileAttack(ctx, F, 3), w: () => 1.2 },
      fireball: { ...fireballAttack(ctx, F, 2), w: (d) => (d > 7 ? 2 : 0.7) },
    },
    poses: {
      idle: { shL: 0.2, shR: -0.6, elL: -0.5, elR: -0.8, hipL: -0.2, hipR: 0.2, knL: 0.3, knR: 0.3, lean: 0.1, crouch: -0.08 },
      windup: {
        slash: { shL: 0.5, shR: -2.8, elL: -0.6, elR: -0.2, hipL: -0.7, hipR: 0.5, knL: 0.9, knR: 0.4, lean: 0.35, crouch: -0.35 },
        tele: { shL: 0.5, shR: -2.8, elL: -0.6, elR: -0.2, hipL: -0.7, hipR: 0.5, knL: 0.9, knR: 0.4, lean: 0.35, crouch: -0.35 },
        lightning: { shL: -3.0, shR: -3.0, elL: -0.1, elR: -0.1, lean: -0.2 },
        missiles: { shL: -1.5, shR: -1.5, elL: -0.2, elR: -0.2 },
        fireball: { shL: 0.2, shR: -2.8, elL: -0.5, elR: -0.3, lean: -0.15 },
      },
      act: { slash: { shL: 0.6, shR: 1.2, elL: -0.4, elR: -0.1, hipL: -0.9, hipR: 0.7, knL: 0.6, knR: 0.3, lean: 0.5, crouch: -0.3 } },
    },
  });
}

// =====================================================================
// fight mission: travel to the zone, movie intro, fight, win/lose movie
// =====================================================================
function fightMission(ctx, cfg) {
  const { V, api, hero } = ctx;
  const zone = cfg.zone;
  const F = fightKit(ctx, zone);
  const fs = cfg.makeFighters(F);
  let phase = 'travel';
  let leaveT = 0;
  let winT = 0;
  const leaveMax = zone.shape === 'square' ? 9 : 6;
  function hud() {
    ctx.setBoss(fs.filter(f => !f.gone).map(f => ({ name: f.name, hp: Math.max(0, f.hp), max: f.maxHp })));
    ctx.setHud({ title: cfg.title, objective: cfg.objective, warn: leaveT > 0 ? `Get back to the fight! ${Math.ceil(leaveMax - leaveT)}` : '' });
  }
  function startFight() {
    phase = 'intro';
    ctx.setTarget(null);
    api.healHero();
    for (const f of fs) f.group.rotation.y = Math.atan2(hero.position.x - f.group.position.x, hero.position.z - f.group.position.z);
    ctx.play(cfg.preFight(F, fs), () => {
      phase = 'fight';
      for (const f of fs) { if (f.group.visible) { f.state = 'chase'; f.cd = rand(0.8, 1.6); } }
      hud();
    });
  }
  function end(won, how) {
    phase = 'over';
    F.over = true;
    F.clearAttacks();
    ctx.setDanger(false);
    for (const f of fs) if (f.state !== 'down') { f.state = 'idle'; }
    if (won) ctx.finish('won', cfg.winShots(F, fs));
    else if (cfg.finale) ctx.fail(how === 'left' ? 'You left the rooftop... the Boss got away! Try again.' : 'The Boss beat you this time... Try again!');
    else ctx.finish('lost', cfg.loseShots(F, fs, how));
  }
  return {
    debug: { F, fs, get phase() { return phase; } },
    begin() {
      ctx.setTarget(V(zone.x, zone.y, zone.z));
      ctx.play(cfg.intro(F, fs), () => ctx.setHud({ title: cfg.title, objective: cfg.travelText }));
    },
    anim(dt, t) {
      if (phase !== 'fight') for (const f of fs) { if (f.state !== 'down' && f.state !== 'idle') f.state = 'idle'; if (phase === 'travel') f.face(dt, 2); f.animate(dt, t); }
      if (phase === 'over') for (const f of fs) if (f.state === 'down') f.downT += dt;
      if (cfg.anim) cfg.anim(dt, t, F, fs);
    },
    update(dt, t) {
      if (phase === 'travel') {
        if (F.inZone(hero.position, -2) && Math.abs(F.feet() - zone.y) < 4) startFight();
        return;
      }
      if (phase !== 'fight') return;
      for (const f of fs) {
        if (f.gone || !f.group.visible) continue;
        if (f.state === 'down') {
          f.downT += dt;
          // extra fighters vanish; the last one stays for the win movie
          if (!f.keep && f.downT > 1.4 && fs.some(o => o !== f && o.state !== 'down' && !o.gone)) { f.vanish(); f.gone = true; }
        } else {
          f.update(dt, t);
          if (F.over) return;
        }
        f.animate(dt, t);
      }
      const danger = F.update(dt, t);
      if (F.over) return;
      ctx.setDanger(danger || fs.some(f => f.state !== 'down' && f.danger()));
      if (fs.every(f => f.state === 'down' || f.gone)) {
        winT += dt;
        if (winT > 0.9) { end(true); return; }
      }
      const out = !F.inZone(hero.position, 18) || F.feet() < zone.y - 8;
      if (out) leaveT += dt; else leaveT = 0;
      hud();
      if (leaveT > leaveMax) end(false, 'left');
    },
    punch(range) {
      if (phase !== 'fight') return 0;
      let best = null, bd = Infinity;
      for (const f of fs) {
        if (f.state === 'down' || f.gone || !f.group.visible) continue;
        const d = f.dist(), dy = F.feet() - f.group.position.y;
        if (d < f.radius + range && dy > -2 && dy < f.height && d < bd) { best = f; bd = d; }
      }
      if (!best) return 0;
      const hit = best.hurt(api.punchPower ? api.punchPower() : 22);
      hud();
      return hit ? 1 : 0;
    },
    dodgeDir(side) {
      if (phase !== 'fight') return null;
      let near = null, bd = Infinity;
      for (const f of fs) if (f.state !== 'down' && !f.gone && f.dist() < bd) { bd = f.dist(); near = f; }
      if (!near) return null;
      const away = V(hero.position.x - near.group.position.x, 0, hero.position.z - near.group.position.z).normalize();
      return V(-away.z, 0, away.x).multiplyScalar(side >= 0 ? 0.8 : -0.8).addScaledVector(away, 0.6).normalize();
    },
    heroDown() {
      if (phase !== 'fight') return false;
      end(false, 'down');
      return true;
    },
    cleanup() {
      F.dispose();
      for (const f of fs) ctx.scene.remove(f.group);
      api.heroRig.flip.rotation.x = 0;
      if (hero.position.y < 1.5) hero.position.y = 1.5;
      if (cfg.cleanup) cfg.cleanup();
    },
  };
}

// shared henchman movies
function henchLose(ctx, f, how, taunts, kaiLine) {
  const { V, api, hero } = ctx;
  const g = f.group;
  const down = how === 'down';
  const hc = () => V(hero.position.x, hero.position.y - 1.05, hero.position.z);
  const shots = [];
  if (down) {
    shots.push({ text: 'You got knocked down!', snap: true, cam: ctx.orbit(hc, 5 + f.radius, 2.2 + f.height * 0.3, g.rotation.y + 1, g.rotation.y + 1.8),
      enter: () => {
        api.heroRig.flip.rotation.x = -Math.PI / 2;
        hero.position.y -= 1.05;
        const dir = V(hero.position.x - g.position.x, 0, hero.position.z - g.position.z).normalize();
        g.position.x = hero.position.x - dir.x * (2 + f.radius);
        g.position.z = hero.position.z - dir.z * (2 + f.radius);
        g.rotation.y = Math.atan2(dir.x, dir.z);
      } });
  }
  taunts.forEach((text, i) => shots.push({ who: f.name, text, cam: i === 0 ? f.closeCam : undefined, snap: i === 0 && !down }));
  shots.push({ text: `POOF! The ${f.title} got away...`, dur: 3, enter: () => f.vanish() });
  shots.push({ who: KAI, text: kaiLine, cam: down ? ctx.orbit(hc, 6, 3, 0.3, 1.0) : ctx.phoneCam(), snap: !down,
    update: (u) => { if (down && u > 0.6 && api.heroRig.flip.rotation.x !== 0) { api.heroRig.flip.rotation.x = 0; hero.position.y += 1.05; } } });
  return shots;
}
// the hero steps back from a beaten villain so the camera can see them both
export function stepBack(ctx, g, dist) {
  const { hero, V } = ctx;
  const away = V(hero.position.x - g.position.x, 0, hero.position.z - g.position.z);
  if (away.lengthSq() < 0.01) away.set(0, 0, 1);
  away.normalize();
  hero.position.x = g.position.x + away.x * dist;
  hero.position.z = g.position.z + away.z * dist;
  if (hero.position.y < g.position.y + 1.5) hero.position.y = g.position.y + 1.5;
  hero.rotation.y = Math.atan2(-away.x, -away.z);
  g.rotation.y = Math.atan2(away.x, away.z);
}
function henchWin(ctx, f, lines, vanishText, kaiLines) {
  const g = f.group;
  return [
    { text: `The ${f.title} is beaten!`, snap: true, enter: () => stepBack(ctx, g, 6 + f.radius * 2),
      cam: ctx.orbit(() => g.position.clone().add(ctx.V(0, f.height * 0.4, 0)), 5 + f.radius * 2, 2 + f.height * 0.3, g.rotation.y, g.rotation.y + 1.2) },
    ...lines.map((text, i) => ({ who: f.name, text, cam: i === 0 ? f.closeCam : undefined })),
    { text: vanishText, dur: 3, enter: () => f.vanish() },
    ...ctx.phone(kaiLines).map((s, i) => ({ ...s, snap: i === 0 })),
  ];
}

const arenaZone = () => ({ x: ARENA.x, y: 0.03, z: ARENA.z, r: ARENA.r, shape: 'circle' });
const roofZone = (api) => ({ x: api.bossRoof.x, y: api.bossRoof.y, z: api.bossRoof.z, r: api.bossRoof.half, shape: 'square' });

// dark storm clouds and flashes around a spot (missions 4-6)
function stormSky(ctx, root, center, radius = 60) {
  const { THREE, tex } = ctx;
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.darkSmoke, transparent: true, depthWrite: false, opacity: 0.85, fog: false }));
    const a = rand(0, Math.PI * 2), r = rand(0, radius);
    s.position.set(center.x + Math.cos(a) * r, center.y + rand(55, 75), center.z + Math.sin(a) * r);
    s.scale.setScalar(rand(40, 70));
    root.add(s);
    clouds.push(s);
  }
  let flashT = rand(2, 5);
  return {
    anim(dt) {
      flashT -= dt;
      for (const c of clouds) c.material.color.setHex(flashT < 0.12 && flashT > 0 ? 0xffffff : 0x666670);
      if (flashT <= -0.1) { flashT = rand(2, 6); ctx.api.playNoise({ duration: 0.9, gain: 0.12, filterFreq: 200 }); }
    },
  };
}

// =====================================================================
// Mission 4 — Storm Signal (race through rings)
// =====================================================================
function missionRings(ctx) {
  const { THREE, scene, api, hero, V } = ctx;
  const root = new THREE.Group();
  scene.add(root);
  const solid = api.buildings.filter(b => b.geometry.parameters.height > 2);
  const inside = (p, m) => solid.some(b => {
    const q = b.geometry.parameters;
    return topOf(b) > p.y - m && Math.abs(p.x - b.position.x) < q.width / 2 + m && Math.abs(p.z - b.position.z) < q.depth / 2 + m;
  });
  const fwd = V(-Math.sin(hero.rotation.y + Math.PI), 0, -Math.cos(hero.rotation.y + Math.PI));
  const pts = [];
  let cur = hero.position.clone();
  let dir = Math.atan2(fwd.x, fwd.z);
  const CITY = api.CITY_SIZE - 25;
  for (let i = 0; i < 5; i++) {
    let p = null;
    for (let k = 0; k < 40; k++) {
      const a = dir + rand(-1.0, 1.0) + (k > 25 ? Math.PI : 0);
      const d = i === 0 ? rand(22, 30) : rand(30, 42);
      const q = V(cur.x + Math.sin(a) * d, rand(14, 38), cur.z + Math.cos(a) * d);
      if (Math.abs(q.x) > CITY || Math.abs(q.z) > CITY || inside(q, 4.5)) continue;
      p = q; dir = a; break;
    }
    if (!p) p = V(cur.x, cur.y + 8, cur.z);
    pts.push(p);
    cur = p;
  }
  const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false });
  const rings = pts.map((p, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.35, 10, 36), mat(0x5ef2ff, 0.9));
    m.position.copy(p);
    const next = pts[i + 1] || pts[i - 1];
    m.lookAt(next);
    m.visible = false;
    root.add(m);
    return m;
  });
  const skyC = (pts[2] || hero.position).clone();
  const sky = stormSky(ctx, root, skyC);
  let idx = 0, timeLeft = 40;
  const prev = hero.position.clone();
  // closest distance from a ring centre to the hero's path this frame (fast swings can skip past it)
  const seg = new THREE.Line3();
  const closest = new THREE.Vector3();
  function show() {
    rings.forEach((r, i) => {
      r.visible = i === idx || i === idx + 1;
      r.material.opacity = i === idx ? 0.95 : 0.35;
      r.material.color.setHex(i === idx ? (i === rings.length - 1 ? 0xffd23f : 0x5ef2ff) : 0x5ef2ff);
    });
    if (rings[idx]) ctx.setTarget(V(pts[idx].x, 0, pts[idx].z));
  }
  function hud() {
    ctx.setHud({ title: 'MISSION 4: STORM SIGNAL', objective: 'Swing through every glowing ring! Each ring gives you more time', info: `Rings ${idx}/${rings.length}`, timer: Math.max(0, Math.ceil(timeLeft)), warn: timeLeft < 8 ? 'Hurry!' : '' });
  }
  return {
    debug: { pts, get idx() { return idx; } },
    begin() {
      show();
      const p0 = pts[0];
      ctx.play([
        ...ctx.phone([
          'Whoa, look at the sky! A huge storm just appeared out of NOWHERE.',
          'My computer says someone is CONTROLLING it with a signal... and those glowing rings are boosting it!',
        ]),
        { text: 'Swing through every ring to scramble the storm signal — before time runs out!', snap: true, cam: ctx.orbit(p0, 14, 4, 0, 1.2) },
      ], hud);
    },
    anim(dt, t) {
      sky.anim(dt);
      for (const r of rings) if (r.visible) r.rotation.z += dt * 1.5;
      if (rings[idx]) rings[idx].scale.setScalar(1 + Math.sin(t * 6) * 0.06);
    },
    update(dt) {
      timeLeft -= dt;
      seg.set(prev, hero.position);
      seg.closestPointToPoint(pts[idx] || hero.position, true, closest);
      prev.copy(hero.position);
      if (rings[idx] && closest.distanceTo(pts[idx]) < 4.2) {
        api.spawnBurst(pts[idx].clone(), 0x5ef2ff, 14, { speed: 8, life: 0.5, size: 0.8, gravity: 0 });
        api.playTone({ freq: 880 + idx * 60, freqEnd: 1600 + idx * 60, duration: 0.18, type: 'triangle', gain: 0.13 });
        rings[idx].visible = false;
        idx++;
        timeLeft += 10;
        show();
      }
      hud();
      if (idx >= rings.length) {
        const look = V(skyC.x, 50, skyC.z);
        const away = hero.position.clone().sub(look).setY(0).normalize();
        const camP = hero.position.clone().addScaledVector(away, 10).add(V(0, 3, 0));
        ctx.finish('done', [
          { text: 'KRA-KOOOM! The storm signal is scrambled!', snap: true, cam: () => ({ pos: camP.clone(), look }),
            enter: () => bolt(ctx, root, V(skyC.x + 8, 0, skyC.z - 6)) },
          { who: 'STORM MASTER (from the clouds)', text: 'WHO DARES TO MESS WITH MY STORM?!', enter: () => bolt(ctx, root, V(skyC.x - 10, 0, skyC.z + 9)) },
          { who: 'STORM MASTER (from the clouds)', text: "You broke my signal... but you can't stop ME. I'll be back, little hero!" },
          ...ctx.phone(['Uh oh. That was the STORM MASTER — another one of the Boss\'s henchmen. Get ready!']).map(s => ({ ...s, snap: true })),
        ]);
      } else if (timeLeft <= 0) ctx.fail('Out of time! The storm signal got through. Try again!');
    },
    cleanup() { scene.remove(root); },
  };
}

// =====================================================================
// Mission 5 — Tornado Alley (rescue window cleaners, avoid the tornado)
// =====================================================================
function missionTornado(ctx) {
  const { THREE, scene, api, hero, V } = ctx;
  const root = new THREE.Group();
  scene.add(root);
  const anchor = pickBuilding(ctx, { minH: 22, maxH: 60, minD: 50, maxD: 110 });
  const center = V(anchor.position.x, 0, anchor.position.z);
  // tornado: stacked spinning rings + flying debris
  const tornado = new THREE.Group();
  // streaky grey texture so the spinning is visible
  const streak = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#6a707a'; g.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${pick(['30,32,38', '200,205,212'])},${rand(0.2, 0.6)})`;
      g.fillRect(rand(0, 128), rand(0, 32), rand(10, 40), rand(1, 4));
    }
    return new THREE.CanvasTexture(c);
  })();
  const layers = [];
  for (let i = 0; i < 9; i++) {
    const tMat = new THREE.MeshBasicMaterial({ map: streak, color: 0xb0b6c0, transparent: true, opacity: 0.55 + i * 0.03, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(2.6 + (i + 1) * 1.35, 2.6 + i * 1.35, 5, 20, 1, true), tMat);
    m.position.y = 2.5 + i * 5;
    tornado.add(m);
    layers.push(m);
  }
  const debris = [];
  const dMat = std(THREE, 0x6b5a48);
  for (let i = 0; i < 16; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(rand(0.3, 0.9), rand(0.2, 0.5), rand(0.3, 0.9)), dMat);
    tornado.add(d);
    debris.push({ d, h: rand(1, 40), a: rand(0, 6.28), s: rand(2, 4) });
  }
  root.add(tornado);
  const tr = runner(ctx, tornado, { speed: 6 });
  tornado.position.set(center.x + 25, 0, center.z);
  if (tr.blocked(tornado.position.x, tornado.position.z, 2)) tr.place(20, 40);
  // window cleaners on hanging platforms on nearby building faces
  const near = api.buildings.filter(b => {
    const h = b.geometry.parameters.height;
    return h > 20 && Math.hypot(b.position.x - center.x, b.position.z - center.z) < 70;
  });
  const spots = [];
  const platforms = [];
  const platMat = std(THREE, 0x8a8f99, { metalness: 0.5 });
  const ropeMat = std(THREE, 0x222222);
  const used = new Set();
  for (let i = 0; i < 5 && near.length; i++) {
    let b = pick(near);
    for (let k = 0; k < 8 && used.has(b); k++) b = pick(near);
    used.add(b);
    const P = b.geometry.parameters, top = topOf(b);
    const [nx, nz] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const along = rand(-0.5, 0.5);
    const y = rand(10, Math.min(30, top - 5));
    const x = b.position.x + nx * (P.width / 2 + 0.7) + (nz ? along * P.width : 0);
    const z = b.position.z + nz * (P.depth / 2 + 0.7) + (nx ? along * P.depth : 0);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(nz ? 2.6 : 1.3, 0.16, nz ? 1.3 : 2.6), platMat);
    plat.position.set(x, y, z);
    root.add(plat);
    api.buildings.push(plat); // the hero can land on it
    platforms.push(plat);
    for (const s of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, top - y, 4), ropeMat);
      rope.position.set(x + (nz ? s * 1.2 : 0), (top + y) / 2, z + (nx ? s * 1.2 : 0));
      root.add(rope);
    }
    spots.push({ pos: V(x, y + 0.08, z), edge: V(x + nx * 1.8, y + 0.08, z + nz * 1.8), facing: Math.atan2(nx, nz) });
  }
  // (not enough tall buildings nearby? put the rest on the anchor's roof)
  for (let k = 0; spots.length < 5 && k < 5; k++) spots.push(roofSpot(ctx, anchor, spots.map(s => s.pos)));
  const R = rescuers(ctx, root, spots);
  let timeLeft = 150, out = 0, flingCd = 0;
  const sky = stormSky(ctx, root, center);
  function hud() {
    ctx.setHud({ title: 'MISSION 5: TORNADO ALLEY', objective: 'Save the window cleaners stuck on the buildings — stay away from the tornado!', info: `Rescued ${R.saved}/${R.total}`, timer: Math.max(0, Math.ceil(timeLeft)), warn: timeLeft < 30 ? 'Hurry!' : '' });
  }
  return {
    debug: { R, tornado },
    begin() {
      ctx.setTarget(center);
      const tc = () => tornado.position.clone().add(V(0, 12, 0));
      ctx.play([
        ...ctx.phone([
          'The storm made a TORNADO! It\'s spinning right through downtown!',
          'Window cleaners are stuck on their platforms high up on the buildings!',
        ]),
        { text: 'Save all the window cleaners — and DON\'T get sucked into the tornado!', snap: true, cam: ctx.orbit(tc, 50, 32, 0, 0.8) },
      ], hud);
    },
    anim(dt, t) {
      sky.anim(dt);
      layers.forEach((m, i) => { m.rotation.y += dt * (6 - i * 0.4); m.position.x = Math.sin(t * 1.3 + i * 0.5) * i * 0.25; });
      for (const d of debris) {
        d.a += dt * d.s;
        const r = 3 + d.h * 0.3;
        d.d.position.set(Math.cos(d.a) * r, d.h, Math.sin(d.a) * r);
        d.d.rotation.x += dt * 3; d.d.rotation.y += dt * 2;
      }
      tornado.scale.setScalar(Math.max(0.01, 1 - out));
      R.anim(dt, t);
    },
    update(dt) {
      timeLeft -= dt;
      tr.drive(dt, false);
      // keep it near downtown
      if (Math.hypot(tornado.position.x - center.x, tornado.position.z - center.z) > 55) {
        const back = Math.atan2(center.x - tornado.position.x, center.z - tornado.position.z);
        tornado.rotation.y = back;
        tornado.position.x += Math.sin(back) * 4 * dt;
        tornado.position.z += Math.cos(back) * 4 * dt;
      }
      const d = Math.hypot(hero.position.x - tornado.position.x, hero.position.z - tornado.position.z);
      const reach = 3 + Math.max(0, hero.position.y) * 0.25;
      flingCd -= dt;
      if (d < reach && hero.position.y < 45 && flingCd <= 0) {
        flingCd = 1.2;
        api.damagePlayer(8, V(hero.position.x - tornado.position.x, 0, hero.position.z - tornado.position.z).normalize(), 18);
        api.heroVel.y = Math.max(api.heroVel.y, 14);
      }
      R.check();
      hud();
      if (R.saved >= R.total) {
        ctx.finish('done', [
          { text: 'Every window cleaner floats safely to the ground!', snap: true, cam: ctx.orbit(() => R.center().add(V(0, 1, 0)), 14, 10, 0.5, 1.3), update: (u) => { out = Math.min(1, u * 1.3); } },
          { text: '...and the tornado fizzles out into a little breeze.', update: () => { out = 1; } },
          ...ctx.phone([
            'You did it AGAIN! Okay, I tracked where the storm is coming from...',
            'The Storm Master is on top of the TALLEST building — the one with the helipad. Go get him!',
          ]).map((s, i) => ({ ...s, snap: i === 0 })),
        ]);
      } else if (timeLeft <= 0) ctx.fail('Time ran out! Try again — swing fast between the buildings!');
    },
    cleanup() {
      scene.remove(root);
      for (const p of platforms) { const i = api.buildings.indexOf(p); if (i >= 0) api.buildings.splice(i, 1); }
    },
  };
}

// =====================================================================
// Mission 6 — Storm Master (henchman fight on the helipad roof)
// =====================================================================
function missionStorm(ctx) {
  const { THREE, scene, api, V } = ctx;
  const zone = roofZone(api);
  const root = new THREE.Group();
  scene.add(root);
  const sky = stormSky(ctx, root, V(zone.x, zone.y - 30, zone.z), 70);
  return fightMission(ctx, {
    title: 'MISSION 6: STORM MASTER',
    zone,
    objective: 'Defeat the Storm Master! Watch for lightning circles and DODGE!',
    travelText: 'Swing to the top of the tallest building ⭐ — the Storm Master is waiting',
    makeFighters: (F) => { const f = stormFighter(ctx, F); f.place(V(zone.x, 0, zone.z)); return [f]; },
    intro: (F, [f]) => [
      ...ctx.phone([
        'The Storm Master is on top of the tallest building — on the helipad.',
        'Careful up there. His wind can blow you RIGHT off the roof!',
      ]),
      { text: 'Swing up to the helipad ⭐ to face the Storm Master.', snap: true, cam: ctx.orbit(() => f.headPos(), 16, 6, 0, 1.0) },
    ],
    preFight: (F, [f]) => [
      { who: f.name, text: 'Ah, the little hero. You stopped my signal AND my tornado.', snap: true, cam: f.closeCam },
      { who: f.name, text: "Let's see how you like... LIGHTNING!", enter: () => bolt(ctx, root, V(zone.x + 6, zone.y, zone.z - 5)) },
    ],
    winShots: (F, [f]) => henchWin(ctx, f, ['My storm... is fading...', "Fine! You win this time. But the MECH PILOT won't go easy on you!"],
      'WHOOSH! He blew away in a gust of wind!', ['Two henchmen down! You\'re unstoppable!', 'Hmm... I wonder who the Boss could be?']),
    loseShots: (F, [f], how) => henchLose(ctx, f, how,
      how === 'down' ? ['Blown away! Ha ha ha!', 'Go home, hero. The storm ALWAYS wins.'] : ['Running from a little rain? Ha!', 'The storm ALWAYS wins.'],
      "Are you okay? That wind was CRAZY. Don't give up — we'll get him next time!"),
    anim: (dt) => sky.anim(dt),
    cleanup: () => scene.remove(root),
  });
}

// =====================================================================
// Mission 7 — Drone Heist (chase a flying drone over the rooftops)
// =====================================================================
function makeDrone(THREE) {
  const group = new THREE.Group();
  const yellow = metalMaterial(THREE, { color: '#e8ad08', panels: 2, stripes: true, rust: 0.1, metalness: 0.35, roughness: 0.4 });
  const dark = metalMaterial(THREE, { color: '#24272d', panels: 3, rust: 0.3 });
  part(THREE, group, new THREE.BoxGeometry(1.8, 0.55, 1.8), yellow);
  part(THREE, group, new THREE.BoxGeometry(1.82, 0.2, 0.4), dark, 0, 0.05, 0);
  const rotors = [];
  for (const [x, z] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) {
    const arm = part(THREE, group, new THREE.BoxGeometry(0.25, 0.15, 2.3), dark, x / 2, 0.1, z / 2);
    arm.rotation.y = Math.atan2(x, z);
    part(THREE, group, new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), dark, x, 0.25, z);
    const r = part(THREE, group, new THREE.CylinderGeometry(1.0, 1.0, 0.04, 20), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.35 }), x, 0.48, z);
    rotors.push(r);
  }
  part(THREE, group, new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2030 }), 0, -0.1, 0.92);
  const crate = new THREE.Group();
  part(THREE, crate, new THREE.BoxGeometry(1.5, 1.2, 1.5), std(THREE, 0x8a5a2b));
  part(THREE, crate, new THREE.BoxGeometry(1.52, 0.15, 1.52), std(THREE, 0x5a3a1b), 0, 0.3, 0);
  crate.position.y = -2.2;
  group.add(crate);
  for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) part(THREE, group, new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), dark, x, -0.9, z);
  group.scale.setScalar(1.2);
  return { group, rotors, crate };
}
function missionDrone(ctx) {
  const { THREE, V, api } = ctx;
  const ALT = 32;
  const d = makeDrone(THREE);
  let fall = null;
  return chaseMission(ctx, {
    title: 'MISSION 7: DRONE HEIST', speed: 14, alt: ALT, dyMax: 8,
    obj: d.group,
    objective: 'Catch the drone! Swing up close to it to make it crash',
    failText: 'The drone flew away with the parts! Try again — swing high!',
    anim: (dt, t, c) => {
      for (const r of d.rotors) r.rotation.y += dt * 30;
      if (fall) {
        fall.v -= 25 * dt;
        d.group.position.y = Math.max(0.6, d.group.position.y + fall.v * dt);
        d.group.rotation.z += dt * 3;
        if (d.group.position.y <= 0.6 && !fall.landed) {
          fall.landed = true;
          api.spawnBurst(d.group.position.clone().add(V(0, 1, 0)), 0xff7a2a, 26, { speed: 11, life: 0.8, size: 1.3, gravity: -12 });
          api.playNoise({ duration: 0.8, gain: 0.45, filterFreq: 400 });
          api.triggerShake(0.4, 0.4);
        }
      } else {
        d.group.position.y = ALT + Math.sin(t * 2) * 0.6;
        d.crate.rotation.y = Math.sin(t * 1.3) * 0.3;
      }
    },
    intro: (c) => [
      ...ctx.phone([
        'Someone is stealing ROBOT PARTS from the factory... with a giant drone!',
        'It\'s flying over the rooftops. Swing up there and catch it before it gets away!',
      ]),
      { text: 'The drone is carrying a crate of stolen parts!', snap: true, cam: c.chaseCam, dur: 4.5, update: (u, dt) => c.r.drive(dt, false) },
      ...ctx.phone(['Get close to the drone and stay close — it will overheat and crash!']).map(s => ({ ...s, snap: true })),
    ],
    outro: (c) => [
      { text: 'Sparks fly... and the drone CRASHES to the street!', snap: true, dur: 4.5,
        cam: () => ({ pos: c.pos().clone().add(V(14, 8, 14)), look: c.pos().clone() }),
        enter: () => { fall = { v: 0, landed: false }; api.spawnBurst(c.pos().clone(), 0xffe066, 16, { speed: 7, life: 0.5, size: 0.8 }); } },
      { who: 'MECH PILOT (drone speaker)', text: 'HEY! Those are MY parts! You\'ll pay for that, web-head!', update: () => { if (!fall) fall = { v: 0, landed: false }; } },
      ...ctx.phone([
        'The Mech Pilot! That\'s henchman number THREE. He\'s building something BIG...',
        'And some parts already got away before you caught the drone. We have to find them!',
      ]).map((s, i) => ({ ...s, snap: i === 0 })),
    ],
  });
}

// =====================================================================
// Mission 8 — Spare Parts (collect 8 parts around the city)
// =====================================================================
function makeGear(THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7a10, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.35 });
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.25, 8, 18), mat));
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.3), mat);
    const a = i / 8 * Math.PI * 2;
    t.position.set(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0);
    t.rotation.z = a;
    g.add(t);
  }
  return g;
}
function missionParts(ctx) {
  const { THREE, scene, api, hero, V } = ctx;
  const root = new THREE.Group();
  scene.add(root);
  const solid = api.buildings.filter(b => b.geometry.parameters.height > 2);
  const blocked = (x, z) => solid.some(b => {
    const q = b.geometry.parameters;
    return Math.abs(x - b.position.x) < q.width / 2 + 2 && Math.abs(z - b.position.z) < q.depth / 2 + 2;
  });
  const spots = [];
  const used = [];
  for (let i = 0; i < 4; i++) {
    const b = pickBuilding(ctx, { minH: 12, maxH: 50, minD: 25, maxD: 130, exclude: used });
    used.push(b);
    spots.push(roofSpot(ctx, b).pos.add(V(0, 1.2, 0)));
  }
  for (let i = 0; i < 4; i++) {
    let p = null;
    for (let k = 0; k < 60 && !p; k++) {
      const a = rand(0, Math.PI * 2), d = rand(30, 130);
      const x = hero.position.x + Math.cos(a) * d, z = hero.position.z + Math.sin(a) * d;
      if (Math.abs(x) < api.CITY_SIZE - 20 && Math.abs(z) < api.CITY_SIZE - 20 && !blocked(x, z)) p = V(x, 1.2, z);
    }
    spots.push(p || V(rand(-40, 40), 1.2, rand(-40, 40)));
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  const parts = spots.map(p => {
    const g = makeGear(THREE);
    g.position.copy(p);
    root.add(g);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 70, 8, 1, true), beamMat);
    beam.position.set(p.x, p.y + 35, p.z);
    root.add(beam);
    return { g, beam, p, got: false };
  });
  let got = 0, timeLeft = 200;
  function markers() { ctx.setMarkers(parts.filter(q => !q.got).map(q => ({ x: q.p.x, z: q.p.z, icon: '⚙️' }))); }
  function hud() {
    ctx.setHud({ title: 'MISSION 8: SPARE PARTS', objective: 'Find the 8 glowing robot parts ⚙️ (look for the orange beams!)', info: `Parts ${got}/8`, timer: Math.max(0, Math.ceil(timeLeft)), warn: timeLeft < 30 ? 'Hurry!' : '' });
  }
  const mech = makeMech(THREE);
  mech.group.visible = false;
  mech.group.position.set(ARENA.x, 0, ARENA.z);
  root.add(mech.group);
  return {
    debug: { parts },
    begin() {
      markers();
      ctx.play([
        ...ctx.phone([
          'The parts that got away are scattered ALL over the city!',
          'If the Mech Pilot gets them, he can finish his giant robot. Find all 8 before he does!',
        ]),
        { text: 'Look for the orange beams — and the ⚙️ on your map!', snap: true, cam: ctx.orbit(parts[0].p, 10, 4, 0, 1.2) },
      ], hud);
    },
    anim(dt, t) {
      for (const q of parts) {
        if (q.got) continue;
        q.g.rotation.y += dt * 2;
        q.g.position.y = q.p.y + Math.sin(t * 2 + q.p.x) * 0.3;
      }
    },
    update(dt) {
      timeLeft -= dt;
      for (const q of parts) {
        if (q.got) continue;
        if (Math.hypot(hero.position.x - q.p.x, hero.position.z - q.p.z) < 2.8 && Math.abs(hero.position.y - 1.5 - (q.p.y - 1.2)) < 2.6) {
          q.got = true;
          got++;
          root.remove(q.g);
          root.remove(q.beam);
          api.spawnBurst(q.p.clone(), 0xffa040, 14, { speed: 6, life: 0.5, size: 0.8 });
          api.playTone({ freq: 600, freqEnd: 1200, duration: 0.2, type: 'square', gain: 0.1 });
          api.showMsg(got < 8 ? `Part found! ${8 - got} to go` : 'All parts found!', 1300);
          markers();
        }
      }
      hud();
      if (got >= 8) {
        ctx.setMarkers([]);
        const mc = () => mech.group.position.clone().add(V(0, 4.5, 0));
        ctx.finish('done', [
          { text: 'You found every single part!', snap: true, cam: ctx.phoneCam() },
          { who: 'MECH PILOT (radio)', text: 'WHAT?! You took ALL my parts?!' },
          { who: 'MECH PILOT', text: 'Fine... my mech is already strong enough. Meet me at the PLAZA, hero!', snap: true,
            enter: () => { mech.group.visible = true; mech.group.rotation.y = 0; api.triggerShake(0.3, 0.5); },
            cam: () => ({ pos: mc().add(V(0, -2, 11)), look: mc() }) },
          ...ctx.phone(['He has a GIANT ROBOT SUIT?! ...Okay. Deep breath. You can do this!']).map(s => ({ ...s, snap: true })),
        ]);
      } else if (timeLeft <= 0) ctx.fail('Time ran out! Try again — follow the ⚙️ on your map!');
    },
    cleanup() { scene.remove(root); ctx.setMarkers([]); },
  };
}

// =====================================================================
// Mission 9 — Mech Pilot (henchman fight at the plaza)
// =====================================================================
function missionMech(ctx) {
  const { V } = ctx;
  const zone = arenaZone();
  return fightMission(ctx, {
    title: 'MISSION 9: MECH PILOT',
    zone,
    objective: 'Defeat the Mech Pilot! Dodge the missiles and the stomp waves!',
    travelText: 'Swing to the plaza ⭐ — the Mech Pilot is waiting in his giant robot',
    makeFighters: (F) => { const f = mechFighter(ctx, F); f.place(V(zone.x, 0, zone.z)); return [f]; },
    intro: (F, [f]) => [
      ...ctx.phone([
        'The Mech Pilot is at the plaza in his giant robot suit.',
        'It\'s slow, but it hits SUPER hard. Watch out for missiles from the sky!',
      ]),
      { text: 'Swing to the plaza ⭐ to face the Mech Pilot.', snap: true, cam: ctx.orbit(() => f.headPos(), 18, 2, 0, 1.0) },
    ],
    preFight: (F, [f]) => [
      { who: f.name, text: 'Systems ONLINE. Target: annoying web-head.', snap: true, cam: f.closeCam },
      { who: f.name, text: 'Prepare to be CRUSHED!', enter: () => ctx.api.triggerShake(0.4, 0.5) },
    ],
    winShots: (F, [f]) => henchWin(ctx, f, ['Warning... warning... SYSTEMS FAILING!', 'My beautiful robot! You BROKE it! The FIRE MONSTER will melt you for this!'],
      'The Mech Pilot jumps out of his robot and runs away!', ['THREE henchmen down! Only one left...', "I've heard the last one is made of FIRE. Gulp."]),
    loseShots: (F, [f], how) => henchLose(ctx, f, how,
      ['Target... SQUASHED! Ha!', 'Next time, bring a bigger web!'],
      "Whoa, that robot is TOUGH. You okay? We'll beat him next time, I know it!"),
  });
}

// =====================================================================
// Mission 10 — Rooftop Blaze (three burning roofs, three people on each)
// =====================================================================
function missionBlaze(ctx) {
  const { THREE, scene, api, V } = ctx;
  const root = new THREE.Group();
  scene.add(root);
  const b1 = pickBuilding(ctx);
  const others = [];
  for (let i = 0; i < 2; i++) {
    others.push(pickBuilding(ctx, { from: b1.position, minD: 18, maxD: 65, minH: 16, maxH: 45, exclude: [b1, ...others] }));
  }
  const blds = [b1, ...others];
  const fires = blds.map(b => buildingFire(ctx, root, b));
  const spots = [];
  for (const b of blds) {
    const taken = [];
    for (let i = 0; i < 3; i++) {
      const s = roofSpot(ctx, b, taken);
      taken.push(s.pos);
      spots.push(s);
    }
  }
  const R = rescuers(ctx, root, spots);
  let timeLeft = 210;
  const fm = makeFireMonster(THREE, ctx.tex);
  fm.group.visible = false;
  root.add(fm.group);
  function markers() {
    ctx.setMarkers(fires.filter((f, i) => R.people.slice(i * 3, i * 3 + 3).some(p => p.state === 'wait')).map(f => ({ x: f.cx, z: f.cz, icon: '🔥' })));
  }
  function hud() {
    ctx.setHud({ title: 'MISSION 10: ROOFTOP BLAZE', objective: 'THREE roofs are burning 🔥 Save everyone on all of them!', info: `Rescued ${R.saved}/${R.total}`, timer: Math.max(0, Math.ceil(timeLeft)), warn: timeLeft < 30 ? 'Hurry! The fires are spreading!' : '' });
  }
  return {
    debug: { R },
    begin() {
      markers();
      ctx.setTarget(fires[0].center());
      const c = fires[0].center();
      ctx.play([
        ...ctx.phone([
          'THREE buildings are on fire at the same time! This has to be the Fire Monster.',
          'There are people on every roof. Save them ALL!',
        ]),
        { text: 'Three burning roofs — nine people to save!', snap: true, cam: ctx.orbit(c, 40, 22, 0, 0.9) },
      ], hud);
    },
    anim(dt, t) {
      for (const f of fires) f.anim(dt, t);
      R.anim(dt, t);
    },
    update(dt) {
      timeLeft -= dt;
      const before = R.saved;
      R.check();
      if (R.saved !== before) {
        markers();
        const left = fires.find((f, i) => R.people.slice(i * 3, i * 3 + 3).some(p => p.state === 'wait'));
        ctx.setTarget(left ? left.center() : null);
      }
      hud();
      if (R.saved >= R.total) {
        ctx.setMarkers([]);
        const street = V(b1.position.x + b1.geometry.parameters.width / 2 + 6, 0, b1.position.z);
        const fc = () => fm.group.position.clone().add(V(0, 3, 0));
        ctx.finish('done', [
          { text: 'All nine people are safe — and the fires go out!', snap: true, cam: ctx.orbit(() => R.center().add(V(0, 1, 0)), 14, 12, 0, 0.8),
            update: (u) => { for (const f of fires) f.out = Math.min(1, u * 1.4); } },
          { who: 'FIRE MONSTER', text: 'ROOOAAAR! You put out my FIRES?!', snap: true,
            enter: () => { for (const f of fires) f.out = 1; fm.group.position.copy(street); fm.group.visible = true; api.triggerShake(0.3, 0.4); },
            cam: () => ({ pos: fc().add(V(-7, 1, 6)), look: fc() }) },
          { who: 'FIRE MONSTER', text: "Then I'll burn the WHOLE CITY! Try and catch me, hero!" },
          ...ctx.phone(["It's running away — after it! Watch out for its burning footprints!"]).map(s => ({ ...s, snap: true })),
        ]);
      } else if (timeLeft <= 0) ctx.fail('The fires got too big! Try again — swing fast between the roofs!');
    },
    cleanup() { scene.remove(root); ctx.setMarkers([]); },
  };
}

// =====================================================================
// Mission 11 — Trail of Flames (chase the Fire Monster, avoid its fire)
// =====================================================================
function missionFlames(ctx) {
  const { THREE, scene, api, hero, V } = ctx;
  const fm = makeFireMonster(THREE, ctx.tex);
  const setPose = poser(fm);
  const pools = [];
  const poolRoot = new THREE.Group();
  scene.add(poolRoot);
  let dropT = 0, walk = 0, hitCd = 0;
  const fakeF = { state: 'chase', downT: 0 };
  function dropPool(p) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.8, 16), new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.75, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.tex.fire, transparent: true, depthWrite: false }));
    fl.scale.set(2.4, 3.4, 1);
    fl.position.y = 1.4;
    g.add(fl);
    g.position.set(p.x, 0.06, p.z);
    poolRoot.add(g);
    pools.push({ g, fl, disc, life: 6 });
  }
  return chaseMission(ctx, {
    title: 'MISSION 11: TRAIL OF FLAMES', speed: 14.5, alt: null, catchDist: 8,
    obj: fm.group,
    objective: 'Chase the Fire Monster! Stay close — but don\'t step in the fire!',
    failText: 'The Fire Monster got away! Try again — swing to keep up!',
    anim: (dt, t, c) => {
      walk += dt * 12;
      const s = Math.sin(walk) * 0.7;
      setPose(WALK(s, 0.35), dt * 10);
      fm.tick(dt, t, fakeF);
      for (let i = pools.length - 1; i >= 0; i--) {
        const p = pools[i];
        p.life -= dt;
        const k = Math.min(1, p.life) * (0.85 + Math.sin(t * 13 + i) * 0.15);
        p.fl.scale.set(2.4 * k, 3.4 * k, 1);
        p.disc.material.opacity = 0.75 * Math.min(1, p.life);
        if (p.life <= 0) { poolRoot.remove(p.g); pools.splice(i, 1); }
      }
    },
    tick: (dt, t, c) => {
      dropT -= dt;
      if (dropT <= 0) { dropT = 0.35; dropPool(c.pos()); }
      hitCd -= dt;
      if (hitCd <= 0 && hero.position.y - 1.5 < 1.0) {
        for (const p of pools) {
          if (Math.hypot(hero.position.x - p.g.position.x, hero.position.z - p.g.position.z) < 1.8) {
            hitCd = 0.6;
            api.damagePlayer(6, V(0, 0, 1), 2);
            break;
          }
        }
      }
    },
    intro: (c) => [
      ...ctx.phone(['The Fire Monster is running through the streets!', "It's leaving FIRE everywhere it steps. Chase it — but don't step in the flames!"]),
      { text: 'The Fire Monster stomps away, leaving a trail of flames!', snap: true, cam: c.chaseCam, dur: 4.5, update: (u, dt) => { c.r.drive(dt, false); dropT -= dt; if (dropT <= 0) { dropT = 0.35; dropPool(c.pos()); } } },
      ...ctx.phone(['Stay close to it until it gets tired!']).map(s => ({ ...s, snap: true })),
    ],
    outro: (c) => {
      const fc = () => c.pos().clone().add(V(0, 3.5, 0));
      return [
        { who: 'FIRE MONSTER', text: 'Huff... huff... Hot on my trail, huh?', snap: true,
          enter: () => { fm.group.rotation.y = Math.atan2(hero.position.x - c.pos().x, hero.position.z - c.pos().z); },
          cam: () => { const f = V(Math.sin(fm.group.rotation.y), 0, Math.cos(fm.group.rotation.y)); return { pos: fc().addScaledVector(f, 7).add(V(1, 0, 0)), look: fc() }; } },
        { who: 'FIRE MONSTER', text: 'Then come to the PLAZA... and face the HEAT! ROOOAAAR!' },
        { text: 'WHOOSH! It vanishes in a burst of flames!', dur: 3, enter: () => {
          api.spawnBurst(fc(), 0xff7a2a, 30, { speed: 10, life: 0.8, size: 1.3 });
          ctx.puff(fc(), 1.4);
          fm.group.visible = false;
        } },
        ...ctx.phone(["This is the LAST henchman. After this, we'll finally find out who the Boss is!"]).map(s => ({ ...s, snap: true })),
      ];
    },
    cleanup: () => scene.remove(poolRoot),
  });
}

// =====================================================================
// Mission 12 — Fire Monster (henchman fight at the plaza)
// =====================================================================
function missionFire(ctx) {
  const { V } = ctx;
  const zone = arenaZone();
  return fightMission(ctx, {
    title: 'MISSION 12: FIRE MONSTER',
    zone,
    objective: "Defeat the Fire Monster! Don't stand in the fire puddles!",
    travelText: 'Swing to the plaza ⭐ — the Fire Monster is waiting',
    makeFighters: (F) => { const f = fireFighter(ctx, F); f.place(V(zone.x, 0, zone.z)); return [f]; },
    intro: (F, [f]) => [
      ...ctx.phone([
        'The Fire Monster is at the plaza. It throws fireballs that leave burning puddles.',
        "Don't stand in the fire! Keep moving and punch it when you can.",
      ]),
      { text: 'Swing to the plaza ⭐ to face the Fire Monster.', snap: true, cam: ctx.orbit(() => f.headPos(), 15, 2, 0, 1.0) },
    ],
    preFight: (F, [f]) => [
      { who: f.name, text: 'ROOOAAAR! Time to turn up the HEAT!', snap: true, cam: f.closeCam, enter: () => F.shockwave(f.group.position, 10, 12, 0, 0xff5a14) },
    ],
    winShots: (F, [f]) => henchWin(ctx, f, ['My flames... are... going out...', "The BOSS will get you for this! And you'll NEVER guess who it is!"],
      'The Fire Monster crumbles into a pile of smoking rocks... and disappears!', ['ALL FOUR henchmen are done! You did it!', "Hang on... I'm getting a weird signal. Let me check something. I'll call you back."]),
    loseShots: (F, [f], how) => henchLose(ctx, f, how,
      ['HA! Too hot to handle!', 'The Boss is going to LOVE this!'],
      "Ouch, that looked HOT. Are you okay? We'll cool that monster down next time!"),
  });
}

// =====================================================================
// Mission 13 — the finale: Kai is the Boss!
// =====================================================================
function missionFinale(ctx) {
  const { THREE, scene, api, hero, V } = ctx;
  const zone = roofZone(api);
  const root = new THREE.Group();
  scene.add(root);
  const sky = stormSky(ctx, root, V(zone.x, zone.y - 30, zone.z), 70);
  const kai = makeKai(THREE);
  kai.group.position.set(zone.x, zone.y, zone.z);
  root.add(kai.group);
  const lost = ctx.results();
  const comeback = [[3, ninjaFighter], [6, stormFighter], [9, mechFighter], [12, fireFighter]].filter(([n]) => lost[n] === 'lost');
  let boss = null;
  return fightMission(ctx, {
    title: 'MISSION 13: THE BOSS',
    zone,
    finale: true,
    objective: comeback.length ? 'Defeat the Boss — and the henchmen who came back!' : 'Defeat the Boss!',
    travelText: 'Meet Kai on top of the tallest building ⭐',
    makeFighters: (F) => {
      boss = bossFighter(ctx, F);
      boss.keep = true; // stays (kneeling) for the unmasking even if henchmen are still up
      boss.place(V(zone.x, 0, zone.z));
      boss.group.visible = false;
      const extra = comeback.map(([n, make], i) => {
        const f = make(ctx, F, 0.6);
        const a = (i / Math.max(1, comeback.length)) * Math.PI * 2 + 0.6;
        f.place(V(zone.x + Math.cos(a) * 10, 0, zone.z + Math.sin(a) * 10));
        f.group.visible = false;
        return f;
      });
      return [boss, ...extra];
    },
    intro: () => [
      ...ctx.phone([
        'Hey buddy... I found the Boss\'s SECRET HIDEOUT. It\'s on top of the tallest building.',
        'Meet me up there. Come alone. I mean — hurry!',
      ]),
      { text: 'Kai is waiting on the helipad ⭐', snap: true, cam: ctx.orbit(() => kai.group.position.clone().add(V(0, 2, 0)), 9, 2.5, 0, 1.0),
        enter: () => { kai.group.rotation.y = 0; } },
    ],
    preFight: (F, fs) => {
      const kc = () => kai.group.position.clone().add(V(0, 2.2, 0));
      // from the side, so Kai and the hero are both in the picture
      const kaiCam = () => {
        const f = V(hero.position.x - kai.group.position.x, 0, hero.position.z - kai.group.position.z).normalize();
        const side = V(-f.z, 0, f.x);
        return { pos: kc().addScaledVector(side, 5).addScaledVector(f, 2.2).add(V(0, 0.4, 0)), look: kc().addScaledVector(f, 1.5) };
      };
      const extras = fs.slice(1);
      return [
        { who: 'KAI', text: 'You came! I knew you would. You ALWAYS do.', snap: true, cam: kaiCam,
          enter: () => { kai.group.rotation.y = Math.atan2(hero.position.x - kai.group.position.x, hero.position.z - kai.group.position.z); } },
        { who: 'KAI', text: "You know... I've watched you be the hero for SO long. Everyone cheers for YOU." },
        { who: 'KAI', text: 'Nobody EVER cheers for the guy on the phone.' },
        { who: 'KAI', text: 'So I made some... friends. The ninja. The storm. The mech. The monster.' },
        { who: 'KAI', text: "That's right. I'M THE BOSS!", dur: 3.5,
          enter: () => {
            api.triggerShake(0.5, 0.6);
            boss.group.position.copy(kai.group.position);
            boss.group.rotation.y = kai.group.rotation.y;
            kai.group.visible = false;
            boss.appear();
            api.playNoise({ duration: 1.2, gain: 0.4, filterFreq: 200 });
          } },
        ...(extras.length ? [{ who: 'THE BOSS (KAI)', text: 'And look who I brought back... the henchmen who BEAT you!',
          cam: ctx.orbit(V(zone.x, zone.y + 2, zone.z), 22, 10, 0, 0.8),
          enter: () => { for (const f of extras) f.appear(); } }]
          : [{ who: 'THE BOSS (KAI)', text: 'You beat ALL my henchmen... so I\'ll beat you MYSELF!' }]),
        { who: 'THE BOSS (KAI)', text: 'Now I have ALL their powers. Let\'s see who the real hero is!', cam: boss.closeCam },
      ];
    },
    winShots: (F, fs) => {
      const kc = () => kai.group.position.clone().add(V(0, 2.2, 0));
      // from the side, so Kai and the hero are both in the picture
      const kaiCam = () => {
        const f = V(hero.position.x - kai.group.position.x, 0, hero.position.z - kai.group.position.z).normalize();
        const side = V(-f.z, 0, f.x);
        return { pos: kc().addScaledVector(side, 5).addScaledVector(f, 2.2).add(V(0, 0.4, 0)), look: kc().addScaledVector(f, 1.5) };
      };
      return [
        { text: 'The Boss falls to one knee... and the mask cracks!', snap: true, cam: ctx.orbit(() => boss.group.position.clone().add(V(0, 1.2, 0)), 6, 2.5, 0, 1.0),
          enter: () => { for (const f of fs) if (f !== boss) f.vanish(); } },
        { who: 'KAI', text: 'I... I lost. You really ARE the hero.', snap: true, cam: kaiCam,
          enter: () => {
            for (const f of fs) if (f !== boss) f.vanish();
            kai.group.position.copy(boss.group.position);
            // the hero steps back so they face each other
            const away = V(hero.position.x - kai.group.position.x, 0, hero.position.z - kai.group.position.z);
            if (away.lengthSq() < 0.01) away.set(0, 0, 1);
            away.normalize();
            hero.position.x = kai.group.position.x + away.x * 4;
            hero.position.z = kai.group.position.z + away.z * 4;
            hero.position.y = zone.y + 1.5; // (in case the last punch knocked them off the edge)
            hero.rotation.y = Math.atan2(-away.x, -away.z);
            kai.group.rotation.y = Math.atan2(hero.position.x - kai.group.position.x, hero.position.z - kai.group.position.z);
            boss.vanish();
            kai.group.visible = true;
            kai.armR.rotation.x = 0;
          } },
        { who: 'KAI', text: "I'm sorry. I just wanted to feel special too." },
        { who: YOU, text: 'Kai... you WERE special. You were my best friend the whole time.' },
        { who: YOU, text: "Being a hero isn't about people cheering. It's about HELPING." },
        { who: 'KAI', text: '...Can I help for real this time? Like... a team?' },
        { who: YOU, text: 'Team Skyline. Let\'s go. 🕷️', cam: ctx.orbit(() => kai.group.position.clone().add(V(0, 2, 0)), 10, 4, 0, 1.2), dur: 4 },
        { text: 'THE END ...of the story. But Meridian City still needs its hero!', dur: 4.5,
          cam: () => ({ pos: V(zone.x + 60, zone.y + 30, zone.z + 60), look: V(zone.x, zone.y, zone.z) }) },
      ];
    },
    anim: (dt, t) => {
      sky.anim(dt);
      if (kai.group.visible) {
        kai.armR.rotation.x = -0.9 + Math.sin(t * 2) * 0.05; // looking at the phone
        if (kai.update) kai.update(dt);
      }
    },
    cleanup: () => scene.remove(root),
  });
}

export const PART2_FACTORIES = [missionRings, missionTornado, missionStorm, missionDrone, missionParts, missionMech, missionBlaze, missionFlames, missionFire, missionFinale];
