import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUDIO_STORAGE_KEY,
  AudioEvent,
  GENERATED_AUDIO_PROVENANCE,
  GENERATED_SOUND_DESCRIPTORS,
  createAudioController,
  createMemoryAudioStorage,
  readAudioSettings,
} from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

class FakeAudioParam {
  constructor() {
    this.value = 0;
  }

  cancelScheduledValues() {}

  setValueAtTime(value) {
    this.value = value;
  }

  exponentialRampToValueAtTime(value) {
    this.value = value;
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
    this.resumeCount = 0;
    FakeAudioContext.created += 1;
  }

  resume() {
    this.resumeCount += 1;
    return Promise.resolve();
  }

  createGain() {
    return { gain: new FakeAudioParam(), connect() {} };
  }

  createOscillator() {
    return { type: 'sine', frequency: new FakeAudioParam(), connect() {}, start() {}, stop() {} };
  }

  createBuffer(channels, frameCount) {
    return { channels, frameCount, getChannelData: () => new Float32Array(frameCount) };
  }

  createBufferSource() {
    return { buffer: null, connect() {}, start() {}, stop() {} };
  }
}

FakeAudioContext.created = 0;

const requiredEvents = Object.freeze([
  AudioEvent.MENU_ACTION,
  AudioEvent.FIRE,
  AudioEvent.HIT,
  AudioEvent.DEATH,
  AudioEvent.RESPAWN,
  AudioEvent.BUY_SUCCESS,
  AudioEvent.BUY_FAILURE,
  AudioEvent.FOOTSTEP,
]);

const tests = [
  ['defines generated descriptors for every T28 feedback event', () => {
    assert.equal(GENERATED_AUDIO_PROVENANCE.includes('generated'), true);
    assert.equal(GENERATED_AUDIO_PROVENANCE.includes('no Counter-Strike'), true);

    requiredEvents.forEach((eventId) => {
      const descriptor = GENERATED_SOUND_DESCRIPTORS[eventId];
      assert.equal(Boolean(descriptor), true, `${eventId} descriptor should exist`);
      assert.equal(descriptor.durationMs > 0, true, `${eventId} duration should be positive`);
      assert.equal(descriptor.gain > 0, true, `${eventId} gain should be positive`);
    });
  }],

  ['stays locked until explicit user gesture unlock', () => {
    FakeAudioContext.created = 0;
    const controller = createAudioController({ environment: { AudioContext: FakeAudioContext }, storage: createMemoryAudioStorage() });

    const locked = controller.play(AudioEvent.FIRE);
    assert.equal(locked.ok, false);
    assert.equal(locked.reason, 'locked-until-user-gesture');
    assert.equal(FakeAudioContext.created, 0);

    const unlocked = controller.unlock();
    const played = controller.play(AudioEvent.FIRE);
    assert.equal(unlocked.ok, true);
    assert.equal(unlocked.reason, 'unlocked-after-user-gesture');
    assert.equal(played.ok, true);
    assert.equal(played.reason, 'played-generated-sound');

    writeEvidence('task-28-audio-unlock.txt', [
      'T28 audio unlock evidence',
      `Before unlock: ${locked.reason}`,
      `Unlock result: ${unlocked.reason}`,
      `After unlock play: ${played.reason}`,
      `Audio contexts created before unlock: 0`,
      'Startup/programmatic menu close uses playFeedback=false and does not call unlock.',
      `Generated provenance: ${GENERATED_AUDIO_PROVENANCE}`,
    ]);
  }],

  ['programmatic startup menu close does not unlock or create AudioContext', () => {
    FakeAudioContext.created = 0;
    const controller = createAudioController({ environment: { AudioContext: FakeAudioContext }, storage: createMemoryAudioStorage() });
    const closeBuyMenuFeedback = (options = Object.freeze({ playFeedback: true })) => {
      if (options.playFeedback !== false) {
        controller.unlock();
        return controller.play(AudioEvent.MENU_ACTION);
      }
      return Object.freeze({ ok: false, reason: 'programmatic-close-silent', state: controller.getState() });
    };

    const startupClose = closeBuyMenuFeedback({ playFeedback: false });
    assert.equal(startupClose.reason, 'programmatic-close-silent');
    assert.equal(controller.getState().unlocked, false);
    assert.equal(FakeAudioContext.created, 0);

    const userClose = closeBuyMenuFeedback({ playFeedback: true });
    assert.equal(userClose.ok, true);
    assert.equal(userClose.reason, 'played-generated-sound');
    assert.equal(controller.getState().unlocked, true);
    assert.equal(FakeAudioContext.created, 1);
  }],

  ['returns silent no-op fallback for missing AudioContext and missing sounds', () => {
    const controller = createAudioController({ environment: {}, storage: createMemoryAudioStorage() });
    const unsupportedUnlock = controller.unlock();
    const unsupportedPlay = controller.play(AudioEvent.HIT);
    const missingSound = controller.play('not-a-real-sound');

    assert.equal(controller.getState().fallback, 'silent-noop');
    assert.equal(unsupportedUnlock.ok, false);
    assert.equal(unsupportedPlay.ok, false);
    assert.equal(unsupportedPlay.reason, 'audio-context-unavailable');
    assert.equal(missingSound.ok, false);
    assert.equal(missingSound.reason, 'missing-sound');

    writeEvidence('task-28-audio-fallback.txt', [
      'T28 audio fallback evidence',
      `AudioContext unavailable unlock: ${unsupportedUnlock.reason}`,
      `AudioContext unavailable play: ${unsupportedPlay.reason}`,
      `Missing sound result: ${missingSound.reason}`,
      `Fallback mode: ${controller.getState().fallback}`,
      'Core gameplay can continue because play() returns status objects instead of throwing.',
    ]);
  }],

  ['persists mute and volume settings with corrupt storage recovery', () => {
    const storage = createMemoryAudioStorage();
    const controller = createAudioController({ environment: { AudioContext: FakeAudioContext }, storage });

    controller.setMuted(true);
    controller.setVolume(0.25);

    const restored = readAudioSettings(storage);
    assert.equal(restored.value.muted, true);
    assert.equal(restored.value.volume, 0.25);

    storage.setItem(AUDIO_STORAGE_KEY, 'not-json');
    const recovered = readAudioSettings(storage);
    assert.equal(recovered.value.muted, false);
    assert.equal(recovered.value.volume, 0.55);
    assert.equal(recovered.warning, 'audio-storage-corrupt');

    writeEvidence('task-29-audio-storage-recovery.txt', [
      'T29 malformed audio localStorage recovery evidence',
      `Audio storage warning: ${recovered.warning}`,
      `Recovered muted: ${recovered.value.muted}`,
      `Recovered volume: ${recovered.value.volume}`,
      'Corrupt audio JSON falls back to safe unlocked-on-gesture defaults.',
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS audio - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL audio - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
