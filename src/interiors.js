// Building interiors: four building types (hotel, apartment, shop, office),
// each a 3-floor building with stairs, an elevator, a street door on floor 1
// and a roof door on floor 3. Every walk-in door in the city leads to the
// interior of its building's type. Interiors are parked far outside the city
// (x = 4000+) so outdoor logic never sees them; entering/exiting teleports.
//
// Local coordinates: each floor plan spans x,z in [-13, 13]. Floor k's walking
// surface is at y = k * FLOOR_H. The hero's position is 1.5 above its feet
// (the convention App.jsx uses outdoors too).

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { furnish } from './furniture.js';

export const BUILDING_TYPES = ['hotel', 'apartment', 'shop', 'office'];
export const FLOOR_H = 7;
const HALF = 13;
const WALL_IN = 12.85; // inner face of the outer walls
const SLAB = 0.3;
const CEIL = FLOOR_H - SLAB; // ceiling height above each floor

const TYPE_INFO = {
  hotel: {
    label: 'Hotel',
    floors: ['Lobby', 'Hotel rooms', 'Lounge'],
    wall: 0xf3e4cc, floor: 0x6b4a2f, light: 0xffd9a0,
  },
  apartment: {
    label: 'Apartments',
    floors: ['Living room & kitchen', 'Bedrooms & bathroom', 'Laundry & storage'],
    wall: 0xe8e2d6, floor: 0x8a6a4a, light: 0xfff0d0,
  },
  shop: {
    label: 'Shop',
    floors: ['Shop floor', 'Stockroom', 'Staff room'],
    wall: 0xf2f2f2, floor: 0xbfc4c8, light: 0xf4fbff,
  },
  office: {
    label: 'Office',
    floors: ['Reception', 'Office desks', 'Meeting room'],
    wall: 0xdfe4ea, floor: 0x5d6670, light: 0xeef6ff,
  },
};

// Photo textures (Poly Haven, CC0) in public/textures, shared by all interiors.
// [texture, tile size in world units, tint] per floor.
const FLOOR_TEX = {
  hotel: [['large_grey_tiles', 3.5, 0xf3e7d3], ['fabric', 2, 0x8a3a3a], ['herringbone_parquet', 3, 0xb98d62]],
  apartment: [['herringbone_parquet', 3, 0xffffff], ['herringbone_parquet', 3, 0xffffff], ['concrete_floor_painted', 4, 0xffffff]],
  shop: [['large_grey_tiles', 3, 0xffffff], ['concrete_floor_painted', 4, 0xdddddd], ['interior_tiles', 2.5, 0xffffff]],
  office: [['laminate_floor_02', 3, 0xffffff], ['fabric', 2, 0x6d7a8c], ['laminate_floor_02', 3, 0xffffff]],
};
const WALL_TEX = { hotel: 'painted_plaster_wall', apartment: 'painted_plaster_wall', shop: 'painted_plaster_wall', office: 'painted_plaster_wall' };
const texCache = {};
// Neutral woven-fabric/carpet texture drawn in code, so tints show true colours.
function fabricTex(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 170 + Math.random() * 85;
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let y = 0; y < 256; y += 4) { ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(0, y, 256, 1); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function loadTex(THREE, name) {
  if (name === 'fabric') return texCache.fabric || (texCache.fabric = fabricTex(THREE));
  if (!texCache[name]) {
    const t = new THREE.TextureLoader().load(`/textures/${name}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache[name] = t;
  }
  return texCache[name];
}
// Scale a BoxGeometry's UVs so a texture repeats every `tile` world units on every face.
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

// Interior partition walls per type, per floor: [x0, z0, x1, z1] (axis-aligned).
// Gaps between segments are doorways. Kept clear of the shared stairwell
// (x < -7.6), elevator (x > 8.5, z < -8.5), street door (south wall, centre)
// and roof door (east wall, z = 0).
const PARTITIONS = {
  hotel: [
    [],
    [
      // north guest rooms
      [-4, -13, -4, -4], [2.2, -13, 2.2, -4], [8.5, -8.5, 8.5, -4],
      [-4, -4, -2.5, -4], [-1.3, -4, 3.3, -4], [4.5, -4, 8.5, -4],
      // south guest rooms
      [-7.3, 3, -7.3, 13], [-1.5, 3, -1.5, 13], [4.5, 3, 4.5, 13],
      [-7.3, 3, -5.4, 3], [-4.2, 3, 0.9, 3], [2.1, 3, 8, 3], [9.2, 3, 13, 3],
    ],
    [],
  ],
  apartment: [
    [[-4, -5, 1, -5], [4, -5, 8.5, -5]],
    [
      // two bedrooms (south) + bathroom (north)
      [-7.3, 3, -7.3, 13], [3, 3, 3, 13],
      [-7.3, 3, -3, 3], [-1.6, 3, 7, 3], [8.4, 3, 13, 3],
      [-4, -13, -4, -5], [3, -13, 3, -5], [-4, -5, -1, -5], [0.4, -5, 3, -5],
    ],
    [[3, 3, 3, 13], [3, 3, 6, 3], [7.4, 3, 13, 3]],
  ],
  shop: [
    [],
    [],
    [[3, -4, 3, 4], [3, 5.4, 3, 13]],
  ],
  office: [
    [],
    [[4.5, 3, 4.5, 13], [4.5, 3, 8, 3], [9.4, 3, 13, 3]],
    [[-4, -13, -4, -4], [6, -13, 6, -4], [-4, -4, 0, -4], [1.4, -4, 6, -4]],
  ],
};

// Stairwell: two switchback flights along the west wall.
const LANE_A = [-12.85, -10.25]; // floor 1 -> 2, climbing north (-z)
const LANE_B = [-10.1, -7.6];    // floor 2 -> 3, climbing south (+z)
const STAIR_Z = [-5.7, 5.5];
const STEPS = 14, STEP_RISE = FLOOR_H / STEPS, STEP_RUN = (STAIR_Z[1] - STAIR_Z[0]) / STEPS;

// Elevator shaft in the north-east corner, doors facing south.
const ELEV = { x0: 8.6, z1: -8.6, doorX0: 9.7, doorX1: 11.7, doorH: 2.9 };

function makeLabelTexture(THREE, text, { bg = '#1b2433', fg = '#ffe9b0', w = 256, h = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.floor(h * 0.42)}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function buildInterior(THREE, scene, type, origin) {
  const info = TYPE_INFO[type];
  const group = new THREE.Group();
  group.position.copy(origin);
  const solids = [];      // world-space Box3s the hero collides with / stands on
  const camBlockers = []; // meshes the camera must not pass through

  const wallMat = new THREE.MeshStandardMaterial({ map: loadTex(THREE, WALL_TEX[type]), color: info.wall, roughness: 0.9 });
  wallMat.userData.tile = 4;
  const floorMats = FLOOR_TEX[type].map(([name, tile, tint]) => {
    const m = new THREE.MeshStandardMaterial({ map: loadTex(THREE, name), color: tint, roughness: 0.55 });
    m.userData.tile = tile;
    return m;
  });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.95 });
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x8c8f94, roughness: 0.8 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.4, metalness: 0.6 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7 });
  const doorGlowMat = new THREE.MeshStandardMaterial({ color: 0x120c08, emissive: 0xffcf7a, emissiveIntensity: 0.65 });

  // Axis-aligned box in local coords; optionally solid and/or a camera blocker.
  function box(x0, y0, z0, x1, y1, z1, mat, { solid = true, cam = true } = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const geo = new THREE.BoxGeometry(w, h, d);
    if (mat.userData.tile) worldUV(geo, w, h, d, mat.userData.tile);
    const m = new THREE.Mesh(geo, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    m.userData.cam = cam;
    group.add(m);
    if (solid) {
      solids.push(new THREE.Box3(
        new THREE.Vector3(x0 + origin.x, y0 + origin.y, z0 + origin.z),
        new THREE.Vector3(x1 + origin.x, y1 + origin.y, z1 + origin.z)
      ));
    }
    return m;
  }

  // Floor slab (floor k's surface on top) with an optional rectangular hole
  // [hx0, hx1, hz0, hz1]; the ceiling of the floor below is a plane under it.
  function slab(k, hole) {
    const y = k * FLOOR_H, y0 = y - SLAB, y1 = y;
    const mat = floorMats[Math.min(k, 2)];
    const rects = !hole ? [[-HALF, -HALF, HALF, HALF]] : [
      [-HALF, -HALF, hole[0], HALF], [hole[1], -HALF, HALF, HALF],
      [hole[0], -HALF, hole[1], hole[2]], [hole[0], hole[3], hole[1], HALF],
    ];
    for (const [x0, z0, x1, z1] of rects) {
      box(x0, y0, z0, x1, y1, z1, mat);
      if (k > 0) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), ceilMat);
        c.rotation.x = Math.PI / 2;
        c.position.set((x0 + x1) / 2, y0 - 0.01, (z0 + z1) / 2);
        group.add(c);
      }
    }
  }

  // Floors and ceilings
  slab(0);
  slab(1, [LANE_A[0], LANE_A[1], STAIR_Z[0], STAIR_Z[1]]);
  slab(2, [LANE_B[0], LANE_B[1], STAIR_Z[0], STAIR_Z[1]]);
  slab(3);

  // Outer walls, full building height
  const H3 = FLOOR_H * 3;
  box(-HALF - 0.3, 0, -HALF, -WALL_IN, H3, HALF, wallMat);
  box(WALL_IN, 0, -HALF, HALF + 0.3, H3, HALF, wallMat);
  box(-HALF, 0, -HALF - 0.3, HALF, H3, -WALL_IN, wallMat);
  box(-HALF, 0, WALL_IN, HALF, H3, HALF + 0.3, wallMat);

  // Partition walls
  PARTITIONS[type].forEach((segs, k) => {
    const y0 = k * FLOOR_H, y1 = y0 + CEIL;
    for (const [x0, z0, x1, z1] of segs) {
      if (x0 === x1) box(x0 - 0.1, y0, Math.min(z0, z1), x0 + 0.1, y1, Math.max(z0, z1), wallMat);
      else box(Math.min(x0, x1), y0, z0 - 0.1, Math.max(x0, x1), y1, z0 + 0.1, wallMat);
    }
  });

  // Stairs: steps are solid boxes; each rise (0.5) is under the hero's
  // step-up allowance so walking into the next step climbs it.
  for (let i = 0; i < STEPS; i++) {
    const za = STAIR_Z[1] - (i + 1) * STEP_RUN, zb = STAIR_Z[1] - i * STEP_RUN;
    box(LANE_A[0], 0, za, LANE_A[1], (i + 1) * STEP_RISE, zb, stairMat, { cam: false });
    const zc = STAIR_Z[0] + i * STEP_RUN, zd = STAIR_Z[0] + (i + 1) * STEP_RUN;
    box(LANE_B[0], FLOOR_H, zc, LANE_B[1], FLOOR_H + (i + 1) * STEP_RISE, zd, stairMat, { cam: false });
  }
  // Railings around the stair openings
  const RAIL = 1.1;
  const y1 = FLOOR_H, y2 = FLOOR_H * 2;
  box(LANE_A[1], y1, STAIR_Z[0], LANE_B[0], y1 + RAIL, STAIR_Z[1], railMat, { cam: false });
  box(LANE_A[0], y1, STAIR_Z[1], LANE_A[1], y1 + RAIL, STAIR_Z[1] + 0.15, railMat, { cam: false });
  box(LANE_A[1], y2, STAIR_Z[0], LANE_B[0], y2 + RAIL, STAIR_Z[1], railMat, { cam: false });
  box(LANE_B[1], y2, STAIR_Z[0], LANE_B[1] + 0.15, y2 + RAIL, STAIR_Z[1], railMat, { cam: false });
  box(LANE_B[0], y2, STAIR_Z[0] - 0.15, LANE_B[1], y2 + RAIL, STAIR_Z[0], railMat, { cam: false });

  // Elevator shaft walls, doors and floor signs on every floor
  const elevatorDoors = [];
  for (let k = 0; k < 3; k++) {
    const y0 = k * FLOOR_H, yc = y0 + CEIL;
    box(ELEV.x0 - 0.1, y0, -HALF, ELEV.x0 + 0.1, yc, ELEV.z1 + 0.1, shaftMat);
    box(ELEV.x0 - 0.1, y0, ELEV.z1 - 0.1, ELEV.doorX0, yc, ELEV.z1 + 0.1, shaftMat);
    box(ELEV.doorX1, y0, ELEV.z1 - 0.1, HALF, yc, ELEV.z1 + 0.1, shaftMat);
    box(ELEV.doorX0, y0 + ELEV.doorH, ELEV.z1 - 0.1, ELEV.doorX1, yc, ELEV.z1 + 0.1, shaftMat);
    const doorW = (ELEV.doorX1 - ELEV.doorX0) / 2;
    const doorGeo = new THREE.BoxGeometry(doorW, ELEV.doorH, 0.08);
    const left = new THREE.Mesh(doorGeo, shaftMat);
    const right = new THREE.Mesh(doorGeo, shaftMat);
    left.position.set(ELEV.doorX0 + doorW / 2, y0 + ELEV.doorH / 2, ELEV.z1 + 0.14);
    right.position.set(ELEV.doorX1 - doorW / 2, y0 + ELEV.doorH / 2, ELEV.z1 + 0.14);
    left.userData.keep = right.userData.keep = true; // animated, so never merged
    group.add(left, right);
    elevatorDoors.push({ left, right, closedL: left.position.x, closedR: right.position.x, open: 0, w: doorW });

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.7),
      new THREE.MeshBasicMaterial({ map: makeLabelTexture(THREE, `Floor ${k + 1}`) })
    );
    sign.position.set((ELEV.doorX0 + ELEV.doorX1) / 2, y0 + ELEV.doorH + 0.7, ELEV.z1 + 0.12);
    group.add(sign);

    // call-button panel inside the cab
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.9, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x20262e, emissive: 0x55c8ff, emissiveIntensity: 0.6 })
    );
    panel.position.set(WALL_IN - 0.05, y0 + 1.6, -10.7);
    group.add(panel);
  }

  // Street door (floor 1, south wall) and roof door (floor 3, east wall)
  const streetDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.8), doorGlowMat);
  streetDoor.position.set(0, 1.4, WALL_IN - 0.02);
  streetDoor.rotation.y = Math.PI;
  group.add(streetDoor);
  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.5),
    new THREE.MeshBasicMaterial({ map: makeLabelTexture(THREE, 'EXIT', { bg: '#0d5a2a', fg: '#e8ffe8' }) })
  );
  exitSign.position.set(0, 3.3, WALL_IN - 0.02);
  exitSign.rotation.y = Math.PI;
  group.add(exitSign);

  const roofY = FLOOR_H * 2;
  const roofDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.8), doorGlowMat);
  roofDoor.position.set(WALL_IN - 0.02, roofY + 1.4, 0);
  roofDoor.rotation.y = -Math.PI / 2;
  group.add(roofDoor);
  const roofSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.6),
    new THREE.MeshBasicMaterial({ map: makeLabelTexture(THREE, 'ROOF ↑') })
  );
  roofSign.position.set(WALL_IN - 0.02, roofY + 3.3, 0);
  roofSign.rotation.y = -Math.PI / 2;
  group.add(roofSign);

  furnish(THREE, {
    group, solids, FLOOR_H, CEIL, type,
    partitions: PARTITIONS[type],
    tex: (name) => loadTex(THREE, name),
    label: (text, bg, fg) => makeLabelTexture(THREE, text, { bg, fg, w: 512, h: 128 }),
  });
  bakeStatic(THREE, group, camBlockers);
  group.visible = false; // App shows only the interior the hero is in
  scene.add(group);

  const at = (x, y, z) => new THREE.Vector3(x, y, z).add(origin);
  return {
    type,
    label: info.label,
    floorNames: info.floors,
    lightColor: info.light,
    origin: origin.clone(),
    group,
    solids,
    camBlockers,
    elevatorDoors,
    // hero positions (already +1.5 above feet) and facing (yaw)
    streetSpawn: at(0, 1.5, 8.5), streetSpawnYaw: 0,
    streetExit: at(0, 1.5, 11.6),
    roofSpawn: at(8.5, roofY + 1.5, 0), roofSpawnYaw: Math.PI / 2, // facing -x, into the room
    roofExit: at(11.6, roofY + 1.5, 0),
    floorAt(y) { return Math.max(0, Math.min(2, Math.floor((y - 1.5 - origin.y + 1) / FLOOR_H))); },
    inElevator(p) {
      const lx = p.x - origin.x, lz = p.z - origin.z;
      return lx > ELEV.x0 + 0.3 && lx < WALL_IN && lz > -WALL_IN && lz < ELEV.z1 - 0.3;
    },
    elevatorFront(floor) { return at((ELEV.doorX0 + ELEV.doorX1) / 2, floor * FLOOR_H + 1.5, ELEV.z1); },
    lightSpots(floor) {
      const y = floor * FLOOR_H + CEIL - 0.8;
      return [at(-4, y, -4), at(5, y, 5), at(5, y, -6)];
    },
  };
}

// Merge every static mesh into one mesh per material (and per camera-blocking
// flag), turning thousands of furniture parts into a few dozen draw calls.
function bakeStatic(THREE, group, camBlockers) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map();
  const victims = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.keep) return;
    const key = o.material.uuid + (o.userData.cam ? '|cam' : '');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cam: !!o.userData.cam, geos: [] });
    const g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    buckets.get(key).geos.push(g);
    victims.push(o);
  });
  for (const o of victims) { o.parent.remove(o); o.geometry.dispose(); }
  for (const { mat, cam, geos } of buckets.values()) {
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    merged.receiveShadow = true;
    group.add(merged);
    if (cam) camBlockers.push(merged);
    geos.forEach(g => g.dispose());
  }
  // leftover empty furniture groups are harmless but drop them for tidiness
  const empties = [];
  group.traverse((o) => { if (o !== group && o.isGroup && o.children.length === 0) empties.push(o); });
  empties.forEach(o => o.parent.remove(o));
}

export function createInteriors(THREE, scene) {
  const interiors = {};
  BUILDING_TYPES.forEach((type, i) => {
    interiors[type] = buildInterior(THREE, scene, type, new THREE.Vector3(4000 + i * 200, 0, 0));
  });
  return interiors;
}

// Slide elevator doors open when the hero is near them on that floor.
export function updateElevatorDoors(interior, heroPos, dt, riding) {
  const floor = interior.floorAt(heroPos.y);
  interior.elevatorDoors.forEach((d, k) => {
    const front = interior.elevatorFront(k);
    const near = k === floor && !riding &&
      (interior.inElevator(heroPos) || Math.hypot(heroPos.x - front.x, heroPos.z - front.z) < 4);
    d.open += ((near ? 1 : 0) - d.open) * Math.min(1, dt * 6);
    d.left.position.x = d.closedL - d.open * d.w * 0.95;
    d.right.position.x = d.closedR + d.open * d.w * 0.95;
  });
}

// ---------- Hero physics inside a building ----------
const R = 0.45;          // hero radius
const STEP_UP = 0.6;     // max ledge the hero walks up without jumping
const BODY = 2.6;        // feet-to-head height
const HEAD_ZONE = 1.6;   // boxes starting this far above the feet act as ceilings

// Resolves walls, floors, stairs and ceilings. Mutates pos/vel, returns onGround.
export function collideInterior(interior, pos, vel) {
  let feet = pos.y - 1.5;
  for (const b of interior.solids) {
    if (b.max.y <= feet + STEP_UP || b.min.y >= feet + BODY || b.min.y > feet + HEAD_ZONE) continue;
    const cx = Math.max(b.min.x, Math.min(b.max.x, pos.x));
    const cz = Math.max(b.min.z, Math.min(b.max.z, pos.z));
    let dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      dx /= d; dz /= d;
      pos.x += dx * (R - d);
      pos.z += dz * (R - d);
      const vn = vel.x * dx + vel.z * dz;
      if (vn < 0) { vel.x -= vn * dx; vel.z -= vn * dz; }
    } else {
      // centre is inside the box: push out along the shallowest side
      const pens = [
        [pos.x - b.min.x + R, -1, 0], [b.max.x - pos.x + R, 1, 0],
        [pos.z - b.min.z + R, 0, -1], [b.max.z - pos.z + R, 0, 1],
      ].sort((a, c) => a[0] - c[0]);
      const [p, nx, nz] = pens[0];
      pos.x += nx * p; pos.z += nz * p;
    }
  }

  let ground = -Infinity;
  for (const b of interior.solids) {
    if (pos.x < b.min.x || pos.x > b.max.x || pos.z < b.min.z || pos.z > b.max.z) continue;
    if (b.max.y <= feet + STEP_UP && b.max.y > ground) ground = b.max.y;
    // ceiling: only when rising into something above the head
    if (vel.y > 0 && b.min.y >= feet + HEAD_ZONE && feet + BODY > b.min.y) {
      pos.y = b.min.y - BODY + 1.5;
      vel.y = 0;
      feet = pos.y - 1.5;
    }
  }
  if (ground > -Infinity && feet <= ground + 0.001 && vel.y <= 0) {
    pos.y = ground + 1.5;
    vel.y = 0;
    return true;
  }
  return false;
}

export function interiorGroundBelow(interior, x, y, z) {
  const feet = y - 1.5;
  let ground = interior.origin.y;
  for (const b of interior.solids) {
    if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
    if (b.max.y <= feet + 0.05 && b.max.y > ground) ground = b.max.y;
  }
  return ground;
}
