// ==================== AUDIO ====================
let audioCtx = null;
function getAudioCtx() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

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

// Hit sound (short noise burst)
export function playHitSound() {
  try {
    const ctx = getAudioCtx();
    const bufSize = ctx.sampleRate * 0.06;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
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

// ==================== BGM CONTROLLER ====================
const bgm = new Audio('./assets/bgm.mp3');
bgm.loop = true;
bgm.volume = 0.4;
let bgmPlaying = false;

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
