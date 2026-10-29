// Real clothes and shoes for the realistic hero's street outfits.
//
// Clothes are "shells": copies of the body mesh, puffed out a little along
// the skin's normals inside the garment's area (and tucked inside the body
// everywhere else), bound to the same skeleton so they move with him. That
// gives fabric thickness over the muscles instead of painted-on clothes.
// Sneakers are small built shapes pinned to the foot bones.

function fabricTexture(THREE, kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  if (kind === 'denim') {
    // diagonal twill weave
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const k = ((x + y) % 4 < 2 ? 0.86 : 1) * (0.92 + Math.random() * 0.08);
      g.fillStyle = `rgba(0,0,0,${1 - k})`;
      g.fillRect(x, y, 1, 1);
    }
  } else {
    // knit: soft vertical ribs + fuzz
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const k = (x % 3 === 0 ? 0.9 : 1) * (0.93 + Math.random() * 0.07);
      g.fillStyle = `rgba(0,0,0,${1 - k})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'denim' ? 14 : 18, kind === 'denim' ? 14 : 18);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// area: { yMin, yMax, axMax, openFront } in rest-pose model space (metres).
// Triangles near the area are kept, then the exact (straight, clean) edge is
// cut per pixel in the shader.
export function makeShell(THREE, body, area, offset, colour, kind = 'knit') {
  const { yMin = -1, yMax = 9, axMax = 9, openFront = 0 } = area;
  const inArea = (x, y, z, m) => y > yMin - m && y < yMax + m && Math.abs(x) < axMax + m
    && !(openFront && z > 0.02 + m && Math.abs(x) < openFront - m);
  const geo = body.geometry.clone();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const near = new Uint8Array(pos.count);
  const rest = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    rest[i * 3] = x; rest[i * 3 + 1] = y; rest[i * 3 + 2] = z;
    near[i] = inArea(x, y, z, 0.04) ? 1 : 0;
    if (near[i]) pos.setXYZ(i, x + nor.getX(i) * offset, y + nor.getY(i) * offset, z + nor.getZ(i) * offset);
  }
  pos.needsUpdate = true;
  geo.setAttribute('restPos', new THREE.BufferAttribute(rest, 3));
  const src = geo.index ? geo.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const keep = [];
  for (let t = 0; t < src.length; t += 3) {
    const a = src[t], b = src[t + 1], c = src[t + 2];
    if (near[a] || near[b] || near[c]) keep.push(a, b, c);
  }
  geo.setIndex(keep);
  const mat = new THREE.MeshStandardMaterial({ color: colour, map: fabricTexture(THREE, kind), roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute vec3 restPos;\nvarying vec3 vRest;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n vRest = restPos;');
    shader.fragmentShader = 'varying vec3 vRest;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (vRest.y < ${yMin.toFixed(3)} || vRest.y > ${yMax.toFixed(3)} || abs(vRest.x) > ${axMax.toFixed(3)}) discard;
      ${openFront ? `if (vRest.z > 0.02 && abs(vRest.x) < ${openFront.toFixed(3)}) discard;` : ''}`);
  };
  mat.customProgramCacheKey = () => `shell|${yMin}|${yMax}|${axMax}|${openFront}`;
  const shell = new THREE.SkinnedMesh(geo, mat);
  shell.bind(body.skeleton, body.bindMatrix);
  shell.castShadow = true;
  shell.frustumCulled = false;
  body.parent.add(shell);
  return shell;
}

// a pair of sneakers pinned to the feet; returns [left, right] groups.
// Placed using the skeleton's *bind* pose (the pose the body mesh was
// modelled in, feet flat on the floor), then parented to the foot bones.
export function makeSneakers(THREE, body, colour = '#f4f4f4', sole = '#e6e6e6', accent = '#c8202f') {
  const upperMat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.7 });
  const soleMat = new THREE.MeshStandardMaterial({ color: sole, roughness: 0.9 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 });
  const sk = body.skeleton;
  const bindOf = (name) => {
    const i = sk.bones.findIndex(b => b.name === name);
    return i < 0 ? null : new THREE.Matrix4().copy(sk.boneInverses[i]).invert();
  };
  const out = [];
  for (const side of ['l', 'r']) {
    const foot = sk.bones.find(b => b.name === 'foot_' + side);
    const fm = bindOf('foot_' + side), bm = bindOf('ball_' + side);
    if (!foot || !fm || !bm) continue;
    const f = new THREE.Vector3().setFromMatrixPosition(fm), b = new THREE.Vector3().setFromMatrixPosition(bm);
    const dir = new THREE.Vector3(b.x - f.x, 0, b.z - f.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const shoe = new THREE.Group();
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.035, 0.29), soleMat);
    s.position.set(0, 0.0175, 0);
    shoe.add(s);
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), upperMat);
    up.scale.set(0.1, 0.085, 0.27);
    up.position.set(0, 0.035, 0);
    shoe.add(up);
    const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.08, 14), upperMat);
    heel.position.set(0, 0.075, -0.085);
    shoe.add(heel);
    for (const sx of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.12), accentMat);
      st.position.set(sx * 0.049, 0.06, -0.01);
      st.rotation.x = -0.25;
      shoe.add(st);
    }
    shoe.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // shoe transform in the body's bind space, then expressed relative to the foot bone
    const T = new THREE.Matrix4().compose(
      new THREE.Vector3(f.x + dir.x * 0.055, 0, f.z + dir.z * 0.055),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dir.x, dir.z)),
      new THREE.Vector3(1, 1, 1));
    const local = fm.clone().invert().multiply(T);
    local.decompose(shoe.position, shoe.quaternion, shoe.scale);
    foot.add(shoe);
    out.push(shoe);
  }
  return out;
}
