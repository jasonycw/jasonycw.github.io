// ==================== AUDIO ====================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Cache for hit sound buffer — generated once, reused across all hits
let hitBuffer = null;

// Laser beam sound (high-frequency sweep)
export function playLaserSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) { /* audio not available */ }
}

// Explosion sound (low boom)
export function playExplosionSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { /* audio not available */ }
}

// Hit sound (short noise burst) — buffer created once and reused
export function playHitSound() {
  try {
    const ctx = getAudioCtx();
    if (!hitBuffer) {
      const size = ctx.sampleRate * 0.06;
      hitBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = hitBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    const src = ctx.createBufferSource();
    src.buffer = hitBuffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (e) { /* audio not available */ }
}

// Game over sound (descending tone)
export function playGameOverSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 2);
  } catch (e) { /* audio not available */ }
}

// Power outage sound — low descending hum, like equipment shutting down
export function playPowerDownSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) { /* audio not available */ }
}

// Power restored sound — rising tone, like equipment powering on
export function playPowerUpSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { /* audio not available */ }
}

// Building/structure placed sound — heavy thud + metal click + machinery settle
export function playBuildSound() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    // Phase 1: Heavy thud — low sine sweep down (the weight landing)
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(180, t);
    thud.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    thudGain.gain.setValueAtTime(0.4, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(t);
    thud.stop(t + 0.2);

    // Phase 2: Metal click — higher frequency ping (structure locking in)
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1200, t + 0.05);
    click.frequency.exponentialRampToValueAtTime(300, t + 0.15);
    clickGain.gain.setValueAtTime(0.15, t + 0.05);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(t + 0.05);
    click.stop(t + 0.18);

    // Phase 3: Short noise burst — machinery settle
    const bufSize = Math.floor(ctx.sampleRate * 0.06);
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) noiseData[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, t + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t + 0.08);
  } catch (e) { /* audio not available */ }
}

// Building destroyed sound — low boom + debris rumble + metallic rattle
export function playBuildingDestroySound() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    // Phase 1: Low boom — impact (structure giving way)
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(120, t);
    boom.frequency.exponentialRampToValueAtTime(25, t + 0.6);
    boomGain.gain.setValueAtTime(0.4, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(t);
    boom.stop(t + 0.7);

    // Phase 2: Debris rumble — filtered noise
    const bufSize = Math.floor(ctx.sampleRate * 0.5);
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.max(0, 1 - i / bufSize);
      noiseData[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t + 0.05);
    noiseGain.gain.linearRampToValueAtTime(0.15, t + 0.25);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t + 0.05);

    // Phase 3: Metallic rattle — high triangle sweep (debris bouncing)
    const rattle = ctx.createOscillator();
    const rattleGain = ctx.createGain();
    rattle.type = 'triangle';
    rattle.frequency.setValueAtTime(2500, t + 0.1);
    rattle.frequency.exponentialRampToValueAtTime(200, t + 0.45);
    rattleGain.gain.setValueAtTime(0.08, t + 0.1);
    rattleGain.gain.linearRampToValueAtTime(0.04, t + 0.3);
    rattleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    rattle.connect(rattleGain);
    rattleGain.connect(ctx.destination);
    rattle.start(t + 0.1);
    rattle.stop(t + 0.5);
  } catch (e) { /* audio not available */ }
}

// Tree destroyed by typhoon — heavy wind blow away sound
export function playTreeDestroySound() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    // Phase 1: Deep wind rumble — noise with low-pass sweep
    const bufSize = Math.floor(ctx.sampleRate * 0.9);
    const windBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const windData = windBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.max(0, 1 - i / bufSize);
      windData[i] = (Math.random() * 2 - 1) * env;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = windBuf;
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.3, t);
    windGain.gain.linearRampToValueAtTime(0.2, t + 0.3);
    windGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    wind.connect(windGain);
    windGain.connect(ctx.destination);
    wind.start(t);

    // Phase 2: Rising whoosh — sine sweep up (tree being ripped up)
    const whoosh = ctx.createOscillator();
    const whooshGain = ctx.createGain();
    whoosh.type = 'sine';
    whoosh.frequency.setValueAtTime(80, t + 0.05);
    whoosh.frequency.exponentialRampToValueAtTime(600, t + 0.35);
    whoosh.frequency.exponentialRampToValueAtTime(100, t + 0.7);
    whooshGain.gain.setValueAtTime(0.15, t + 0.05);
    whooshGain.gain.linearRampToValueAtTime(0.25, t + 0.2);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    whoosh.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whoosh.start(t + 0.05);
    whoosh.stop(t + 0.75);

    // Phase 3: Leaf rustle — short high noise burst
    const leafSize = Math.floor(ctx.sampleRate * 0.2);
    const leafBuf = ctx.createBuffer(1, leafSize, ctx.sampleRate);
    const leafData = leafBuf.getChannelData(0);
    for (let i = 0; i < leafSize; i++) {
      leafData[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / leafSize);
    }
    const leaf = ctx.createBufferSource();
    leaf.buffer = leafBuf;
    const leafGain = ctx.createGain();
    leafGain.gain.setValueAtTime(0.06, t + 0.3);
    leafGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    leaf.connect(leafGain);
    leafGain.connect(ctx.destination);
    leaf.start(t + 0.3);
  } catch (e) { /* audio not available */ }
}

// Freeze tower sound — continuous icy wind + shimmer while beam is active
export function startFreezeSound(tower) {
  try {
    const ctx = getAudioCtx();
    if (!ctx || tower._freezeNodes) return;
    const t = ctx.currentTime;
    const nodes = {};

    // Master gain for fade-out
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35, t);
    master.connect(ctx.destination);
    nodes.master = master;

    // Continuous icy wind — looping noise with gentle LFO amplitude modulation
    const windLen = Math.floor(ctx.sampleRate * 2);
    const windBuf = ctx.createBuffer(1, windLen, ctx.sampleRate);
    const windData = windBuf.getChannelData(0);
    for (let i = 0; i < windLen; i++) {
      windData[i] = (Math.random() * 2 - 1) * (1 - 0.3 * (i / windLen));
    }
    const wind = ctx.createBufferSource();
    wind.buffer = windBuf;
    wind.loop = true;
    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.15, t);
    nodes.windGain = windGain;
    // LFO for wind modulation
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(1.5, t);
    lfoGain.gain.setValueAtTime(0.07, t);
    lfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);
    wind.connect(windGain);
    windGain.connect(master);
    wind.start(t);
    lfo.start(t);
    nodes.wind = wind;
    nodes.lfo = lfo;
    nodes.lfoGain = lfoGain;

    // High icy shimmer — two detuned oscillators at steady pitch
    const shimmerOscs = [];
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const offset = i === 0 ? 0 : 17;
      osc.frequency.setValueAtTime(2200 + offset, t);
      osc.frequency.linearRampToValueAtTime(1800 + offset, t + 0.15);
      gain.gain.setValueAtTime(0.0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.15);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      shimmerOscs.push({ osc, gain });
    }
    nodes.shimmerOscs = shimmerOscs;

    // Occasional ice crackle — periodic noise bursts using a script-based approach
    const crackleLen = Math.floor(ctx.sampleRate * 0.4);
    const crackleBuf = ctx.createBuffer(1, crackleLen, ctx.sampleRate);
    const crackleData = crackleBuf.getChannelData(0);
    for (let i = 0; i < crackleLen; i++) {
      // Bursts of noise every ~120ms with decay
      const posInBurst = i % Math.floor(ctx.sampleRate * 0.12);
      const burstEnv = Math.max(0, 1 - posInBurst / Math.floor(ctx.sampleRate * 0.06));
      crackleData[i] = (Math.random() * 2 - 1) * burstEnv * 0.4;
    }
    const crackle = ctx.createBufferSource();
    crackle.buffer = crackleBuf;
    crackle.loop = true;
    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0.12, t + 0.15);
    crackle.connect(crackleGain);
    crackleGain.connect(master);
    crackle.start(t + 0.15);
    nodes.crackle = crackle;
    nodes.crackleGain = crackleGain;

    tower._freezeNodes = nodes;
  } catch (e) { /* audio not available */ }
}

// Stop the continuous freeze sound
export function stopFreezeSound(tower) {
  const nodes = tower._freezeNodes;
  if (!nodes) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime + 0.05;
    // Fade out master
    nodes.master.gain.linearRampToValueAtTime(0.001, t + 0.3);
    // Stop all sources after fade
    const stopTime = t + 0.35;
    if (nodes.wind) nodes.wind.stop(stopTime);
    if (nodes.lfo) nodes.lfo.stop(stopTime);
    if (nodes.shimmerOscs) nodes.shimmerOscs.forEach(({ osc }) => { osc.stop(stopTime); });
    if (nodes.crackle) nodes.crackle.stop(stopTime);
  } catch (e) { /* audio not available */ }
  tower._freezeNodes = null;
}

// Repel tower sound — psychic force push
export function playRepelSound() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    // Phase 1: Building energy whoosh — rising sine
    const build = ctx.createOscillator();
    const buildGain = ctx.createGain();
    build.type = 'sine';
    build.frequency.setValueAtTime(100, t);
    build.frequency.exponentialRampToValueAtTime(800, t + 0.15);
    buildGain.gain.setValueAtTime(0.2, t);
    buildGain.gain.linearRampToValueAtTime(0.3, t + 0.1);
    buildGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    build.connect(buildGain);
    buildGain.connect(ctx.destination);
    build.start(t);
    build.stop(t + 0.2);

    // Phase 2: Force release — thump + descending sweep
    const release = ctx.createOscillator();
    const releaseGain = ctx.createGain();
    release.type = 'triangle';
    release.frequency.setValueAtTime(400, t + 0.12);
    release.frequency.exponentialRampToValueAtTime(60, t + 0.45);
    releaseGain.gain.setValueAtTime(0.25, t + 0.12);
    releaseGain.gain.linearRampToValueAtTime(0.15, t + 0.25);
    releaseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    release.connect(releaseGain);
    releaseGain.connect(ctx.destination);
    release.start(t + 0.12);
    release.stop(t + 0.5);

    // Phase 3: Ring resonance — short metallic ping
    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(1200, t + 0.15);
    ring.frequency.exponentialRampToValueAtTime(400, t + 0.35);
    ringGain.gain.setValueAtTime(0.06, t + 0.15);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    ring.connect(ringGain);
    ringGain.connect(ctx.destination);
    ring.start(t + 0.15);
    ring.stop(t + 0.4);
  } catch (e) { /* audio not available */ }
}

// Earthquake shake rock sound — deep rumble + grinding + distant crash
export function playEarthquakeSound() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    // Master gain to easily adjust overall volume
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.7, t);
    master.connect(ctx.destination);

    // Phase 1: Deep rumbling — low-frequency oscillation with modulation
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(35, t);
    rumble.frequency.linearRampToValueAtTime(20, t + 0.5);
    rumble.frequency.linearRampToValueAtTime(45, t + 1.0);
    rumble.frequency.exponentialRampToValueAtTime(8, t + 2.5);
    rumbleGain.gain.setValueAtTime(0.55, t);
    rumbleGain.gain.linearRampToValueAtTime(0.4, t + 0.5);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    rumble.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start(t);
    rumble.stop(t + 2.8);

    // Phase 2: Impact thump — short sharp hit (structure cracking)
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(200, t);
    thump.frequency.exponentialRampToValueAtTime(30, t + 0.15);
    thumpGain.gain.setValueAtTime(0.6, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(t);
    thump.stop(t + 0.3);

    // Phase 3: Rock grinding — noise with amplitude modulation
    const grindSize = Math.floor(ctx.sampleRate * 1.5);
    const grindBuf = ctx.createBuffer(1, grindSize, ctx.sampleRate);
    const grindData = grindBuf.getChannelData(0);
    for (let i = 0; i < grindSize; i++) {
      const env = Math.max(0, 1 - i / grindSize);
      const mod = 0.5 + 0.5 * Math.sin(i * 0.025);
      grindData[i] = (Math.random() * 2 - 1) * env * mod;
    }
    const grind = ctx.createBufferSource();
    grind.buffer = grindBuf;
    const grindGain = ctx.createGain();
    grindGain.gain.setValueAtTime(0.0, t + 0.05);
    grindGain.gain.linearRampToValueAtTime(0.35, t + 0.35);
    grindGain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);

    // LFO modulates grind amplitude for gritty texture
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(8, t);
    lfoGain.gain.setValueAtTime(0.15, t);
    lfo.connect(lfoGain);
    lfoGain.connect(grindGain.gain);
    grind.connect(grindGain);
    grindGain.connect(master);
    grind.start(t + 0.05);
    lfo.start(t + 0.05);
    lfo.stop(t + 1.6);

    // Phase 4: Distant crash — low thump (structure creaking/failing)
    const crash = ctx.createOscillator();
    const crashGain = ctx.createGain();
    crash.type = 'triangle';
    crash.frequency.setValueAtTime(180, t + 0.6);
    crash.frequency.exponentialRampToValueAtTime(25, t + 1.3);
    crashGain.gain.setValueAtTime(0.2, t + 0.6);
    crashGain.gain.linearRampToValueAtTime(0.15, t + 0.85);
    crashGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    crash.connect(crashGain);
    crashGain.connect(master);
    crash.start(t + 0.6);
    crash.stop(t + 1.5);
    master.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Earthquake sound error:', e);
  }
}
const bgm = new Audio('./assets/bgm.mp3');
bgm.loop = true;
bgm.volume = 0.4;
let bgmPlaying = false;

export function startBGM() {
  if (bgmPlaying) return;
  bgm.play().then(() => {
    bgmPlaying = true;
  }).catch(err => {
    console.warn('BGM autoplay failed:', err);
    bgmPlaying = false;
  });
  const btn = document.getElementById('musicBtn');
  if (btn) btn.textContent = '\u{1F50A} BGM';
}

export function toggleBGM() {
  const btn = document.getElementById('musicBtn');
  if (bgmPlaying) {
    bgm.pause();
    bgmPlaying = false;
    btn.textContent = '\u{1F3B5} BGM';
  } else {
    bgm.play().then(() => {
      bgmPlaying = true;
      btn.textContent = '\u{1F50A} BGM';
    }).catch(err => {
      console.warn('BGM play failed:', err);
      bgmPlaying = false;
    });
  }
}
