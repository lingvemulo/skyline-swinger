// Realistic people for the city: Quaternius "Universal Base Characters"
// (CC0, man + woman bodies) with "Universal Animation Library" clips (CC0,
// same skeleton), hairstyles from the same pack. Files in public/models
// (packed by assets-source/pack-people.mjs).
//
// loadPeople(THREE) starts loading once; peopleReady() says whether
// makeRealPerson() can be used yet (callers keep their simple shape-built
// people as a fallback and for far-away "smooth mode" LOD).
//
// Clothes, suits and skin tone are painted onto the skin texture in a shader,
// by body area in the model's rest pose (same idea as the hero's outfits).

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

let A = null; // loaded assets
let loading = null;

export function peopleReady() { return !!A; }

export function loadPeople(THREE) {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const opt = (u) => loader.loadAsync(u).catch(() => null);
  loading = Promise.all([
    loader.loadAsync('/models/hero.glb'), loader.loadAsync('/models/person-female.glb'), loader.loadAsync('/models/hero-anims.glb'),
    opt('/models/hero-hair.glb'), opt('/models/hair-buzzed.glb'), opt('/models/hair-long.glb'), opt('/models/hair-beard.glb'),
  ]).then(([male, female, anims, parted, buzzed, long, beard]) => {
    const meshOf = (g) => { let m = null; if (g) g.scene.traverse(o => { if (o.isMesh && !m) m = o; }); return m; };
    A = {
      THREE,
      bodies: { male: prepBody(THREE, male.scene), female: prepBody(THREE, female.scene) },
      clips: Object.fromEntries(anims.animations.map(c => [c.name, c])),
      hair: { parted: meshOf(parted), buzzed: meshOf(buzzed), long: meshOf(long), beard: meshOf(beard) },
    };
    return A;
  }).catch(err => { console.warn('Realistic people failed to load:', err); return null; });
  return loading;
}

// measure a body once: where the eyes are (for the mask lenses / head line)
function prepBody(THREE, scene) {
  let body = null;
  const eyes = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    const n = (o.material && o.material.name) || '';
    if (/Superhero/i.test(n)) body = o;
    else if (/Eye/i.test(n)) eyes.push(o);
  });
  const box = new THREE.Box3();
  for (const m of eyes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  const eye = eyes.length
    ? new THREE.Vector3(Math.max(0.025, (box.max.x - box.min.x) / 4), (box.min.y + box.max.y) / 2, box.max.z)
    : new THREE.Vector3(0.033, 1.66, 0.1);
  return { scene, eye, bodyName: body ? body.name : '' };
}

// ---------- looks ----------
export const SKIN_TONES = ['#ffffff', '#f3d9c4', '#e0b48f', '#c18a63', '#8f5d3e', '#6b4330', '#4a2e20'];
export const HAIR_COLOURS = ['#1a1410', '#3b2414', '#5a3a22', '#8a5a2b', '#c8a060', '#9a9a9a', '#6b2410'];
const TOPS = ['#3b6ea5', '#8a3b3b', '#3b8a5e', '#6b5b95', '#d08a2a', '#c04880', '#e8e8e8', '#2b2b2b', '#5a7d9a', '#b8b07a'];
const LEGS = ['#2b3446', '#3f5f8f', '#1e1e24', '#6b5a44', '#4a4a4a', '#2f4a3a'];
const SHOES = ['#f2f2f2', '#1a1a1a', '#6b4a2b', '#b03030', '#2b4a8a'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// a random everyday person
export function randomCivilian() {
  const female = Math.random() < 0.5;
  const tshirt = Math.random() < 0.45;
  return {
    sex: female ? 'female' : 'male',
    skin: pick(SKIN_TONES),
    hair: female ? pick(['long', 'long', 'buzzed', 'parted']) : pick(['parted', 'buzzed', 'buzzed', 'parted']),
    beard: !female && Math.random() < 0.3,
    hairColour: pick(HAIR_COLOURS),
    outfit: { mode: 'clothes', top: pick(TOPS), sleeve: tshirt ? 'skin' : null, legs: pick(LEGS), shoes: pick(SHOES), shorts: Math.random() < 0.15 },
    scale: (female ? 0.94 : 1.0) * (0.95 + Math.random() * 0.08),
    slim: 0.6 + Math.random() * 0.4,
  };
}

// ---------- the outfit shader ----------
function outfitMaterial(THREE, base, eye) {
  const mat = base.clone();
  const U = {
    uMode: { value: 2 }, uMask: { value: 0 }, uSkin: { value: new THREE.Color('#ffffff') },
    uMain: { value: new THREE.Color() }, uSecond: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() },
    uEmblem: { value: new THREE.Color() }, uEmblemOn: { value: 0 }, uHex: { value: 0.5 },
    uMaskCol: { value: new THREE.Color() }, uLens: { value: new THREE.Color() },
    uMetal: { value: 0.1 }, uRough: { value: 0.5 },
    uTop: { value: new THREE.Color() }, uSleeve: { value: new THREE.Color() }, uSleeveSkin: { value: 0 },
    uLegs: { value: new THREE.Color() }, uShoes: { value: new THREE.Color() }, uShorts: { value: 0 },
    uTopSkin: { value: 0 }, uFeetSkin: { value: 0 }, uSkinMode: { value: 0 },
    uEye: { value: eye.clone() },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = 'varying vec3 vBindPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n vBindPos = position;');
    shader.fragmentShader = `
      varying vec3 vBindPos;
      uniform float uMode, uMask, uMetal, uRough, uEmblemOn, uHex, uSleeveSkin, uShorts, uTopSkin, uFeetSkin, uSkinMode;
      uniform vec3 uSkin, uMain, uSecond, uAccent, uEmblem, uMaskCol, uLens, uTop, uSleeve, uLegs, uShoes, uEye;
      float hexEdge(vec2 p) {
        vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        vec2 q = abs(g);
        return smoothstep(0.43, 0.5, max(dot(q, vec2(0.5, 0.8660254)), q.x));
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
        float cloth = 0.0;
        {
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // skin: tinted, or (uSkinMode 1) fully recoloured keeping the shading (purple Brute)
          vec3 skin = uSkinMode > 0.5 ? uSkin * lum * 1.9 : diffuseColor.rgb * uSkin;
          float shade = clamp(lum / 0.5, 0.55, 1.4);
          float y = vBindPos.y, ax = abs(vBindPos.x);
          float hipY = uEye.y * 0.56;
          bool head = y > uEye.y - 0.15;
          bool hand = ax > uEye.y * 0.39;
          bool legs = y < hipY;
          bool feet = y < uEye.y * 0.065;
          diffuseColor.rgb = skin;
          if (uMode > 0.5 && uMode < 1.5) {
            if (!(head && uMask < 0.5)) {
              suitArea = 1.0;
              vec3 c = (legs || hand) ? uSecond : uMain;
              if (feet) c = uMain;
              c = mix(c, uAccent, hexEdge(vMapUv * 38.0) * uHex);
              vec2 e = vec2(vBindPos.x, y - (uEye.y - 0.29));
              if (uEmblemOn > 0.5 && vBindPos.z > 0.02 && length(e) < 0.085) {
                c = uAccent;
                if (star5(e, 0.06, 0.45) < 0.0) c = uEmblem;
              }
              if (head) {
                c = mix(uMaskCol, uAccent, hexEdge(vMapUv * 38.0) * uHex * 0.8);
                vec2 l = vec2(ax - uEye.x - 0.006, y - uEye.y - 0.004);
                l = vec2(l.x * cos(0.35) - l.y * sin(0.35), l.x * sin(0.35) + l.y * cos(0.35));
                if (vBindPos.z > uEye.z - 0.06 && length(l / vec2(0.034, 0.021)) < 1.0) { c = uLens; suitArea = 0.0; shade = 1.25; }
                else if (vBindPos.z > uEye.z - 0.06 && length(l / vec2(0.04, 0.027)) < 1.0) { c = vec3(0.03); }
              }
              diffuseColor.rgb = c * shade;
            }
          } else if (uMode > 1.5) {
            // everyday clothes: top, sleeves (or bare arms), trousers/shorts, shoes
            bool bareArm = (uSleeveSkin > 0.5 && ax > uEye.y * 0.15) || (uTopSkin > 0.5 && !legs);
            bool bareLeg = uShorts > 0.5 && legs && y < hipY * 0.62;
            if (!head && !hand && !bareArm && !bareLeg) {
              cloth = 1.0;
              vec3 c = legs ? uLegs : (ax > uEye.y * 0.15 ? uSleeve : uTop);
              float weave = fract(sin(dot(floor(vMapUv * 500.0), vec2(12.9898, 78.233))) * 43758.5453);
              c *= legs ? 0.88 + 0.14 * weave : 0.94 + 0.08 * weave;
              diffuseColor.rgb = c * mix(1.0, shade, 0.25);
            }
            if (feet && uFeetSkin < 0.5) { cloth = 1.0; diffuseColor.rgb = uShoes * mix(1.0, shade, 0.3); }
            if (feet && uFeetSkin > 0.5) { cloth = 0.0; diffuseColor.rgb = skin; }
          }
        }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, uMetal, suitArea);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uRough, suitArea);
        roughnessFactor = mix(roughnessFactor, 0.95, cloth);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, 0.75 * cloth));`);
  };
  mat.customProgramCacheKey = () => 'person-outfit';
  mat.needsUpdate = true;
  return { mat, U };
}

// ---------- one person ----------
// spec: { sex, skin, hair, beard, hairColour, scale, outfit: { mode: 'clothes', top, sleeve|'skin', legs, shoes, shorts }
//        or { mode: 'suit', main, second, accent, emblem, emblemOn, mask, maskCol, lens, metal, hex } }
// returns { group, model, play(name, { fade, once, speed }), update(dt), bone(name), armsUp, wave, setOutfit(o) }
export function makeRealPerson(spec) {
  if (!A) return null;
  const THREE = A.THREE;
  const src = A.bodies[spec.sex === 'female' ? 'female' : 'male'];
  const model = SkeletonUtils.clone(src.scene);
  const group = new THREE.Group();
  group.add(model);
  // the pack only has superhero bodies: regular people are made narrower so
  // they look like everyday people, not bodybuilders (slim: 0 = superhero)
  const sc = spec.scale || 1, slim = spec.slim ?? 0;
  model.scale.set(sc * (1 - 0.16 * slim), sc, sc * (1 - 0.12 * slim));
  let body = null;
  const eyes = [], brows = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    const n = (o.material && o.material.name) || '';
    if (/Superhero/i.test(n)) body = o;
    else if (/Eye/i.test(n)) eyes.push(o);
    else if (/Hair/i.test(n)) brows.push(o);
  });
  const { mat, U } = outfitMaterial(THREE, body.material, src.eye);
  body.material = mat;
  U.uSkin.value.set(spec.skin || '#ffffff');
  U.uSkinMode.value = spec.skinMode === 'replace' ? 1 : 0;
  // eyebrows + hair (tinted), pinned to the head bone
  const head = model.getObjectByName('Head');
  const hairMat = (brows[0] ? brows[0].material : new THREE.MeshStandardMaterial()).clone();
  hairMat.color.set(spec.hairColour || '#3b2414');
  hairMat.roughness = 0.8;
  for (const b of brows) b.material = hairMat;
  const hairs = [];
  model.updateMatrixWorld(true);
  for (const key of [spec.hair, spec.beard ? 'beard' : null]) {
    const srcHair = key && A.hair[key];
    if (!srcHair) continue;
    const h = srcHair.clone();
    // each hairstyle has its own strand texture; tint it to this person's colour
    h.material = srcHair.material.clone();
    h.material.color.set(spec.hairColour || '#3b2414');
    h.material.roughness = 0.8;
    h.castShadow = true;
    model.add(h);
    h.updateMatrixWorld(true);
    if (head) head.attach(h);
    hairs.push(h);
  }

  function setOutfit(o) {
    const masked = o.mode === 'suit' && o.mask;
    for (const m of eyes) m.visible = !masked;
    for (const m of brows) m.visible = !masked;
    for (const h of hairs) h.visible = !masked;
    U.uMask.value = masked ? 1 : 0;
    if (o.mode === 'suit') {
      U.uMode.value = 1;
      U.uMain.value.set(o.main); U.uSecond.value.set(o.second || o.main); U.uAccent.value.set(o.accent || '#000000');
      U.uEmblem.value.set(o.emblem || '#ffffff'); U.uEmblemOn.value = o.emblemOn ? 1 : 0; U.uHex.value = o.hex ?? 0.5;
      U.uMaskCol.value.set(o.maskCol || o.main); U.uLens.value.set(o.lens || '#ffffff');
      U.uMetal.value = o.metal ?? 0.1; U.uRough.value = o.rough ?? 0.45;
    } else {
      U.uMode.value = 2;
      U.uTop.value.set(o.top || '#888888');
      U.uSleeveSkin.value = o.sleeve === 'skin' ? 1 : 0;
      U.uSleeve.value.set(o.sleeve && o.sleeve !== 'skin' ? o.sleeve : (o.top || '#888888'));
      U.uLegs.value.set(o.legs || '#2b3446');
      U.uShoes.value.set(o.shoes || '#f2f2f2');
      U.uShorts.value = o.shorts ? 1 : 0;
      U.uTopSkin.value = o.top === 'skin' ? 1 : 0;
      U.uFeetSkin.value = o.shoes === 'skin' ? 1 : 0;
    }
  }
  setOutfit(spec.outfit || { mode: 'clothes' });

  // ---- animation ----
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  const act = (name) => {
    if (!actions[name] && A.clips[name]) actions[name] = mixer.clipAction(A.clips[name]);
    return actions[name];
  };
  let cur = null, curName = '';
  function play(name, o = {}) {
    const a = act(name);
    if (!a) return;
    a.timeScale = o.speed || 1;
    if (name === curName && !o.restart) return;
    a.reset();
    if (o.once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.setEffectiveWeight(1).fadeIn(o.fade ?? 0.2).play();
    if (cur && cur !== a) cur.fadeOut(o.fade ?? 0.2);
    cur = a;
    curName = name;
  }
  // start each person at a random point of their idle/walk so crowds don't move in sync
  const startOffset = Math.random() * 3;
  play(spec.idle || 'Idle_Loop', { fade: 0 });
  mixer.update(startOffset);

  const B = (n) => model.getObjectByName(n);
  const bones = { uaR: B('upperarm_r'), laR: B('lowerarm_r'), hR: B('hand_r'), uaL: B('upperarm_l'), laL: B('lowerarm_l'), hL: B('hand_l') };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _d = new THREE.Vector3();
  function aim(b, child, dir, w) {
    if (!b || !child || w <= 0) return;
    b.getWorldPosition(_a);
    child.getWorldPosition(_b);
    _b.sub(_a).normalize();
    _q.setFromUnitVectors(_b, dir);
    b.getWorldQuaternion(_wq);
    _wq.premultiply(_q);
    b.parent.getWorldQuaternion(_pq);
    b.quaternion.slerp(_pq.invert().multiply(_wq), w);
    b.updateMatrixWorld(true);
  }
  let t = 0;
  const person = {
    group, model, play, setOutfit, bone: B, uniforms: U, bodyMat: mat,
    armsUp: 0, // 0..1 both arms straight up (falling under a parachute, cheering)
    wave: 0,   // 0..1 right arm waving for help
    get clip() { return curName; },
    update(dt) {
      t += dt;
      mixer.update(dt);
      if (person.armsUp > 0.01 || person.wave > 0.01) {
        model.updateMatrixWorld(true);
        const up = new THREE.Vector3(0, 1, 0);
        if (person.armsUp > 0.01) {
          for (const [ua, la, hand, side] of [[bones.uaR, bones.laR, bones.hR, 1], [bones.uaL, bones.laL, bones.hL, -1]]) {
            _d.set(0, 1, 0).applyQuaternion(group.getWorldQuaternion(_q)).normalize();
            const sideways = new THREE.Vector3(side * 0.35, 0, 0).applyQuaternion(group.getWorldQuaternion(_q));
            _d.add(sideways).normalize();
            aim(ua, la, _d, person.armsUp);
            aim(la, hand, _d, person.armsUp);
          }
        }
        if (person.wave > 0.01) {
          const side = new THREE.Vector3(0.6 + Math.sin(t * 9) * 0.45, 1, 0.15).applyQuaternion(group.getWorldQuaternion(_q)).normalize();
          aim(bones.uaR, bones.laR, up.clone().lerp(side, 0.5).normalize(), person.wave);
          aim(bones.laR, bones.hR, side, person.wave);
        }
      }
    },
  };
  return person;
}
