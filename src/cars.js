// Real car models: Kenney "Car Kit" (CC0, www.kenney.nl), in public/models/cars/.
// Each car in the city starts as a simple box car; once the models load, its
// box is swapped for a real model (wheels spin and the front ones steer).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { metalEnvTex } from './surfaces.js';

// kind → file, top speed when the hero drives it, how often it shows up in traffic
export const CAR_KINDS = {
  sedan:      { file: 'sedan',            top: 30, weight: 4 },
  hatchback:  { file: 'hatchback-sports', top: 32, weight: 3 },
  sports:     { file: 'sedan-sports',     top: 40, weight: 2 },
  race:       { file: 'race',             top: 46, weight: 1 },
  suv:        { file: 'suv',              top: 28, weight: 3 },
  suvLuxury:  { file: 'suv-luxury',       top: 30, weight: 2 },
  van:        { file: 'van',              top: 25, weight: 2 },
  delivery:   { file: 'delivery',         top: 24, weight: 2 },
  taxi:       { file: 'taxi',             top: 31, weight: 3 },
  police:     { file: 'police',           top: 38, weight: 2 },
  // Max & Bonnie's AI-made car (Tripo, 2026-11-26): realistic sports car, simplified
  // from 4.9M to ~39k triangles with the wheels cut out as separate pieces.
  // Model is 0.98 long along x with the nose at -x (so the wheels at -x steer), axles along z.
  supercar:   { file: 'tripo-sports',     top: 48, weight: 1, scale: 4.9, rotY: Math.PI / 2, axle: 'z', noseNegX: true, shiny: true },
};
const SCALE = 1.9;

const models = {};
let ready = false;

export function carModelsReady() { return ready; }

export function loadCarModels(onDone) {
  const loader = new GLTFLoader();
  const kinds = Object.keys(CAR_KINDS);
  let left = kinds.length;
  for (const kind of kinds) {
    loader.load(`/models/cars/${CAR_KINDS[kind].file}.glb`, (gltf) => {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (CAR_KINDS[kind].shiny && o.material) {
          // glossy paint that reflects the sky
          o.material.roughness = 0.38;
          o.material.metalness = 0.35;
          const env = metalEnvTex();
          if (env) { o.material.envMap = env; o.material.envMapIntensity = 0.8; }
          o.material.needsUpdate = true;
        }
      });
      models[kind] = gltf.scene;
      if (--left === 0) { ready = true; onDone && onDone(); }
    }, undefined, (err) => {
      console.warn('car model failed', kind, err);
      if (--left === 0) { ready = Object.keys(models).length > 0; ready && onDone && onDone(); }
    });
  }
}

export function randomCarKind() {
  const kinds = Object.keys(CAR_KINDS).filter(k => models[k] || !ready);
  const total = kinds.reduce((s, k) => s + CAR_KINDS[k].weight, 0);
  let r = Math.random() * total;
  for (const k of kinds) { r -= CAR_KINDS[k].weight; if (r <= 0) return k; }
  return kinds[0];
}

// Swap a box car's children for a real model. Returns false if not available.
export function dressCar(THREE, car, kind) {
  const src = models[kind];
  if (!src) return false;
  for (const c of [...car.children]) car.remove(c);
  const model = src.clone(true);
  const cfg = CAR_KINDS[kind];
  model.scale.setScalar(cfg.scale || SCALE);
  if (cfg.rotY) model.rotation.y = cfg.rotY;
  car.add(model);
  const wheels = [];
  model.traverse((o) => {
    if (o.name && o.name.startsWith('wheel')) {
      o.rotation.order = 'YXZ';
      wheels.push({ node: o, front: cfg.noseNegX ? o.position.x < 0 : o.name.includes('front') });
    }
  });
  // front wheels first (the driving code steers wheels[0..] flagged front)
  car.userData.wheels = wheels.map(w => w.node);
  car.userData.frontWheels = wheels.filter(w => w.front).map(w => w.node);
  car.userData.kind = kind;
  car.userData.axle = cfg.axle || 'x';
  car.userData.top = CAR_KINDS[kind].top;
  if (kind === 'police') {
    // flashing red/blue roof lights
    const mk = (color, x) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.34), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, 2.55, -0.15);
      car.add(m);
      return m;
    };
    car.userData.siren = [mk(0xff2030, -0.3), mk(0x2050ff, 0.3)];
  }
  return true;
}
