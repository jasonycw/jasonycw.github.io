import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INPUT_STORAGE_KEY, InputAction, createDefaultBindingMap, getLiveBindingCandidates, readInputSettings, readStoredKeybindings, readStoredPlayerName, writeStoredKeybindings } from '../input/index.js';
import { DEFAULT_MOUSE_SETTINGS, MOUSE_SENSITIVITY_RANGE, getBindingChangeResult, getBindingLabel, getConfiguredMouseLookDelta, getMouseSensitivityPercent, hasBindingConflict, normalizeBindingMap, normalizeMouseSensitivity, normalizeMouseSettings } from './settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const tests = [
  ['normalizes binding labels for key and mouse codes', () => {
    assert.equal(getBindingLabel('KeyK'), 'K');
    assert.equal(getBindingLabel('Mouse0'), 'Mouse 1');
    assert.equal(getBindingLabel('Numpad7'), 'Num 7');
  }],

  ['exports mouse settings helpers through the UI settings module', () => {
    assert.deepEqual(DEFAULT_MOUSE_SETTINGS, { sensitivity: 1, invertY: true });
    assert.deepEqual(MOUSE_SENSITIVITY_RANGE, { min: 0.25, max: 3, step: 0.05 });
    assert.equal(normalizeMouseSensitivity(99), 3);
    assert.equal(normalizeMouseSensitivity(-1), 0.25);
    assert.equal(normalizeMouseSettings({ sensitivity: '1.55', invertY: false }).sensitivity, 1.55);
    assert.equal(normalizeMouseSettings({ sensitivity: '1.55', invertY: false }).invertY, false);
    assert.equal(getMouseSensitivityPercent({ sensitivity: 1.5, invertY: true }), '150%');
  }],

  ['applies default inverted Y and sensitivity to mouse look deltas', () => {
    assert.deepEqual(getConfiguredMouseLookDelta({ yawDelta: 8, pitchDelta: 12 }), { yawDelta: -8, pitchDelta: -12 });
    assert.deepEqual(getConfiguredMouseLookDelta({ yawDelta: 8, pitchDelta: 12 }, { sensitivity: 0.5, invertY: false }), { yawDelta: -4, pitchDelta: 6 });

    writeEvidence('task-mouse-settings-normalization.txt', [
      'Mouse settings normalization evidence',
      `defaultInvertY=${DEFAULT_MOUSE_SETTINGS.invertY}`,
      `clampedMin=${normalizeMouseSensitivity(-1)}`,
      `clampedMax=${normalizeMouseSensitivity(99)}`,
      `halfSensitivityStandardY=${JSON.stringify(getConfiguredMouseLookDelta({ yawDelta: 8, pitchDelta: 12 }, { sensitivity: 0.5, invertY: false }))}`,
    ]);
  }],

  ['persists updated bindings through the storage helpers', () => {
    const localStorageStub = {
      values: Object.create(null),
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null;
      },
      setItem(key, value) {
        this.values[key] = value;
      },
    };

    const nextBindings = normalizeBindingMap(createDefaultBindingMap());
    nextBindings[InputAction.Buy] = 'KeyG';

    assert.equal(writeStoredKeybindings(localStorageStub, nextBindings), true);
    assert.equal(readStoredKeybindings(localStorageStub).value[InputAction.Buy], 'KeyG');
    assert.deepEqual(getLiveBindingCandidates(readStoredKeybindings(localStorageStub).value, InputAction.Buy), ['KeyG']);

    writeEvidence('task-20-rebind-persist.txt', [
      'T20 rebind persistence evidence',
      'Scenario: change Buy from KeyB to KeyG',
      `Stored buy binding: ${readStoredKeybindings(localStorageStub).value[InputAction.Buy]}`,
      `Live candidates: ${getLiveBindingCandidates(readStoredKeybindings(localStorageStub).value, InputAction.Buy).join(', ')}`,
      'Persistence path: storage helpers keep the updated binding after write/read',
    ]);
  }],

  ['recovers malformed input storage for player name and bindings', () => {
    const localStorageStub = {
      getItem(key) {
        return key === INPUT_STORAGE_KEY ? '{not-json' : null;
      },
      setItem() {},
    };

    const settings = readInputSettings(localStorageStub);
    const storedName = readStoredPlayerName(localStorageStub);
    const storedBindings = readStoredKeybindings(localStorageStub);

    assert.equal(settings.warning.type, 'corrupt-storage');
    assert.equal(storedName.value, '');
    assert.equal(storedName.warning.type, 'corrupt-storage');
    assert.deepEqual(storedBindings.value, createDefaultBindingMap());
    assert.equal(storedBindings.warning.type, 'corrupt-storage');

    writeEvidence('task-29-storage-recovery.txt', [
      'T29 malformed localStorage recovery evidence',
      `Input storage warning: ${settings.warning.type}`,
      `Recovered player name: ${storedName.value || '(empty default)'}`,
      `Recovered buy binding: ${storedBindings.value[InputAction.Buy]}`,
      `Recovered settings binding: ${storedBindings.value[InputAction.Settings]}`,
      'Corrupt input JSON falls back to safe defaults for player name and keybindings.',
    ]);
  }],

  ['reports duplicate critical bindings and blocks the change', () => {
    const baseBindings = createDefaultBindingMap();
    const result = getBindingChangeResult(baseBindings, InputAction.Buy, baseBindings[InputAction.Settings]);

    assert.equal(result.ok, false);
    assert.equal(result.duplicateCriticalBinding, true);
    assert.equal(hasBindingConflict(result.bindings), false);
    assert.equal(result.warnings.duplicateCriticalBindings.length > 0, true);

    writeEvidence('task-20-binding-conflict.txt', [
      'T20 binding conflict evidence',
      `Attempted Buy binding: ${baseBindings[InputAction.Settings]}`,
      `Duplicate detected: ${result.duplicateCriticalBinding}`,
      `Conflict warning count: ${result.warnings.duplicateCriticalBindings.length}`,
      'Conflict path: duplicate critical bindings are surfaced and the previous map is preserved',
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS settings - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL settings - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
