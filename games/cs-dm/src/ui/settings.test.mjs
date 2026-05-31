import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { InputAction, createDefaultBindingMap, getLiveBindingCandidates, writeStoredKeybindings, readStoredKeybindings } from '../input/index.js';
import { getBindingChangeResult, getBindingLabel, hasBindingConflict, normalizeBindingMap } from './settings.js';

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
