import assert from 'node:assert/strict';

import { isTextEntryElement, TEXT_ENTRY_SELECTOR } from './domGuards.js';

const createElement = ({ tagName = 'div', isContentEditable = false, closestResult = null } = {}) => ({
  tagName,
  isContentEditable,
  closest: () => closestResult,
});

const tests = [
  ['identifies text-entry targets that must ignore global hotkeys', () => {
    assert.equal(TEXT_ENTRY_SELECTOR.includes('input'), true);
    assert.equal(isTextEntryElement(createElement({ tagName: 'INPUT' })), true);
    assert.equal(isTextEntryElement(createElement({ tagName: 'textarea' })), true);
    assert.equal(isTextEntryElement(createElement({ tagName: 'select' })), true);
    assert.equal(isTextEntryElement(createElement({ isContentEditable: true })), true);
    assert.equal(isTextEntryElement(createElement({ closestResult: createElement() })), true);
  }],

  ['allows gameplay hotkeys outside text-entry targets', () => {
    assert.equal(isTextEntryElement(null), false);
    assert.equal(isTextEntryElement(createElement({ tagName: 'body' })), false);
    assert.equal(isTextEntryElement(createElement({ tagName: 'button' })), false);
    assert.equal(isTextEntryElement(createElement({ tagName: 'canvas' })), false);
  }],
];

let failures = 0;
for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS input dom guards - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL input dom guards - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
