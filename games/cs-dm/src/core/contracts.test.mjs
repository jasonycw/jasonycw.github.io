import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createMatchState,
  createOfflineSlots,
  DEFAULT_LOADOUT,
  FACTIONS,
  INPUT_BUTTONS,
  MATCH_PHASES,
  MAX_PLAYER_SLOTS,
  SLOT_TYPES,
  SPAWN_REFERENCES,
  validateInputFrame,
  validateNetworkSnapshot,
  validatePlayerName,
  WEAPONS,
} from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const validInputFrame = Object.freeze({
  frame: 42,
  sequence: 7,
  buttons: Object.freeze([INPUT_BUTTONS.FORWARD, INPUT_BUTTONS.FIRE]),
  look: Object.freeze({ yawDelta: 0.12, pitchDelta: -0.04 }),
  activeWeaponId: WEAPONS.AK47.id,
});

const validSnapshot = Object.freeze({
  kind: 'snapshot',
  matchId: 'local-test-match',
  tick: 120,
  hostSlotIndex: 0,
  players: Object.freeze([
    Object.freeze({ slotIndex: 0, slotType: SLOT_TYPES.LOCAL, name: 'Agent' }),
    Object.freeze({ slotIndex: 1, slotType: SLOT_TYPES.BOT, name: 'Bot 1' }),
    Object.freeze({ slotIndex: 2, slotType: SLOT_TYPES.REMOTE, name: 'Remote 1' }),
  ]),
});

const tests = [
  ['exports 16-slot constants and spawn references', () => {
    assert.equal(MAX_PLAYER_SLOTS, 16);
    assert.equal(SPAWN_REFERENCES.length, 16);
    assert.deepEqual(Object.values(SLOT_TYPES), ['local', 'bot', 'remote']);
    assert.equal(FACTIONS.TERRORISTS, 'terrorists');
    assert.equal(MATCH_PHASES.RUNNING, 'running');
    assert.equal(DEFAULT_LOADOUT.activeWeaponId, 'ak47');
  }],

  ['creates one local slot plus fifteen bot slots', () => {
    const slots = createOfflineSlots('test-agent');
    assert.equal(slots.length, 16);
    assert.equal(slots[0].slotType, SLOT_TYPES.LOCAL);
    assert.equal(slots.filter((slot) => slot.slotType === SLOT_TYPES.BOT).length, 15);
    assert.equal(createMatchState({ phase: MATCH_PHASES.RUNNING, players: slots }).players.length, 16);
  }],

  ['validates player names safely', () => {
    assert.equal(validatePlayerName('test-agent').ok, true);
    assert.equal(validatePlayerName('   ').ok, false);
    assert.equal(validatePlayerName('name-that-is-far-too-long').ok, false);
    assert.equal(validatePlayerName('Alpha', ['alpha']).ok, false);

    const htmlLikeName = validatePlayerName('<script>alert(1)</script>');
    assert.equal(htmlLikeName.ok, false);
    assert.equal(htmlLikeName.value.includes('<'), true);
  }],

  ['documents T29 duplicate long and HTML-like name hardening', () => {
    const duplicate = validatePlayerName(' Agent ', ['agent']);
    const longName = validatePlayerName('abcdefghijklmnopqrstu');
    const htmlLike = validatePlayerName('<b>Agent</b>');
    const normalized = validatePlayerName('  Safe   Agent  ');

    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.errors.includes('Player name is already in use.'), true);
    assert.equal(longName.ok, false);
    assert.equal(htmlLike.ok, false);
    assert.equal(normalized.ok, true);
    assert.equal(normalized.value, 'Safe Agent');

    writeEvidence('task-29-name-edge-cases.txt', [
      'T29 name edge-case evidence',
      `Duplicate accepted: ${duplicate.ok}`,
      `Long accepted: ${longName.ok}`,
      `HTML-like accepted: ${htmlLike.ok}`,
      `Whitespace normalized: ${normalized.value}`,
      'Scoreboard/render path uses textContent sinks, so accepted names render as plain text.',
    ]);
  }],

  ['validates input frames', () => {
    assert.equal(validateInputFrame(validInputFrame).ok, true);
    assert.equal(validateInputFrame({ ...validInputFrame, frame: -1 }).ok, false);
    assert.equal(validateInputFrame({ ...validInputFrame, buttons: ['teleport'] }).ok, false);
    assert.equal(validateInputFrame({ ...validInputFrame, look: { yawDelta: Infinity, pitchDelta: 0 } }).ok, false);
    assert.equal(validateInputFrame({ ...validInputFrame, activeWeaponId: 'missing' }).ok, false);
  }],

  ['validates network snapshots', () => {
    assert.equal(validateNetworkSnapshot(validSnapshot).ok, true);
    assert.equal(validateNetworkSnapshot({ ...validSnapshot, kind: 'input' }).ok, false);
    assert.equal(validateNetworkSnapshot({ ...validSnapshot, players: Array.from({ length: 17 }, (_, slotIndex) => ({ slotIndex, slotType: SLOT_TYPES.BOT, name: `Bot ${slotIndex}` })) }).ok, false);
    assert.equal(validateNetworkSnapshot({ ...validSnapshot, players: [{ slotIndex: 0, slotType: SLOT_TYPES.LOCAL, name: '<b>bad</b>' }] }).ok, false);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS core contracts - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL core contracts - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
