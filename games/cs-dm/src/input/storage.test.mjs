import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDefaultBindingMap } from './bindings.js';
import { DEFAULT_MOUSE_SETTINGS } from './settings.js';
import { INPUT_STORAGE_KEY, INPUT_STORAGE_SCHEMA_VERSION, readInputSettings, readStoredMouseSettings, writeStoredMouseSettings } from './storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const createStorageStub = (initialValues = Object.create(null)) => ({
  values: { ...initialValues },
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null;
  },
  setItem(key, value) {
    this.values[key] = value;
  },
});

const tests = [
  ['defaults mouse settings when old stored input settings have no mouse object', () => {
    const storage = createStorageStub({
      [INPUT_STORAGE_KEY]: JSON.stringify({
        version: INPUT_STORAGE_SCHEMA_VERSION,
        playerName: 'Legacy',
        bindings: createDefaultBindingMap(),
      }),
    });

    const settings = readInputSettings(storage);
    const mouseSettings = readStoredMouseSettings(storage);

    assert.equal(settings.warning, null);
    assert.deepEqual(settings.value.mouse, DEFAULT_MOUSE_SETTINGS);
    assert.deepEqual(mouseSettings.value, DEFAULT_MOUSE_SETTINGS);
  }],

  ['persists normalized mouse sensitivity and invert settings', () => {
    const storage = createStorageStub();

    assert.equal(writeStoredMouseSettings(storage, { sensitivity: 9, invertY: false }), true);
    const mouseSettings = readStoredMouseSettings(storage).value;

    assert.equal(mouseSettings.sensitivity, 3);
    assert.equal(mouseSettings.invertY, false);

    writeEvidence('task-mouse-settings-storage.txt', [
      'Mouse settings storage evidence',
      `sensitivity=${mouseSettings.sensitivity}`,
      `invertY=${mouseSettings.invertY}`,
      'Old stored settings without a mouse object default safely.',
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS input storage - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL input storage - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
