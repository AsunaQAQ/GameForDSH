/* NIGHTFALL — tiny procedural audio engine (rain, drone, sfx) */
(function () {
  'use strict';

  const VOLUME = 0.34;
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  let ambientStarted = false;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // gentle master limiter
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;
    master.disconnect();
    master.connect(comp);
    comp.connect(ctx.destination);
    master._comp = comp;

    startAmbient();
  }

  function startAmbient() {
    if (!ctx || ambientStarted) return;
    ambientStarted = true;
    const now = ctx.currentTime;

    // rain: two filtered noise layers
    const rain = ctx.createBufferSource();
    rain.buffer = noiseBuf;
    rain.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const rg = ctx.createGain();
    rg.gain.value = 0.075;
    rain.connect(bp).connect(lp).connect(rg).connect(master);
    rain.start(now);

    const rumble = ctx.createBufferSource();
    rumble.buffer = noiseBuf;
    rumble.loop = true;
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 240;
    const rg2 = ctx.createGain();
    rg2.gain.value = 0.05;
    rumble.connect(rlp).connect(rg2).connect(master);
    rumble.start(now);

    // slow minor drone (D minor)
    const chord = [73.42, 110.0, 174.61, 220.0];
    const padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 420;
    padFilter.Q.value = 1.1;
    padGain.connect(padFilter).connect(master);

    chord.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i % 2 === 0 ? -5 : 6);
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.22;
      o.connect(g).connect(padGain);
      o.start(now);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.045 + i * 0.017;
      const lg = ctx.createGain();
      lg.gain.value = 0.16 * (i + 1);
      lfo.connect(lg).connect(g.gain);
      lfo.start(now);
    });

    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.06;
    const filterDepth = ctx.createGain();
    filterDepth.gain.value = 170;
    filterLfo.connect(filterDepth).connect(padFilter.frequency);
    filterLfo.start(now);

    // distant city hum
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 55;
    const humG = ctx.createGain();
    humG.gain.value = 0.018;
    hum.connect(humG).connect(master);
    hum.start(now);
  }

  function tone(type, f0, f1, dur, vol, delay = 0, attack = 0.006) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t0);
    if (f1 && f1 !== f0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, f0, f1, type = 'bandpass', q = 0.8, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(Math.max(30, f0), t0);
    if (f1 && f1 !== f0) {
      f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    }
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sfx = {
    jump() { tone('triangle', 240, 520, 0.13, 0.13); },
    doubleJump() {
      tone('sine', 520, 960, 0.16, 0.1);
      noise(0.12, 0.04, 2200, 5200, 'highpass', 0.7);
    },
    land() {
      noise(0.11, 0.09, 420, 160, 'lowpass', 0.7);
      tone('sine', 95, 52, 0.13, 0.1);
    },
    dash() {
      noise(0.2, 0.11, 1600, 220, 'bandpass', 1.2);
      tone('sawtooth', 220, 70, 0.14, 0.04);
    },
    slash() {
      noise(0.14, 0.13, 3200, 900, 'highpass', 0.9);
      tone('sawtooth', 320, 110, 0.1, 0.035);
    },
    hit() {
      noise(0.1, 0.12, 900, 200, 'bandpass', 1.4);
      tone('square', 160, 62, 0.13, 0.06);
    },
    hurt() {
      noise(0.22, 0.12, 700, 120, 'lowpass', 0.8);
      tone('square', 190, 62, 0.28, 0.09);
    },
    core() {
      [0, 0.08, 0.16].forEach((d, i) => {
        tone('sine', [784, 1046, 1568][i], [784, 1046, 1568][i], 0.26, 0.07, d);
      });
      tone('triangle', 2093, 2093, 0.3, 0.025, 0.16);
    },
    checkpoint() {
      [523, 659, 784].forEach((f, i) => tone('sine', f, f, 0.3, 0.055, i * 0.07));
    },
    gate() {
      [196, 293.66, 392, 587.33].forEach((f, i) => {
        tone('triangle', f, f, 0.9, 0.045, 0.03 + i * 0.05);
        tone('sine', f * 2, f * 2, 0.7, 0.02, 0.03 + i * 0.05);
      });
    },
    death() {
      tone('sawtooth', 240, 40, 0.8, 0.08);
      noise(0.7, 0.08, 800, 90, 'lowpass', 0.7);
    },
    ui() { tone('square', 680, 880, 0.05, 0.035); },
    thunder() {
      noise(1.4, 0.1, 160, 60, 'lowpass', 0.6);
      tone('sine', 48, 30, 1.2, 0.05);
    },
  };

  window.NF = window.NF || {};
  window.NF.audio = {
    init,
    sfx,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : VOLUME;
      return muted;
    },
    isMuted: () => muted,
    get started() { return !!ctx; },
  };
})();
