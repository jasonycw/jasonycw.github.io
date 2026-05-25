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

// Freeze tower sound — icy crystal shards
export function playFreezeSound() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    // Phase 1: High icy shimmer — two detuned oscillators
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const offset = i === 0 ? 0 : 15;
      osc.frequency.setValueAtTime(1800 + offset, t);
      osc.frequency.exponentialRampToValueAtTime(300 + offset, t + 0.35);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    }

    // Phase 2: Ice crackle — noise burst
    const crackSize = Math.floor(ctx.sampleRate * 0.15);
    const crackBuf = ctx.createBuffer(1, crackSize, ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackSize; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / crackSize);
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.1, t + 0.05);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    crack.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(t + 0.05);
  } catch (e) { /* audio not available */ }
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

    // Phase 1: Deep rumbling — low-frequency oscillation with modulation
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(40, t);
    rumble.frequency.linearRampToValueAtTime(25, t + 0.3);
    rumble.frequency.linearRampToValueAtTime(45, t + 0.7);
    rumble.frequency.exponentialRampToValueAtTime(10, t + 1.8);
    rumbleGain.gain.setValueAtTime(0.5, t);
    rumbleGain.gain.linearRampToValueAtTime(0.35, t + 0.4);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(t);
    rumble.stop(t + 2.0);

    // Phase 2: Rock grinding — noise with amplitude modulation
    const grindSize = Math.floor(ctx.sampleRate * 1.2);
    const grindBuf = ctx.createBuffer(1, grindSize, ctx.sampleRate);
    const grindData = grindBuf.getChannelData(0);
    for (let i = 0; i < grindSize; i++) {
      const env = Math.max(0, 1 - i / grindSize);
      const mod = 0.5 + 0.5 * Math.sin(i * 0.02);
      grindData[i] = (Math.random() * 2 - 1) * env * mod;
    }
    const grind = ctx.createBufferSource();
    grind.buffer = grindBuf;
    const grindGain = ctx.createGain();
    grindGain.gain.setValueAtTime(0.2, t + 0.1);
    grindGain.gain.linearRampToValueAtTime(0.3, t + 0.3);
    grindGain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    grind.connect(grindGain);
    grindGain.connect(ctx.destination);
    grind.start(t + 0.1);

    // Phase 3: Distant crash — low thump (structure creaking/failing)
    const crash = ctx.createOscillator();
    const crashGain = ctx.createGain();
    crash.type = 'triangle';
    crash.frequency.setValueAtTime(150, t + 0.5);
    crash.frequency.exponentialRampToValueAtTime(30, t + 1.0);
    crashGain.gain.setValueAtTime(0.15, t + 0.5);
    crashGain.gain.linearRampToValueAtTime(0.1, t + 0.7);
    crashGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    crash.connect(crashGain);
    crashGain.connect(ctx.destination);
    crash.start(t + 0.5);
    crash.stop(t + 1.2);
  } catch (e) { /* audio not available */ }
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
