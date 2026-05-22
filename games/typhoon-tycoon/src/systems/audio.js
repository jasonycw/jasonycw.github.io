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
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
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
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
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
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
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
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
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
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
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
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { /* audio not available */ }
}

// ==================== BGM CONTROLLER ====================
const bgm = new Audio('./assets/bgm.mp3');
bgm.loop = true;
bgm.volume = 0.4;
let bgmPlaying = false;

export function startBGM() {
  if (bgmPlaying) return;
  bgm.play().catch(err => {
    console.warn('BGM autoplay failed:', err);
  });
  bgmPlaying = true;
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
    bgm.play().catch(err => {
      console.warn('BGM play failed:', err);
    });
    bgmPlaying = true;
    btn.textContent = '\u{1F50A} BGM';
  }
}
