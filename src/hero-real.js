// The realistic hero: Quaternius "Universal Base Characters" Superhero male
// (CC0) animated with clips from the Quaternius "Universal Animation Library"
// (CC0, same skeleton). Files are in public/models (shrunk with gltf-transform:
// 1024px webp textures, finger tracks dropped).
//
// It replaces the old shape-built body once loaded (the old one stays as a
// fallback if loading fails). Outfits are painted onto the skin texture in a
// shader, by body area in the model's rest pose (head, hands, legs, feet),
// keeping the skin's muscle shading so suits look stretched over a real body.

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OUTFITS, SUIT_COLOURS } from './hero.js';
import { makeShell, makeSneakers } from './hero-wear.js';
import { metalEnvTex } from './surfaces.js';

const MODEL_H = 1.81; // model height in its own units (feet at 0)
const HERO_H = 2.5; // game hero height

// clip used for each movement mode
const BASE = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop',
  jump: 'Jump_Loop', fall: 'Jump_Loop', swing: 'Jump_Loop', zip: 'Jump_Loop', wall: 'Sprint_Loop',
};

export function loadRealHero(THREE, rig) {
  const api = {
    ready: false,
    update() {},
    oneShot() {},
    applyOutfit(id, mask) { pending = { id, mask }; },
  };
  let pending = { id: 'classic', mask: true };

  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync('/models/hero.glb'), loader.loadAsync('/models/hero-anims.glb'),
    loader.loadAsync('/models/hero-hair.glb').catch(() => null),
  ]).then(([g, a, hairDoc]) => {
    const model = g.scene;
    model.scale.setScalar(HERO_H / MODEL_H);
    model.position.y = -1.5;
    let bodyMesh = null, eyeMeshes = [], hairMeshes = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // skinned bounds don't follow the animation
      const n = (o.material && o.material.name) || '';
      if (/Superhero/i.test(n)) bodyMesh = o;
      else if (/Eye/i.test(n)) eyeMeshes.push(o);
      else if (/Hair/i.test(n)) hairMeshes.push(o);
    });
    if (!bodyMesh) throw new Error('hero body mesh not found');

    // hair (Simple Parted style, a separate mesh in the model's rest-pose space):
    // pin it to the head bone so it follows the head
    if (hairDoc) {
      const head = model.getObjectByName('Head');
      model.updateMatrixWorld(true);
      const hairs = [];
      hairDoc.scene.traverse(o => { if (o.isMesh) hairs.push(o); });
      for (const h of hairs) {
        h.castShadow = true;
        model.add(h);
        h.updateMatrixWorld(true);
        if (head) head.attach(h);
        hairMeshes.push(h);
      }
    }

    // the pack's hair texture is grey (meant to be tinted): dark brown hair + brows
    for (const h of hairMeshes) {
      h.material = h.material.clone();
      h.material.color.set(0x4a2f1c);
      h.material.roughness = 0.75;
    }

    // eye position in rest pose (for the mask lenses and where the head starts)
    const eyeBox = new THREE.Box3();
    for (const m of eyeMeshes) { m.geometry.computeBoundingBox(); eyeBox.union(m.geometry.boundingBox); }
    const eyeY = eyeMeshes.length ? (eyeBox.min.y + eyeBox.max.y) / 2 : 1.66;
    const eyeZ = eyeMeshes.length ? eyeBox.max.z : 0.1;
    const eyeX = eyeMeshes.length ? Math.max(0.025, (eyeBox.max.x - eyeBox.min.x) / 4) : 0.033;

    // ---- real clothes + sneakers for the street outfits ----
    const hipY = eyeY * 0.56, neckY = eyeY - 0.16, wristX = eyeY * 0.39, ankleY = 0.09;
    const top = { yMin: hipY - 0.05, yMax: neckY, axMax: wristX - 0.02 };
    const legsArea = { yMin: ankleY, yMax: hipY + 0.03 };
    const wear = {
      hoodie: makeShell(THREE, bodyMesh, top, 0.024, '#8d939b'),
      tee: makeShell(THREE, bodyMesh, { yMin: hipY - 0.05, yMax: neckY, axMax: 0.3 }, 0.01, '#f2f2f2'),
      // open jacket: no fabric down the middle of the chest, so the T-shirt shows
      jacket: makeShell(THREE, bodyMesh, { ...top, yMax: neckY - 0.01, openFront: 0.08 }, 0.034, '#3d5a3d'),
      jeansBlue: makeShell(THREE, bodyMesh, legsArea, 0.014, '#3f5f8f', 'denim'),
      jeansDark: makeShell(THREE, bodyMesh, legsArea, 0.014, '#2b3446', 'denim'),
    };
    const shoes = makeSneakers(THREE, bodyMesh);
    const WEAR = { hoodie: ['hoodie', 'jeansBlue'], jacket: ['tee', 'jacket', 'jeansDark'] };

    // ---- outfit shader on the body ----
    const mat = bodyMesh.material.clone();
    bodyMesh.material = mat;
    const U = {
      uMode: { value: 1 }, // 0 skin, 1 suit, 2 street clothes
      uMask: { value: 1 },
      uMain: { value: new THREE.Color() }, uSecond: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() }, uEmblem: { value: new THREE.Color() },
      uMaskCol: { value: new THREE.Color() }, uLens: { value: new THREE.Color() },
      uMetal: { value: 0.1 }, uRough: { value: 0.5 },
      uTop: { value: new THREE.Color() }, uSleeve: { value: new THREE.Color() }, uLegs: { value: new THREE.Color() },
      uEye: { value: new THREE.Vector3(eyeX, eyeY, eyeZ) },
    };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, U);
      shader.vertexShader = 'varying vec3 vBindPos;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\n vBindPos = position;');
      shader.fragmentShader = `
        varying vec3 vBindPos;
        uniform float uMode, uMask, uMetal, uRough;
        uniform vec3 uMain, uSecond, uAccent, uEmblem, uMaskCol, uLens, uTop, uSleeve, uLegs, uEye;
        float hexEdge(vec2 p) {
          vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
          vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
          vec2 g = dot(a, a) < dot(b, b) ? a : b;
          vec2 q = abs(g);
          float d = max(dot(q, vec2(0.5, 0.8660254)), q.x);
          return smoothstep(0.43, 0.5, d);
        }
        float star5(vec2 p, float r, float rf) {
          const vec2 k1 = vec2(0.809016994375, -0.587785252292);
          const vec2 k2 = vec2(-k1.x, k1.y);
          p.x = abs(p.x);
          p -= 2.0 * max(dot(k1, p), 0.0) * k1;
          p -= 2.0 * max(dot(k2, p), 0.0) * k2;
          p.x = abs(p.x);
          p.y -= r;
          vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
          float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
          return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
        }
      ` + shader.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float suitArea = 0.0;
          {
            vec3 skin = diffuseColor.rgb;
            float lum = dot(skin, vec3(0.299, 0.587, 0.114));
            float shade = clamp(lum / 0.5, 0.55, 1.4);       // keep the muscle shading
            float y = vBindPos.y, ax = abs(vBindPos.x);
            bool head = y > uEye.y - 0.15;
            bool hand = ax > 0.70;
            bool legs = y < 1.0;
            bool feet = y < 0.11;
            if (uMode > 0.5 && uMode < 1.5) {
              if (!(head && uMask < 0.5)) {
                suitArea = 1.0;
                vec3 c = (legs || hand) ? uSecond : uMain;
                if (feet) c = uMain;
                c = mix(c, uAccent, hexEdge(vMapUv * 38.0) * 0.55);
                // chest emblem
                vec2 e = vec2(vBindPos.x, y - (uEye.y - 0.29));
                if (vBindPos.z > 0.02 && length(e) < 0.085) {
                  c = uAccent;
                  if (star5(e, 0.06, 0.45) < 0.0) c = uEmblem;
                }
                if (head) {
                  c = uMaskCol;
                  c = mix(c, uAccent, hexEdge(vMapUv * 38.0) * 0.45);
                  // big white lenses over the eyes
                  vec2 l = vec2(ax - uEye.x - 0.006, y - uEye.y - 0.004);
                  l = vec2(l.x * cos(0.35) - l.y * sin(0.35), l.x * sin(0.35) + l.y * cos(0.35));
                  if (vBindPos.z > uEye.z - 0.06 && length(l / vec2(0.034, 0.021)) < 1.0) { c = uLens; suitArea = 0.0; shade = 1.2; }
                  else if (vBindPos.z > uEye.z - 0.06 && length(l / vec2(0.04, 0.027)) < 1.0) { c = vec3(0.03); }
                }
                diffuseColor.rgb = c * shade;
              }
            } else if (uMode > 1.5) {
              if (!head && !hand) {
                suitArea = 0.0;
                vec3 c = legs ? uLegs : (ax > 0.24 ? uSleeve : uTop);
                // woven fabric texture, and only a hint of the muscles underneath
                float weave = fract(sin(dot(floor(vMapUv * 500.0), vec2(12.9898, 78.233))) * 43758.5453);
                c *= legs ? 0.88 + 0.14 * weave : 0.94 + 0.08 * weave;
                if (feet) c = vec3(0.95);
                diffuseColor.rgb = c * mix(1.0, shade, 0.25);
              }
            }
          }`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, uMetal, suitArea);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, uRough, suitArea);
          if (uMode > 1.5 && !(vBindPos.y > uEye.y - 0.15) && abs(vBindPos.x) < 0.70) roughnessFactor = 0.95; // cloth isn't shiny`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          // clothes hide most of the muscle bumps from the normal map
          if (uMode > 1.5 && !(vBindPos.y > uEye.y - 0.15) && abs(vBindPos.x) < 0.70) normal = normalize(mix(normal, nonPerturbedNormal, 0.75));`);
    };
    mat.customProgramCacheKey = () => 'hero-outfit';
    mat.needsUpdate = true;

    function applyOutfit(id, maskOn) {
      const o = OUTFITS.find(x => x.id === id) || OUTFITS[0];
      const suit = o.kind === 'suit';
      const showMask = suit && maskOn;
      for (const m of eyeMeshes) m.visible = !showMask;
      for (const m of hairMeshes) m.visible = !showMask;
      U.uMask.value = showMask ? 1 : 0;
      const worn = WEAR[id] || [];
      for (const [k, m] of Object.entries(wear)) m.visible = worn.includes(k);
      for (const sh of shoes) sh.visible = !suit;
      // suits catch reflections from the city: gold gleams, the others have a soft sheen
      mat.envMap = metalEnvTex();
      mat.envMapIntensity = suit ? ((SUIT_COLOURS[id] || {}).metal > 0.5 ? 1.5 : 0.6) : 0.2;
      mat.needsUpdate = true;
      if (suit) {
        const c = SUIT_COLOURS[id] || SUIT_COLOURS.classic;
        U.uMode.value = 1;
        U.uMain.value.set(c.main); U.uSecond.value.set(c.second); U.uAccent.value.set(c.accent);
        U.uEmblem.value.set(c.emblem); U.uMaskCol.value.set(c.mask); U.uLens.value.set(c.lens);
        U.uMetal.value = c.metal; U.uRough.value = c.metal > 0.5 ? 0.3 : 0.45;
      } else {
        U.uMode.value = 2;
        const hoodie = id === 'hoodie';
        U.uTop.value.set(hoodie ? '#8d939b' : '#f2f2f2');
        U.uSleeve.value.set(hoodie ? '#8d939b' : '#3d5a3d');
        U.uLegs.value.set(hoodie ? '#3f5f8f' : '#2b3446');
      }
    }

    // ---- animation ----
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const clip of a.animations) actions[clip.name] = mixer.clipAction(clip);
    let base = null, baseName = '', shot = null, shotT = 0;
    function setBase(name, speed = 1) {
      const act = actions[name];
      if (!act) return;
      act.timeScale = speed;
      if (name === baseName) return;
      act.reset().setEffectiveWeight(1).fadeIn(0.18).play();
      if (base) base.fadeOut(0.18);
      base = act;
      baseName = name;
    }
    setBase('Idle_Loop');
    const bone = (n) => model.getObjectByName(n);
    const B = {
      uaR: bone('upperarm_r'), laR: bone('lowerarm_r'), hR: bone('hand_r'),
      uaL: bone('upperarm_l'), laL: bone('lowerarm_l'), hL: bone('hand_l'),
    };
    // turn a bone so the direction to its child points along `dir` (world space)
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
    function aim(b, child, dir, w) {
      if (!b || !child || w <= 0) return;
      b.getWorldPosition(_a);
      child.getWorldPosition(_b);
      _b.sub(_a).normalize();
      _q.setFromUnitVectors(_b, dir);
      b.getWorldQuaternion(_wq);
      _wq.premultiply(_q);
      b.parent.getWorldQuaternion(_pq);
      const target = _pq.invert().multiply(_wq);
      b.quaternion.slerp(target, w);
      b.updateMatrixWorld(true);
    }
    const _dir = new THREE.Vector3();
    let armW = 0;

    rig.flip.add(model);
    rig.body.visible = false;
    pending && applyOutfit(pending.id, pending.mask);

    api.ready = true;
    api.model = model;
    api.applyOutfit = applyOutfit;
    // one-off moves on top of the movement (punch, land, hit)
    api.oneShot = (name, dur) => {
      const act = actions[name];
      if (!act) return;
      if (shot && shot !== act) shot.fadeOut(0.08);
      act.reset().setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.setEffectiveWeight(1).fadeIn(0.06).play();
      shot = act;
      shotT = dur || act.getClip().duration * 0.85;
      if (base) base.setEffectiveWeight(0.0001);
    };
    // s: { mode, speed, anchor (world point the web is attached to, or null) }
    api.update = (dt, s) => {
      const mode = s.mode || 'idle';
      let speed = 1;
      if (mode === 'walk') speed = Math.max(0.6, s.speed / 2.5);
      if (mode === 'jog') speed = Math.max(0.8, s.speed / 6);
      if (mode === 'sprint' || mode === 'wall') speed = mode === 'wall' ? 1.3 : Math.max(0.9, s.speed / 10);
      setBase(BASE[mode] || 'Idle_Loop', speed);
      if (shot) {
        shotT -= dt;
        if (shotT <= 0) { shot.fadeOut(0.15); shot = null; if (base) base.setEffectiveWeight(1); }
      }
      mixer.update(dt);
      // web arm: reach up the web line while swinging / zipping
      const want = (mode === 'swing' || mode === 'zip') && s.anchor ? 1 : 0;
      armW += (want - armW) * Math.min(1, dt * 12);
      if (armW > 0.01 && s.anchor) {
        model.updateMatrixWorld(true);
        B.hR && B.hR.getWorldPosition(_a);
        _dir.copy(s.anchor).sub(_a).normalize();
        aim(B.uaR, B.laR, _dir, armW);
        aim(B.laR, B.hR, _dir, armW);
        if (mode === 'swing') {
          // other arm reaches up too, slightly behind
          _dir.y += 0.4;
          _dir.normalize();
          aim(B.uaL, B.laL, _dir, armW * 0.7);
          aim(B.laL, B.hL, _dir, armW * 0.7);
        }
      }
    };
  }).catch(err => {
    console.warn('Realistic hero failed to load, keeping the classic one:', err);
  });
  return api;
}
