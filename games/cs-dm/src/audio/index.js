export const AUDIO_STORAGE_KEY = 'cs-dm.audio.v1';

export const AudioEvent = Object.freeze({
  MENU_ACTION: 'menu-action',
  FIRE: 'fire',
  HIT: 'hit',
  DEATH: 'death',
  RESPAWN: 'respawn',
  BUY_SUCCESS: 'buy-success',
  BUY_FAILURE: 'buy-failure',
  FOOTSTEP: 'footstep',
});

export const GENERATED_AUDIO_PROVENANCE = 'All CS DM feedback sounds are generated from Web Audio oscillator/noise envelope descriptors; no Counter-Strike, Valve, radio, or copied clips are used.';

export const GENERATED_SOUND_DESCRIPTORS = Object.freeze({
  [AudioEvent.MENU_ACTION]: Object.freeze({ kind: 'tone', wave: 'triangle', frequency: 520, endFrequency: 660, durationMs: 70, gain: 0.16 }),
  [AudioEvent.FIRE]: Object.freeze({ kind: 'hybrid', wave: 'sawtooth', frequency: 82, endFrequency: 45, durationMs: 115, gain: 0.32, noise: 0.42 }),
  [AudioEvent.HIT]: Object.freeze({ kind: 'tone', wave: 'square', frequency: 880, endFrequency: 620, durationMs: 72, gain: 0.18 }),
  [AudioEvent.DEATH]: Object.freeze({ kind: 'hybrid', wave: 'sine', frequency: 160, endFrequency: 44, durationMs: 360, gain: 0.24, noise: 0.18 }),
  [AudioEvent.RESPAWN]: Object.freeze({ kind: 'tone', wave: 'triangle', frequency: 240, endFrequency: 720, durationMs: 240, gain: 0.18 }),
  [AudioEvent.BUY_SUCCESS]: Object.freeze({ kind: 'tone', wave: 'triangle', frequency: 420, endFrequency: 840, durationMs: 130, gain: 0.2 }),
  [AudioEvent.BUY_FAILURE]: Object.freeze({ kind: 'tone', wave: 'sawtooth', frequency: 180, endFrequency: 110, durationMs: 130, gain: 0.16 }),
  [AudioEvent.FOOTSTEP]: Object.freeze({ kind: 'noise', durationMs: 65, gain: 0.09, noise: 0.28 }),
});

const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  muted: false,
  volume: 0.55,
});

const clampVolume = (value) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : DEFAULT_AUDIO_SETTINGS.volume));

const normalizeAudioSettings = (settings = {}) => Object.freeze({
  muted: Boolean(settings.muted),
  volume: clampVolume(settings.volume),
});

export const createMemoryAudioStorage = () => {
  const values = new Map();
  return Object.freeze({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  });
};

export const readAudioSettings = (storage) => {
  if (!storage || typeof storage.getItem !== 'function') {
    return Object.freeze({ value: DEFAULT_AUDIO_SETTINGS, warning: null });
  }

  try {
    const raw = storage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) {
      return Object.freeze({ value: DEFAULT_AUDIO_SETTINGS, warning: null });
    }

    return Object.freeze({ value: normalizeAudioSettings(JSON.parse(raw)), warning: null });
  } catch (error) {
    return Object.freeze({ value: DEFAULT_AUDIO_SETTINGS, warning: 'audio-storage-corrupt' });
  }
};

export const writeAudioSettings = (storage, settings) => {
  if (!storage || typeof storage.setItem !== 'function') {
    return false;
  }

  storage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(normalizeAudioSettings(settings)));
  return true;
};

const getAudioContextCtor = (environment) => environment?.AudioContext ?? environment?.webkitAudioContext ?? null;

const createNoiseBuffer = (audioContext, durationSeconds) => {
  const sampleRate = audioContext.sampleRate || 44100;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  return buffer;
};

const scheduleEnvelope = (gainNode, audioContext, gain, durationSeconds) => {
  const now = audioContext.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
};

const playDescriptor = (audioContext, descriptor, volume) => {
  const durationSeconds = Math.max(0.02, descriptor.durationMs / 1000);
  const output = audioContext.createGain();
  output.connect(audioContext.destination);
  scheduleEnvelope(output, audioContext, descriptor.gain * volume, durationSeconds);

  if (descriptor.kind === 'tone' || descriptor.kind === 'hybrid') {
    const oscillator = audioContext.createOscillator();
    oscillator.type = descriptor.wave;
    oscillator.frequency.setValueAtTime(descriptor.frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, descriptor.endFrequency), audioContext.currentTime + durationSeconds);
    oscillator.connect(output);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationSeconds);
  }

  if (descriptor.kind === 'noise' || descriptor.kind === 'hybrid') {
    const noiseGain = audioContext.createGain();
    noiseGain.gain.value = descriptor.noise ?? 0.2;
    const noise = audioContext.createBufferSource();
    noise.buffer = createNoiseBuffer(audioContext, durationSeconds);
    noise.connect(noiseGain);
    noiseGain.connect(output);
    noise.start();
    noise.stop(audioContext.currentTime + durationSeconds);
  }
};

export function createAudioController({ environment = globalThis, storage = environment?.localStorage, descriptors = GENERATED_SOUND_DESCRIPTORS } = {}) {
  const AudioContextCtor = getAudioContextCtor(environment);
  const persisted = readAudioSettings(storage).value;
  let settings = persisted;
  let audioContext = null;
  let unlocked = false;

  const persist = () => writeAudioSettings(storage, settings);

  const getState = () => Object.freeze({
    supported: Boolean(AudioContextCtor),
    unlocked,
    muted: settings.muted,
    volume: settings.volume,
    fallback: AudioContextCtor ? 'web-audio' : 'silent-noop',
  });

  const unlock = () => {
    if (!AudioContextCtor) {
      return Object.freeze({ ok: false, reason: 'audio-context-unavailable', state: getState() });
    }

    if (!audioContext) {
      audioContext = new AudioContextCtor();
    }

    const resumePromise = typeof audioContext.resume === 'function' ? audioContext.resume() : null;

    unlocked = true;
    return Object.freeze({ ok: true, reason: 'unlocked-after-user-gesture', state: getState(), resumePromise });
  };

  const play = (eventId) => {
    const descriptor = descriptors[eventId];
    if (!descriptor) {
      return Object.freeze({ ok: false, reason: 'missing-sound', eventId, state: getState() });
    }
    if (!AudioContextCtor) {
      return Object.freeze({ ok: false, reason: 'audio-context-unavailable', eventId, state: getState() });
    }
    if (!unlocked || !audioContext || audioContext.state === 'suspended') {
      return Object.freeze({ ok: false, reason: 'locked-until-user-gesture', eventId, state: getState() });
    }
    if (settings.muted || settings.volume <= 0) {
      return Object.freeze({ ok: false, reason: 'muted', eventId, state: getState() });
    }

    playDescriptor(audioContext, descriptor, settings.volume);
    return Object.freeze({ ok: true, reason: 'played-generated-sound', eventId, descriptor, state: getState() });
  };

  const setMuted = (muted) => {
    settings = normalizeAudioSettings({ ...settings, muted });
    persist();
    return getState();
  };

  const setVolume = (volume) => {
    settings = normalizeAudioSettings({ ...settings, volume });
    persist();
    return getState();
  };

  return Object.freeze({ getState, unlock, play, setMuted, setVolume });
}
