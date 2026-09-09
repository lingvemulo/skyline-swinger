import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

export default function SkylineSwingerMobile() {
  const mountRef = useRef(null);
  const containerRef = useRef(null);
  const stickRef = useRef(null);
  const webBtnRef = useRef(null);
  const jumpBtnRef = useRef(null);
  const fightBtnRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [defeated, setDefeated] = useState(0);
  const [health, setHealth] = useState(100);
  const [message, setMessage] = useState('');
  const [hitFlash, setHitFlash] = useState(false);

  const startGame = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!started || !mountRef.current) return;

    const mount = mountRef.current;
    let animationId;
    const clock = new THREE.Clock();

    // ---------- Scene ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ec9e8);
    scene.fog = new THREE.Fog(0xbfe0f2, 90, 340);

    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    // Gradient sky dome (vertex-colored) instead of a flat background color
    const skyGeo = new THREE.SphereGeometry(480, 24, 16);
    const skyColorsTop = new THREE.Color(0x2f6fb0);
    const skyColorsHorizon = new THREE.Color(0xbfe0f2);
    const skyPos = skyGeo.attributes.position;
    const skyColors = [];
    for (let i = 0; i < skyPos.count; i++) {
      const yNorm = THREE.MathUtils.clamp((skyPos.getY(i) / 480 + 1) / 2, 0, 1);
      const c = skyColorsHorizon.clone().lerp(skyColorsTop, Math.pow(yNorm, 0.55));
      skyColors.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Soft sun glow sprite for atmosphere
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128; glowCanvas.height = 128;
    const gctx = glowCanvas.getContext('2d');
    const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,244,214,0.9)');
    grad.addColorStop(1, 'rgba(255,244,214,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false }));
    sunGlow.scale.set(140, 140, 1);
    sunGlow.position.set(200, 160, -300);
    scene.add(sunGlow);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x445566, 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.25);
    sun.position.set(80, 140, 60);
    sun.castShadow = true;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    scene.add(sun);

    const CITY_SIZE = 260;

    // Procedural asphalt texture with lane markings for a more realistic street surface
    function makeRoadTexture() {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#4a5058';
      ctx.fillRect(0, 0, 256, 256);
      // subtle noise speckle
      for (let i = 0; i < 900; i++) {
        const shade = 60 + Math.random() * 40;
        ctx.fillStyle = `rgba(${shade},${shade + 4},${shade + 8},0.5)`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
      }
      // lane marking
      ctx.fillStyle = 'rgba(230,220,180,0.55)';
      ctx.fillRect(122, 0, 6, 256);
      return c;
    }
    const roadCanvas = makeRoadTexture();
    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(CITY_SIZE / 6, CITY_SIZE / 6);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_SIZE * 2, CITY_SIZE * 2),
      new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Shared procedural window-lit facade texture for buildings
    function makeFacadeTexture() {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#33404f';
      ctx.fillRect(0, 0, 128, 256);
      const cols = 6, rows = 12;
      const cw = 128 / cols, rh = 256 / rows;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const lit = Math.random() < 0.4;
          ctx.fillStyle = lit ? 'rgba(255,224,150,0.95)' : 'rgba(20,26,36,0.9)';
          ctx.fillRect(col * cw + cw * 0.15, r * rh + rh * 0.2, cw * 0.7, rh * 0.6);
        }
      }
      return c;
    }
    const facadeTexture = new THREE.CanvasTexture(makeFacadeTexture());
    facadeTexture.wrapS = THREE.RepeatWrapping;
    facadeTexture.wrapT = THREE.RepeatWrapping;

    // ---------- City ----------
    const buildings = [];
    function buildingColor() {
      const palette = [0x3a4a63, 0x4a5a73, 0x2f3d52, 0x5a6a83, 0x445a6b, 0x36445a];
      return palette[Math.floor(Math.random() * palette.length)];
    }
    for (let x = -CITY_SIZE + 30; x < CITY_SIZE - 30; x += 22) {
      for (let z = -CITY_SIZE + 30; z < CITY_SIZE - 30; z += 22) {
        if (Math.random() < 0.35) continue;
        if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
        const w = 8 + Math.random() * 7, d = 8 + Math.random() * 7, h = 14 + Math.random() * 60;

        const tex = facadeTexture.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 6)));
        const facadeMat = new THREE.MeshStandardMaterial({
          map: tex, color: buildingColor(), roughness: 0.75, metalness: 0.15
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facadeMat);
        b.position.set(x + (Math.random() - 0.5) * 6, h / 2, z + (Math.random() - 0.5) * 6);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        buildings.push(b);

        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.02, 0.6, d * 1.02),
          new THREE.MeshStandardMaterial({ color: 0x1e2836, roughness: 0.6, metalness: 0.3 })
        );
        trim.position.set(b.position.x, h + 0.3, b.position.z);
        scene.add(trim);
      }
    }

    // ---------- Orbs ----------
    const orbs = [];
    const orbGeo = new THREE.SphereGeometry(0.9, 16, 16);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x18c9e8, emissiveIntensity: 1.2 });
    for (let i = 0; i < 40; i++) {
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set((Math.random() - 0.5) * CITY_SIZE * 1.7, 10 + Math.random() * 55, (Math.random() - 0.5) * CITY_SIZE * 1.7);
      orb.userData.baseY = orb.position.y;
      orb.userData.phase = Math.random() * Math.PI * 2;
      scene.add(orb);
      orbs.push(orb);
    }

    // ---------- Enemies (original robotic "Voltbots") ----------
    const enemies = [];
    function makeEnemy(x, z, groundY) {
      const grp = new THREE.Group();
      const bodyMat2 = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.4, roughness: 0.5 });
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2c3c, emissive: 0xff2c3c, emissiveIntensity: 1.4 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), bodyMat2);
      body.position.y = 1.0;
      body.castShadow = true;
      grp.add(body);
      const headM = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), bodyMat2);
      headM.position.y = 1.75;
      headM.castShadow = true;
      grp.add(headM);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
      eye.position.set(0, 1.75, 0.3);
      grp.add(eye);
      const armGeo2 = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6);
      const armL2 = new THREE.Mesh(armGeo2, bodyMat2);
      armL2.position.set(-0.55, 1.15, 0);
      grp.add(armL2);
      const armR2 = new THREE.Mesh(armGeo2, bodyMat2);
      armR2.position.set(0.55, 1.15, 0);
      grp.add(armR2);
      const legGeo2 = new THREE.CylinderGeometry(0.15, 0.13, 0.55, 6);
      const legL2 = new THREE.Mesh(legGeo2, bodyMat2);
      legL2.position.set(-0.18, 0.28, 0);
      legL2.castShadow = true;
      grp.add(legL2);
      const legR2 = new THREE.Mesh(legGeo2, bodyMat2);
      legR2.position.set(0.18, 0.28, 0);
      legR2.castShadow = true;
      grp.add(legR2);

      grp.position.set(x, groundY + 1.3, z);
      scene.add(grp);
      return {
        mesh: grp,
        eye,
        health: 40,
        maxHealth: 40,
        alive: true,
        state: 'patrol',
        patrolTarget: new THREE.Vector3(x, groundY + 1.3, z),
        groundY,
        speed: 3 + Math.random() * 1.5,
        lastAttack: 0,
        hitFlashT: 0,
        wanderTimer: 0
      };
    }

    // spawn on ground plazas
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * CITY_SIZE * 1.4;
      const z = (Math.random() - 0.5) * CITY_SIZE * 1.4;
      if (Math.abs(x) < 16 && Math.abs(z) < 16) continue;
      enemies.push(makeEnemy(x, z, 0));
    }
    // spawn a few on rooftops
    for (let i = 0; i < buildings.length && i < 60; i += 6) {
      const b = buildings[i];
      const topY = b.position.y + b.geometry.parameters.height / 2;
      enemies.push(makeEnemy(b.position.x, b.position.z, topY));
    }

    // ---------- Hero ----------
    const hero = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd6273c, roughness: 0.55, metalness: 0.1 });
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.5, metalness: 0.15 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.0, 10), bodyMat);
    torso.position.y = 1.55;
    torso.castShadow = true;
    hero.add(torso);
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), bodyMat);
    capTop.position.y = 2.05;
    hero.add(capTop);
    const capBottom = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), bodyMat);
    capBottom.position.y = 1.05;
    hero.add(capBottom);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), suitMat);
    head.position.y = 2.25;
    head.castShadow = true;
    hero.add(head);

    // Arms as shoulder-pivoted groups so they can swing during movement/swinging
    const armGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.7, 8);
    const shoulderL = new THREE.Group();
    shoulderL.position.set(-0.6, 1.9, 0);
    const armMeshL = new THREE.Mesh(armGeo, suitMat);
    armMeshL.position.y = -0.35;
    armMeshL.castShadow = true;
    shoulderL.add(armMeshL);
    hero.add(shoulderL);

    const shoulderR = new THREE.Group();
    shoulderR.position.set(0.6, 1.9, 0);
    const armMeshR = new THREE.Mesh(armGeo, suitMat);
    armMeshR.position.y = -0.35;
    armMeshR.castShadow = true;
    shoulderR.add(armMeshR);
    hero.add(shoulderR);

    // Legs as hip-pivoted groups for a proper walk cycle
    const legGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.9, 8);
    const hipL = new THREE.Group();
    hipL.position.set(-0.2, 1.0, 0);
    const legMeshL = new THREE.Mesh(legGeo, suitMat);
    legMeshL.position.y = -0.45;
    legMeshL.castShadow = true;
    hipL.add(legMeshL);
    hero.add(hipL);

    const hipR = new THREE.Group();
    hipR.position.set(0.2, 1.0, 0);
    const legMeshR = new THREE.Mesh(legGeo, suitMat);
    legMeshR.position.y = -0.45;
    legMeshR.castShadow = true;
    hipR.add(legMeshR);
    hero.add(hipR);

    hero.position.set(0, 1.5, 0);
    scene.add(hero);

    // ---------- Control state ----------
    const heroVelocity = new THREE.Vector3();
    let isSwinging = false;
    let swingAnchor = null;
    let swingLength = 0;
    let onGround = false;
    let webLine = null;
    let yaw = 0, pitch = -0.15;
    let webPressed = false;
    let jumpPressed = false;
    let fightRequested = false;
    let playerHealth = 100;
    let invincibleT = 0;
    const smoothedJoy = { x: 0, y: 0 };
    const joystick = { active: false, id: null, originX: 0, originY: 0, x: 0, y: 0 };
    const look = { active: false, id: null, lastX: 0, lastY: 0 };
    const GRAVITY = -28;
    const JOY_RADIUS = 55;
    const camPos = new THREE.Vector3();
    const camLookAt = new THREE.Vector3();
    let camInit = false;

    let msgTimeout;
    function showMsg(t) {
      setMessage(t);
      clearTimeout(msgTimeout);
      msgTimeout = setTimeout(() => setMessage(''), 900);
    }

    function raycastFromCamera() {
      const dir = new THREE.Vector3(0, 0, -1);
      dir.applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      const origin = hero.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const raycaster = new THREE.Raycaster(origin, dir, 0, 140);
      const hits = raycaster.intersectObjects(buildings, false);
      if (hits.length > 0) return hits[0].point;
      return origin.clone().add(dir.multiplyScalar(60)).setY(Math.max(30, origin.y + 15));
    }

    function startSwing() {
      if (isSwinging) return;
      const point = raycastFromCamera();
      swingAnchor = point;
      swingLength = hero.position.distanceTo(point);
      isSwinging = true;
      showMsg('Web attached!');
    }
    function releaseSwing() {
      if (isSwinging) {
        isSwinging = false;
        showMsg('Released');
      }
    }

    function checkGround() {
      onGround = hero.position.y <= 1.5001;
      for (const b of buildings) {
        const bb = new THREE.Box3().setFromObject(b);
        if (hero.position.x > bb.min.x - 0.5 && hero.position.x < bb.max.x + 0.5 &&
            hero.position.z > bb.min.z - 0.5 && hero.position.z < bb.max.z + 0.5) {
          if (hero.position.y <= bb.max.y + 1.5 && hero.position.y >= bb.max.y - 1.0 && heroVelocity.y <= 0) {
            hero.position.y = bb.max.y + 1.5;
            heroVelocity.y = 0;
            onGround = true;
          }
        }
      }
      if (hero.position.y < 1.5) {
        hero.position.y = 1.5;
        heroVelocity.y = 0;
        onGround = true;
      }
    }

    function updateHero(dt, t) {
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw) * -1);
      const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));

      // smooth the raw joystick input so movement eases in/out instead of snapping
      const targetJoyX = joystick.active ? joystick.x : 0;
      const targetJoyY = joystick.active ? joystick.y : 0;
      const smoothing = 1 - Math.pow(0.001, dt); // frame-rate independent lerp
      smoothedJoy.x += (targetJoyX - smoothedJoy.x) * smoothing;
      smoothedJoy.y += (targetJoyY - smoothedJoy.y) * smoothing;

      const fwdAmt = -smoothedJoy.y;
      const rightAmt = smoothedJoy.x;
      const moveX = forward.x * fwdAmt + right.x * rightAmt;
      const moveZ = forward.z * fwdAmt + right.z * rightAmt;
      const moveMag = Math.min(1, Math.hypot(fwdAmt, rightAmt));

      if (isSwinging) {
        heroVelocity.y += GRAVITY * dt;
        heroVelocity.x += moveX * 22 * dt;
        heroVelocity.z += moveZ * 22 * dt;
        // slight air resistance keeps the swing from feeling twitchy
        heroVelocity.multiplyScalar(0.999);
        hero.position.addScaledVector(heroVelocity, dt);

        const toAnchor = new THREE.Vector3().subVectors(hero.position, swingAnchor);
        const dist = toAnchor.length();
        if (dist > swingLength) {
          // soft rope constraint: pull back toward the rope length gradually
          // instead of snapping instantly, so the swing feels elastic and smooth
          const correctionStrength = 1 - Math.pow(0.0001, dt);
          const targetPos = swingAnchor.clone().add(toAnchor.clone().setLength(swingLength));
          hero.position.lerp(targetPos, correctionStrength);

          const radial = toAnchor.clone().normalize();
          const vDotR = heroVelocity.dot(radial);
          if (vDotR > 0) heroVelocity.addScaledVector(radial, -vDotR * correctionStrength);
        }
      } else {
        const speed = 11;
        heroVelocity.x += (moveX * speed - heroVelocity.x) * smoothing;
        heroVelocity.z += (moveZ * speed - heroVelocity.z) * smoothing;
        heroVelocity.y += GRAVITY * dt;
        if (onGround && jumpPressed) heroVelocity.y = 11;
        hero.position.addScaledVector(heroVelocity, dt);
      }

      checkGround();
      if (moveX !== 0 || moveZ !== 0) hero.rotation.y = Math.atan2(moveX, moveZ);
      hero.position.x = Math.max(-CITY_SIZE, Math.min(CITY_SIZE, hero.position.x));
      hero.position.z = Math.max(-CITY_SIZE, Math.min(CITY_SIZE, hero.position.z));

      // ---- procedural limb animation for a more lifelike, less static pose ----
      const horizSpeed = Math.hypot(heroVelocity.x, heroVelocity.z);
      if (isSwinging) {
        // arms up gripping the line, legs tucked/trailing based on swing speed
        const swingPhase = Math.min(1, horizSpeed / 14);
        shoulderL.rotation.x = -2.1;
        shoulderR.rotation.x = -2.1;
        hipL.rotation.x = 0.5 + swingPhase * 0.4;
        hipR.rotation.x = 0.5 + swingPhase * 0.4;
        // bank the whole body slightly toward the swing's lateral motion
        const lateral = new THREE.Vector3(heroVelocity.x, 0, heroVelocity.z);
        const fwdDot = lateral.dot(forward);
        hero.rotation.z += (THREE.MathUtils.clamp(-fwdDot * 0.02, -0.5, 0.5) - hero.rotation.z) * 0.08;
      } else if (!onGround) {
        // brief falling/jumping pose
        shoulderL.rotation.x += (-0.3 - shoulderL.rotation.x) * 0.15;
        shoulderR.rotation.x += (-0.3 - shoulderR.rotation.x) * 0.15;
        hipL.rotation.x += (0.2 - hipL.rotation.x) * 0.15;
        hipR.rotation.x += (-0.2 - hipR.rotation.x) * 0.15;
        hero.rotation.z += (0 - hero.rotation.z) * 0.1;
      } else if (moveMag > 0.05) {
        // walking/running cycle, stride speed scales with velocity
        const strideSpeed = 6 + horizSpeed * 0.9;
        const phase = t * strideSpeed;
        const swing = Math.sin(phase) * (0.5 + moveMag * 0.4);
        hipL.rotation.x = swing;
        hipR.rotation.x = -swing;
        shoulderL.rotation.x = -swing * 0.8;
        shoulderR.rotation.x = swing * 0.8;
        hero.rotation.z += (0 - hero.rotation.z) * 0.1;
      } else {
        // idle: ease limbs back to neutral
        hipL.rotation.x += (0 - hipL.rotation.x) * 0.1;
        hipR.rotation.x += (0 - hipR.rotation.x) * 0.1;
        shoulderL.rotation.x += (0 - shoulderL.rotation.x) * 0.1;
        shoulderR.rotation.x += (0 - shoulderR.rotation.x) * 0.1;
        hero.rotation.z += (0 - hero.rotation.z) * 0.1;
      }
    }

    function updateCamera(dt, t) {
      const camDist = isSwinging ? 9 : 7;
      const offset = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch) + 0.35,
        Math.cos(yaw) * Math.cos(pitch)
      ).multiplyScalar(camDist);
      const desiredPos = hero.position.clone().add(offset).add(new THREE.Vector3(0, 1.2, 0));
      const desiredLookAt = hero.position.clone().add(new THREE.Vector3(0, 1.3, 0));

      // subtle head-bob while running on the ground adds a tactile, physical feel
      const horizSpeed = Math.hypot(heroVelocity.x, heroVelocity.z);
      if (onGround && !isSwinging && horizSpeed > 1) {
        const bob = Math.sin(t * 10) * Math.min(0.12, horizSpeed * 0.01);
        desiredPos.y += bob;
      }

      if (!camInit) {
        camPos.copy(desiredPos);
        camLookAt.copy(desiredLookAt);
        camInit = true;
      } else {
        const followSpeed = isSwinging ? 10 : 14;
        const followT = 1 - Math.exp(-followSpeed * dt);
        camPos.lerp(desiredPos, followT);
        camLookAt.lerp(desiredLookAt, followT);
      }
      camera.position.copy(camPos);
      camera.lookAt(camLookAt);
    }

    function updateWebLine() {
      if (webLine) { scene.remove(webLine); webLine = null; }
      if (isSwinging) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          hero.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
          swingAnchor
        ]);
        webLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
        scene.add(webLine);
      }
    }

    function updateOrbs(dt, t) {
      for (let i = orbs.length - 1; i >= 0; i--) {
        const orb = orbs[i];
        orb.position.y = orb.userData.baseY + Math.sin(t * 1.5 + orb.userData.phase) * 1.5;
        orb.rotation.y += dt * 2;
        if (hero.position.distanceTo(orb.position) < 2.2) {
          scene.remove(orb);
          orbs.splice(i, 1);
          setScore(s => s + 1);
          showMsg('+1 Orb!');
        }
      }
    }

    function damagePlayer(amount) {
      if (invincibleT > 0) return;
      playerHealth = Math.max(0, playerHealth - amount);
      invincibleT = 0.8;
      setHealth(playerHealth);
      setHitFlash(true);
      setTimeout(() => setHitFlash(false), 150);
      if (playerHealth <= 0) {
        showMsg('Down! Recovering...');
        playerHealth = 100;
        setHealth(100);
        hero.position.set(0, 1.5, 0);
        heroVelocity.set(0, 0, 0);
        isSwinging = false;
        invincibleT = 1.5;
      }
    }

    function performAttack() {
      const attackRadius = 3.2;
      let hitAny = false;
      for (const en of enemies) {
        if (!en.alive) continue;
        const d = hero.position.distanceTo(en.mesh.position);
        if (d < attackRadius) {
          hitAny = true;
          en.health -= 20;
          en.hitFlashT = 0.15;
          const knock = new THREE.Vector3().subVectors(en.mesh.position, hero.position).normalize().multiplyScalar(2.5);
          en.mesh.position.add(knock);
          if (en.health <= 0 && en.alive) {
            en.alive = false;
            const startScale = en.mesh.scale.clone();
            let fadeT = 0;
            const fadeInterval = setInterval(() => {
              fadeT += 0.05;
              const s = Math.max(0, 1 - fadeT);
              en.mesh.scale.set(startScale.x * s, startScale.y * s, startScale.z * s);
              if (fadeT >= 1) {
                clearInterval(fadeInterval);
                scene.remove(en.mesh);
              }
            }, 16);
            setDefeated(d2 => d2 + 1);
            showMsg('Voltbot defeated!');
          }
        }
      }
      if (hitAny) showMsg('Hit!');
    }

    function updateEnemies(dt, t) {
      for (const en of enemies) {
        if (!en.alive) continue;
        const distToPlayer = en.mesh.position.distanceTo(hero.position);

        if (en.hitFlashT > 0) {
          en.hitFlashT -= dt;
          en.eye.material.emissiveIntensity = 2.5;
        } else {
          en.eye.material.emissiveIntensity = 1.2 + Math.sin(t * 4 + en.mesh.position.x) * 0.2;
        }

        if (distToPlayer < 22) {
          en.state = 'chase';
        } else if (distToPlayer > 30) {
          en.state = 'patrol';
        }

        if (en.state === 'chase') {
          const dir = new THREE.Vector3().subVectors(hero.position, en.mesh.position);
          dir.y = 0;
          if (dir.length() > 1.6) {
            dir.normalize();
            en.mesh.position.addScaledVector(dir, en.speed * dt);
            en.mesh.lookAt(hero.position.x, en.mesh.position.y, hero.position.z);
          } else {
            const now = t;
            if (now - en.lastAttack > 1.1) {
              en.lastAttack = now;
              damagePlayer(8);
            }
          }
        } else {
          en.wanderTimer -= dt;
          if (en.wanderTimer <= 0) {
            en.wanderTimer = 2 + Math.random() * 3;
            en.patrolTarget.set(
              en.mesh.position.x + (Math.random() - 0.5) * 14,
              en.groundY + 1.3,
              en.mesh.position.z + (Math.random() - 0.5) * 14
            );
          }
          const dir = new THREE.Vector3().subVectors(en.patrolTarget, en.mesh.position);
          dir.y = 0;
          if (dir.length() > 0.5) {
            dir.normalize();
            en.mesh.position.addScaledVector(dir, en.speed * 0.4 * dt);
            en.mesh.lookAt(en.patrolTarget.x, en.mesh.position.y, en.patrolTarget.z);
          }
        }
      }
    }

    function animate() {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();
      if (invincibleT > 0) invincibleT -= dt;
      if (webPressed && !isSwinging) startSwing();
      if (fightRequested) { performAttack(); fightRequested = false; }
      updateHero(dt, t);
      updateEnemies(dt, t);
      updateCamera(dt, t);
      updateWebLine();
      updateOrbs(dt, t);
      renderer.render(scene, camera);
    }

    // ---------- Touch input ----------
    function isInside(el, x, y) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function handleTouchStart(e) {
      for (const t of e.changedTouches) {
        if (isInside(webBtnRef.current, t.clientX, t.clientY) || isInside(jumpBtnRef.current, t.clientX, t.clientY) || isInside(fightBtnRef.current, t.clientX, t.clientY)) {
          continue;
        }
        const rect = containerRef.current.getBoundingClientRect();
        const localX = t.clientX - rect.left;
        if (!joystick.active && localX < rect.width * 0.5) {
          joystick.active = true;
          joystick.id = t.identifier;
          joystick.originX = t.clientX;
          joystick.originY = t.clientY;
          joystick.x = 0;
          joystick.y = 0;
        } else if (!look.active) {
          look.active = true;
          look.id = t.identifier;
          look.lastX = t.clientX;
          look.lastY = t.clientY;
        }
      }
    }
    function handleTouchMove(e) {
      for (const t of e.changedTouches) {
        if (joystick.active && t.identifier === joystick.id) {
          let dx = t.clientX - joystick.originX;
          let dy = t.clientY - joystick.originY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > JOY_RADIUS) { dx = (dx / dist) * JOY_RADIUS; dy = (dy / dist) * JOY_RADIUS; }
          joystick.x = dx / JOY_RADIUS;
          joystick.y = dy / JOY_RADIUS;
          if (stickRef.current) {
            stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
          }
        } else if (look.active && t.identifier === look.id) {
          const dx = t.clientX - look.lastX;
          const dy = t.clientY - look.lastY;
          yaw -= dx * 0.0045;
          pitch -= dy * 0.0045;
          pitch = Math.max(-1.2, Math.min(1.0, pitch));
          look.lastX = t.clientX;
          look.lastY = t.clientY;
        }
      }
    }
    function handleTouchEnd(e) {
      for (const t of e.changedTouches) {
        if (joystick.active && t.identifier === joystick.id) {
          joystick.active = false;
          joystick.id = null;
          joystick.x = 0;
          joystick.y = 0;
          if (stickRef.current) stickRef.current.style.transform = 'translate(0px, 0px)';
        }
        if (look.active && t.identifier === look.id) {
          look.active = false;
          look.id = null;
        }
      }
    }

    function onWebStart(e) { e.stopPropagation(); webPressed = true; }
    function onWebEnd(e) { e.stopPropagation(); webPressed = false; releaseSwing(); }
    function onJumpStart(e) { e.stopPropagation(); jumpPressed = true; }
    function onJumpEnd(e) { e.stopPropagation(); jumpPressed = false; }
    function onFightStart(e) { e.stopPropagation(); fightRequested = true; }

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }

    const container = containerRef.current;
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    const webBtn = webBtnRef.current;
    const jumpBtn = jumpBtnRef.current;
    webBtn.addEventListener('touchstart', onWebStart, { passive: true });
    webBtn.addEventListener('touchend', onWebEnd, { passive: true });
    webBtn.addEventListener('touchcancel', onWebEnd, { passive: true });
    jumpBtn.addEventListener('touchstart', onJumpStart, { passive: true });
    jumpBtn.addEventListener('touchend', onJumpEnd, { passive: true });
    jumpBtn.addEventListener('touchcancel', onJumpEnd, { passive: true });

    const fightBtn = fightBtnRef.current;
    fightBtn.addEventListener('touchstart', onFightStart, { passive: true });

    window.addEventListener('resize', onResize);
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(msgTimeout);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      webBtn.removeEventListener('touchstart', onWebStart);
      webBtn.removeEventListener('touchend', onWebEnd);
      webBtn.removeEventListener('touchcancel', onWebEnd);
      jumpBtn.removeEventListener('touchstart', onJumpStart);
      jumpBtn.removeEventListener('touchend', onJumpEnd);
      jumpBtn.removeEventListener('touchcancel', onJumpEnd);
      fightBtn.removeEventListener('touchstart', onFightStart);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [started]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100%', height: '85vh', maxHeight: 700,
        background: '#0b1020', overflow: 'hidden', borderRadius: 12, touchAction: 'none'
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {started && (
        <>
          <div style={{
            position: 'absolute', top: 10, left: 10, color: '#fff', background: 'rgba(0,0,0,0.35)',
            padding: '6px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.4
          }}>
            Left side: move &nbsp; Right side: look
          </div>
          <div style={{
            position: 'absolute', top: 10, right: 10, color: '#fff', background: 'rgba(0,0,0,0.35)',
            padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 'bold', textAlign: 'right'
          }}>
            <div>Orbs: {score}</div>
            <div>Voltbots: {defeated}</div>
          </div>

          {/* Health bar */}
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            width: 160, height: 14, background: 'rgba(0,0,0,0.4)', borderRadius: 8,
            border: '2px solid rgba(255,255,255,0.4)', overflow: 'hidden'
          }}>
            <div style={{
              width: `${health}%`, height: '100%',
              background: health > 40 ? '#4ade80' : '#ff3860',
              transition: 'width 0.2s ease'
            }} />
          </div>

          {hitFlash && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,0,0,0.25)', pointerEvents: 'none'
            }} />
          )}

          {/* Virtual joystick */}
          <div style={{
            position: 'absolute', left: 30, bottom: 30, width: 110, height: 110,
            borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.3)'
          }}>
            <div ref={stickRef} style={{
              position: 'absolute', left: '50%', top: '50%', width: 50, height: 50, marginLeft: -25, marginTop: -25,
              borderRadius: '50%', background: 'rgba(255,255,255,0.5)', transition: 'transform 0.05s linear'
            }} />
          </div>

          {/* Jump button */}
          <div ref={jumpBtnRef} style={{
            position: 'absolute', right: 30, bottom: 130, width: 68, height: 68, borderRadius: '50%',
            background: 'rgba(94,242,255,0.35)', border: '2px solid rgba(94,242,255,0.7)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 'bold', userSelect: 'none'
          }}>
            JUMP
          </div>

          {/* Web button */}
          <div ref={webBtnRef} style={{
            position: 'absolute', right: 30, bottom: 30, width: 86, height: 86, borderRadius: '50%',
            background: 'rgba(255,56,96,0.4)', border: '2px solid rgba(255,56,96,0.8)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 'bold', userSelect: 'none'
          }}>
            WEB
          </div>

          {/* Fight button */}
          <div ref={fightBtnRef} style={{
            position: 'absolute', right: 128, bottom: 30, width: 68, height: 68, borderRadius: '50%',
            background: 'rgba(255,180,40,0.4)', border: '2px solid rgba(255,180,40,0.8)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 'bold', userSelect: 'none'
          }}>
            FIGHT
          </div>

          {message && (
            <div style={{
              position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
              color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '8px 20px', borderRadius: 20, fontSize: 14
            }}>
              {message}
            </div>
          )}
        </>
      )}

      {!started && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(5,8,20,0.95)', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20
        }}>
          <h1 style={{ fontSize: 32, marginBottom: 4, color: '#ffd23f', letterSpacing: 2 }}>SKYLINE SWINGER</h1>
          <p style={{ maxWidth: 340, opacity: 0.85, lineHeight: 1.6, fontSize: 14 }}>
            An original web-slinging hero soars through Meridian City. Drag left to move, drag right to look, hold WEB to swing between rooftops, collect glowing orbs, and FIGHT off patrolling Voltbots before they wear down your health.
          </p>
          <button
            onClick={startGame}
            style={{
              marginTop: 20, padding: '14px 36px', fontSize: 16, border: 'none', borderRadius: 30,
              background: '#ff3860', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Start Swinging
          </button>
        </div>
      )}
    </div>
  );
}
