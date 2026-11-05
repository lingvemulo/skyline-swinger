// Focus Charge: hold FOCUS and the hero stands still while a glowing ring
// slowly grows (CHARGE), holds, then slowly shrinks (RELEASE). Each full cycle
// fills one segment of a 3-segment Focus Meter, which is spent on powers:
// Super Swing (1), Shield (2), Stealth (3). Letting go early just restarts
// the cycle. The pace is fixed on purpose — nothing speeds it up.
//
// api: { hero, scene, audioCtx, canFocus() -> bool, onHud(hud), showMsg(text, ms),
//        spawnBurst(pos, color, n, opts) }

export const FOCUS_GROW = 4;
export const FOCUS_HOLD = 1;
export const FOCUS_SHRINK = 5.5;
const CYCLE = FOCUS_GROW + FOCUS_HOLD + FOCUS_SHRINK;
export const FOCUS_SEGMENTS = 3;
export const REWARDS = {
  swing: { cost: 1, name: 'SUPER SWING' },
  shield: { cost: 2, name: 'SHIELD', secs: 15 },
  stealth: { cost: 3, name: 'STEALTH', secs: 10 },
};

const ease = (x) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;

function glowTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(160,250,255,0.9)');
  grad.addColorStop(0.35, 'rgba(94,242,255,0.45)');
  grad.addColorStop(1, 'rgba(94,242,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createFocus(THREE, api) {
  const { hero, scene, audioCtx } = api;
  let holding = false;   // FOCUS button is down
  let focusing = false;  // actually charging (holding + allowed to stand still)
  let t = 0;             // time into the current cycle
  let meter = 0;
  let cycles = 0;        // completed cycles, ever (this session)
  let superSwing = false;
  let shieldT = 0;
  let stealthT = 0;

  // soft glow around the hero's chest while focusing
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(THREE), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  glow.position.set(0, 0.1, 0);
  glow.visible = false;
  hero.add(glow);

  // Shield bubble
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  bubble.position.set(0, -0.3, 0);
  bubble.visible = false;
  hero.add(bubble);

  // ---- sound: a soft whoosh + hum that rises on CHARGE and falls on RELEASE ----
  let noiseBuf = null;
  let voice = null;
  function startVoice() {
    stopVoice(0.05);
    if (!audioCtx) return;
    try {
      if (!noiseBuf) {
        noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const now = audioCtx.currentTime;
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      const hum = audioCtx.createOscillator();
      hum.type = 'sine';
      const humGain = audioCtx.createGain();
      const out = audioCtx.createGain();
      src.connect(bp).connect(out);
      hum.connect(humGain).connect(out);
      out.connect(audioCtx.destination);
      const up = now + FOCUS_GROW, top = up + FOCUS_HOLD, end = top + FOCUS_SHRINK;
      bp.frequency.setValueAtTime(260, now);
      bp.frequency.linearRampToValueAtTime(1100, up);
      bp.frequency.setValueAtTime(1100, top);
      bp.frequency.linearRampToValueAtTime(240, end);
      hum.frequency.setValueAtTime(110, now);
      hum.frequency.linearRampToValueAtTime(165, up);
      hum.frequency.setValueAtTime(165, top);
      hum.frequency.linearRampToValueAtTime(105, end);
      humGain.gain.value = 0.35;
      out.gain.setValueAtTime(0.0001, now);
      out.gain.linearRampToValueAtTime(0.09, up);
      out.gain.setValueAtTime(0.09, top);
      out.gain.linearRampToValueAtTime(0.0001, end);
      src.start(now);
      hum.start(now);
      voice = { src, hum, out };
    } catch (e) { voice = null; }
  }
  function stopVoice(fade = 0.2) {
    if (!voice || !audioCtx) { voice = null; return; }
    const { src, hum, out } = voice;
    voice = null;
    try {
      const now = audioCtx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now);
      out.gain.linearRampToValueAtTime(0.0001, now + fade);
      src.stop(now + fade + 0.05);
      hum.stop(now + fade + 0.05);
    } catch (e) { /* already stopped */ }
  }
  function chime() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [660, 990].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.1, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.5);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.55);
    });
  }

  let lastHud = '';
  function pushHud() {
    const hud = { meter, superSwing, shield: shieldT > 0, stealth: stealthT > 0, cycles };
    const key = JSON.stringify(hud);
    if (key !== lastHud) { lastHud = key; api.onHud(hud); }
  }

  function resetCycle() {
    if (focusing) stopVoice();
    focusing = false;
    t = 0;
  }

  // 0..1 ring size for the current moment of the cycle
  function ringSize() {
    if (t < FOCUS_GROW) return ease(t / FOCUS_GROW);
    if (t < FOCUS_GROW + FOCUS_HOLD) return 1;
    return 1 - ease((t - FOCUS_GROW - FOCUS_HOLD) / FOCUS_SHRINK);
  }

  function setStealthLook(on) {
    hero.traverse(o => {
      if (!o.isMesh || o === bubble || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (on) {
          if (m.userData.preStealth === undefined) m.userData.preStealth = { opacity: m.opacity, transparent: m.transparent };
          m.transparent = true;
          m.opacity = 0.28;
        } else if (m.userData.preStealth) {
          m.opacity = m.userData.preStealth.opacity;
          m.transparent = m.userData.preStealth.transparent;
          delete m.userData.preStealth;
        }
      }
    });
  }

  const focus = {
    get holding() { return holding; },
    get focusing() { return focusing; },
    get meter() { return meter; },
    get cycles() { return cycles; },
    get stealth() { return stealthT > 0; },
    get shield() { return shieldT > 0; },
    get superSwing() { return superSwing; },
    // 0..1 ring size, and the cue under it
    get ring() { return focusing ? ringSize() : 0; },
    get cue() { return t < FOCUS_GROW + FOCUS_HOLD ? 'CHARGE' : 'RELEASE'; },
    // progress (0..1) of the cycle being charged, for the meter
    get progress() { return focusing ? t / CYCLE : 0; },
    press(on) {
      holding = on;
      if (!on) resetCycle();
    },
    // a hit knocks the hero out of their stance: the cycle starts over
    interrupt() { if (focusing) { resetCycle(); } },
    spend(kind) {
      const r = REWARDS[kind];
      if (!r || meter < r.cost) return false;
      if (kind === 'swing' && superSwing) return false;
      meter -= r.cost;
      if (kind === 'swing') { superSwing = true; api.showMsg('SUPER SWING ready! Shoot a web', 1400); }
      if (kind === 'shield') { shieldT = r.secs; bubble.visible = true; api.showMsg('SHIELD up!', 1100); }
      if (kind === 'stealth') {
        if (stealthT <= 0) setStealthLook(true);
        stealthT = r.secs;
        api.showMsg('STEALTH MODE — Voltbots lost you', 1400);
      }
      pushHud();
      return true;
    },
    // App calls this when a swing starts; true = this swing is a Super Swing
    takeSuperSwing() {
      if (!superSwing) return false;
      superSwing = false;
      pushHud();
      return true;
    },
    // App calls this before damage lands; true = the shield took the hit
    absorbHit() {
      if (shieldT <= 0) return false;
      shieldT = 0;
      bubble.visible = false;
      api.spawnBurst(hero.position.clone(), 0x7ff6ff, 16, { speed: 7, life: 0.5, size: 0.7, gravity: -6 });
      api.showMsg('Shield blocked it!', 1000);
      pushHud();
      return true;
    },
    update(dt, time) {
      const can = holding && api.canFocus();
      if (can && !focusing) { focusing = true; t = 0; startVoice(); }
      else if (!can && focusing) resetCycle();
      if (focusing) {
        t += dt;
        if (t >= CYCLE) {
          t -= CYCLE;
          cycles++;
          if (meter < FOCUS_SEGMENTS) {
            meter++;
            api.showMsg(meter === FOCUS_SEGMENTS ? 'FOCUS FULL! ⚡⚡⚡' : `FOCUS +1 ⚡`, 1100);
          }
          chime();
          api.spawnBurst(hero.position.clone(), 0x9ff8ff, 10, { speed: 3, life: 0.6, size: 0.5, gravity: 2 });
          startVoice();
        }
      }
      const s = focusing ? ringSize() : 0;
      glow.visible = s > 0.01;
      glow.material.opacity = 0.25 + s * 0.55;
      glow.scale.setScalar(1.6 + s * 1.6);

      if (shieldT > 0) {
        shieldT -= dt;
        bubble.scale.setScalar(1 + Math.sin(time * 3) * 0.04);
        bubble.material.opacity = shieldT < 2 ? 0.22 * Math.max(0, shieldT / 2) * (0.6 + 0.4 * Math.sin(time * 20)) : 0.22;
        if (shieldT <= 0) bubble.visible = false;
      }
      if (stealthT > 0) {
        stealthT -= dt;
        if (stealthT <= 0) { setStealthLook(false); api.showMsg('Stealth over — they can see you!', 1200); }
      }
      pushHud();
    },
  };
  pushHud();
  return focus;
}
