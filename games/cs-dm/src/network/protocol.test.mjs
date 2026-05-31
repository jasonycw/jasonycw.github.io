import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INPUT_BUTTONS, SLOT_TYPES, createOfflineSlots, createMatchState } from '../core/index.js';
import {
  HOST_AUTHORITATIVE_REJECTION_REASONS,
  NETWORK_MESSAGE_KINDS,
  NETWORK_PROTOCOL_VERSION,
  createDamageEventMessage,
  createDeathEventMessage,
  createDisconnectMessage,
  createHostSnapshotMessage,
  createInputFrameMessage,
  createJoinHelloMessage,
  createLatencyMessage,
  createLoadoutChangeMessage,
  createNameUpdateMessage,
  createPingMessage,
  createSnapshotDisplayBuffer,
  reduceHostAuthoritativeMessage,
  validateNetworkMessage,
} from './protocol.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const inputFrame = Object.freeze({
  frame: 12,
  sequence: 4,
  buttons: Object.freeze([INPUT_BUTTONS.FORWARD, INPUT_BUTTONS.FIRE]),
  look: Object.freeze({ yawDelta: 2, pitchDelta: -1 }),
  activeWeaponId: 'ak47',
});

const snapshot = Object.freeze({
  kind: 'snapshot',
  matchId: 'match-1',
  tick: 20,
  hostSlotIndex: 0,
  players: Object.freeze([
    Object.freeze({
      slotIndex: 1,
      slotType: SLOT_TYPES.REMOTE,
      name: 'Remote One',
      lifeState: 'alive',
      health: 75,
      armor: 20,
      score: Object.freeze({ kills: 2, deaths: 1 }),
      activeWeaponId: 'ak47',
      position: Object.freeze({ x: 2, y: 0, z: 4 }),
      yaw: 0.5,
    }),
  ]),
});

const messages = Object.freeze([
  createJoinHelloMessage({ peerId: 'peer-a', playerName: 'Remote One' }),
  createNameUpdateMessage({ peerId: 'peer-a', playerName: 'Remote Two' }),
  createInputFrameMessage({ peerId: 'peer-a', slotIndex: 1, inputFrame }),
  createHostSnapshotMessage({ snapshot }),
  createDamageEventMessage({ matchId: 'match-1', tick: 22, attackerSlotIndex: 0, victimSlotIndex: 1, damage: 25, healthAfter: 75 }),
  createDeathEventMessage({ matchId: 'match-1', tick: 23, killerSlotIndex: 0, victimSlotIndex: 1, weaponId: 'ak47' }),
  createLoadoutChangeMessage({ peerId: 'peer-a', slotIndex: 1, loadout: { primaryWeaponId: 'm4a1', secondaryWeaponId: 'glock18', equipmentIds: ['knife'], activeWeaponId: 'm4a1' } }),
  createPingMessage({ peerId: 'peer-a', sentAtMs: 1000, sequence: 1 }),
  createLatencyMessage({ peerId: 'peer-a', sentAtMs: 1000, receivedAtMs: 1040, latencyMs: 40, sequence: 1 }),
  createDisconnectMessage({ peerId: 'peer-a', reason: 'left' }),
]);

assert.equal(messages.length, Object.values(NETWORK_MESSAGE_KINDS).length);
for (const message of messages) {
  assert.equal(message.version, NETWORK_PROTOCOL_VERSION);
  assert.equal(validateNetworkMessage(message).ok, true, `${message.kind} should validate`);
}

const versionResult = validateNetworkMessage({ ...messages[0], version: NETWORK_PROTOCOL_VERSION + 1 });
assert.equal(versionResult.ok, false);
assert.equal(versionResult.errors.some((error) => error.includes('Unsupported protocol version')), true);

const malformedResult = validateNetworkMessage(createInputFrameMessage({ peerId: 'peer-a', slotIndex: 1, inputFrame: { ...inputFrame, buttons: ['teleport'] } }));
assert.equal(malformedResult.ok, false);
assert.equal(malformedResult.errors.some((error) => error.includes('Input frame.buttons')), true);

writeFileSync(path.join(evidenceDir, 'task-23-message-version.txt'), [
  'T23 protocol message/version evidence',
  `Protocol version: ${NETWORK_PROTOCOL_VERSION}`,
  `Message kinds validated: ${messages.map((message) => message.kind).join(', ')}`,
  `Unknown version rejected: ${versionResult.errors[0]}`,
  `Malformed input rejected: ${malformedResult.errors[0]}`,
].join('\n'));

const hostState = createMatchState({ phase: 'running', tick: 10, players: createOfflineSlots('Host') });
const inputReduce = reduceHostAuthoritativeMessage(hostState, createInputFrameMessage({ peerId: 'peer-a', slotIndex: 1, inputFrame }));
assert.equal(inputReduce.ok, true);
assert.equal(inputReduce.action, 'remote-input');
assert.deepEqual(inputReduce.inputFrame.buttons, inputFrame.buttons);
assert.equal(inputReduce.hostState, hostState);

const loadoutReduce = reduceHostAuthoritativeMessage(hostState, createLoadoutChangeMessage({
  peerId: 'peer-a',
  slotIndex: 1,
  loadout: { primaryWeaponId: 'm4a1', secondaryWeaponId: 'glock18', equipmentIds: ['knife'], activeWeaponId: 'm4a1' },
}));
assert.equal(loadoutReduce.ok, true);
assert.equal(loadoutReduce.action, 'loadout-request');
assert.equal(loadoutReduce.loadout.activeWeaponId, 'm4a1');

const mutationReduce = reduceHostAuthoritativeMessage(hostState, {
  version: NETWORK_PROTOCOL_VERSION,
  kind: NETWORK_MESSAGE_KINDS.INPUT_FRAME,
  payload: { peerId: 'peer-a', slotIndex: 1, inputFrame, health: 100, score: { kills: 99, deaths: 0 }, position: { x: 999, y: 0, z: 999 } },
});
assert.equal(mutationReduce.ok, false);
assert.equal(mutationReduce.reason, HOST_AUTHORITATIVE_REJECTION_REASONS.INVALID_MESSAGE);
assert.equal(hostState.players[1].health, 100);
assert.equal(hostState.players[1].score.kills, 0);

const snapshotReduce = reduceHostAuthoritativeMessage(hostState, createHostSnapshotMessage({ snapshot }));
assert.equal(snapshotReduce.ok, false);
assert.equal(snapshotReduce.reason, HOST_AUTHORITATIVE_REJECTION_REASONS.CLIENT_SNAPSHOT);

writeFileSync(path.join(evidenceDir, 'task-23-authoritative-host.txt'), [
  'T23 host-authoritative reducer evidence',
  `Remote input accepted action: ${inputReduce.action}`,
  `Remote loadout accepted action: ${loadoutReduce.action}`,
  `Client health/score/position mutation rejected: ${mutationReduce.ok === false}`,
  `Client snapshot rejected reason: ${snapshotReduce.reason}`,
  `Host state identity preserved: ${inputReduce.hostState === hostState}`,
].join('\n'));

const previousSnapshot = Object.freeze({
  ...snapshot,
  tick: 20,
  players: Object.freeze([
    Object.freeze({ ...snapshot.players[0], position: Object.freeze({ x: 0, y: 0, z: 0 }) }),
  ]),
});
const nextSnapshot = Object.freeze({
  ...snapshot,
  tick: 22,
  players: Object.freeze([
    Object.freeze({ ...snapshot.players[0], position: Object.freeze({ x: 10, y: 0, z: 20 }), yaw: 1 }),
  ]),
});
const displayResult = createSnapshotDisplayBuffer(previousSnapshot, nextSnapshot, 0.25);
assert.equal(displayResult.ok, true);
assert.deepEqual(displayResult.value.players[0].position, { x: 2.5, y: 0, z: 5 });
assert.equal(displayResult.value.players[0].health, 75);
assert.equal(displayResult.value.players[0].score.kills, 2);
