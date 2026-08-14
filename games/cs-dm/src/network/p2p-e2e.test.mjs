import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INPUT_BUTTONS, createMatchState, createOfflineSlots } from '../core/index.js';
import { MAX_PLAYER_SLOTS, SLOT_TYPES } from '../config/index.js';
import { deriveScoreboardRows } from '../ui/hudData.js';
import {
  NETWORK_FAILURE_REASONS,
  NETWORK_RECOVERY_ACTIONS,
  NETWORK_STATES,
  createDeterministicManualAdapter,
  createManualCodeFailureState,
  createRemoteDisconnectFallback,
} from './index.js';
import {
  createHostSnapshotMessage,
  createInputFrameMessage,
  createJoinHelloMessage,
  createNameUpdateMessage,
  createSnapshotDisplayBuffer,
  reduceHostAuthoritativeMessage,
} from './protocol.js';
import { applyRemotePlayerJoin } from './slots.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '..', '..');
const repoRoot = path.resolve(gameRoot, '..', '..');
const evidenceDir = path.join(repoRoot, '.sisyphus', 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const countSlots = (players, slotType) => players.filter((player) => player.slotType === slotType).length;
const readRepoText = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

const host = createDeterministicManualAdapter({ sessionId: 't35-local-context' });
const joiner = createDeterministicManualAdapter();
const offerCode = await host.createOffer({ playerName: 'HostT35' });
const answerResult = await joiner.createAnswer(offerCode, { playerName: 'JoinerT35' });
assert.equal(answerResult.ok, true);
const acceptResult = await host.acceptAnswer(answerResult.value);
assert.equal(acceptResult.ok, true);
assert.equal(host.getState(), NETWORK_STATES.CONNECTED);
assert.equal(joiner.getState(), NETWORK_STATES.ANSWER_READY);

const hostMatch = createMatchState({ phase: 'running', tick: 350, players: createOfflineSlots('HostT35') });
const joinMessage = createJoinHelloMessage({ peerId: 'peer-t35', playerName: 'JoinerT35' });
const joinReduce = reduceHostAuthoritativeMessage(hostMatch, joinMessage);
assert.equal(joinReduce.ok, true);
assert.equal(joinReduce.action, 'join-request');
const joinResult = applyRemotePlayerJoin(hostMatch, {
  peerId: 'peer-t35',
  playerName: joinReduce.playerName,
  tick: 351,
});
assert.equal(joinResult.ok, true);
assert.equal(joinResult.matchState.players.length, MAX_PLAYER_SLOTS);
assert.equal(joinResult.matchState.players[joinResult.slotIndex].slotType, SLOT_TYPES.REMOTE);
assert.equal(countSlots(joinResult.matchState.players, SLOT_TYPES.REMOTE), 1);
assert.equal(countSlots(joinResult.matchState.players, SLOT_TYPES.BOT), MAX_PLAYER_SLOTS - 2);

const nameReduce = reduceHostAuthoritativeMessage(joinResult.matchState, createNameUpdateMessage({
  peerId: 'peer-t35',
  playerName: 'RenamedT35',
}));
assert.equal(nameReduce.ok, true);
assert.equal(nameReduce.action, 'name-request');
assert.equal(nameReduce.playerName, 'RenamedT35');

const inputFrame = Object.freeze({
  frame: 44,
  sequence: 7,
  buttons: Object.freeze([INPUT_BUTTONS.FORWARD, INPUT_BUTTONS.RIGHT, INPUT_BUTTONS.FIRE]),
  look: Object.freeze({ yawDelta: 1.5, pitchDelta: -0.25 }),
  activeWeaponId: 'ak47',
});
const inputReduce = reduceHostAuthoritativeMessage(joinResult.matchState, createInputFrameMessage({
  peerId: 'peer-t35',
  slotIndex: joinResult.slotIndex,
  inputFrame,
}));
assert.equal(inputReduce.ok, true);
assert.equal(inputReduce.action, 'remote-input');
assert.deepEqual(inputReduce.inputFrame.buttons, inputFrame.buttons);
assert.equal(inputReduce.inputFrame.sequence, 7);

const previousSnapshot = Object.freeze({
  kind: 'snapshot',
  matchId: 't35-match',
  tick: 351,
  hostSlotIndex: 0,
  players: Object.freeze([
    Object.freeze({
      slotIndex: joinResult.slotIndex,
      slotType: SLOT_TYPES.REMOTE,
      name: 'JoinerT35',
      lifeState: 'alive',
      health: 100,
      armor: 0,
      score: Object.freeze({ kills: 0, deaths: 0 }),
      activeWeaponId: 'ak47',
      position: Object.freeze({ x: 0, y: 0, z: 0 }),
      yaw: 0,
    }),
  ]),
});
const nextSnapshot = Object.freeze({
  ...previousSnapshot,
  tick: 352,
  players: Object.freeze([
    Object.freeze({
      ...previousSnapshot.players[0],
      name: 'RenamedT35',
      position: Object.freeze({ x: 4, y: 0, z: 8 }),
      yaw: 0.5,
      score: Object.freeze({ kills: 1, deaths: 0 }),
    }),
  ]),
});
const snapshotReduce = reduceHostAuthoritativeMessage(joinResult.matchState, createHostSnapshotMessage({ snapshot: nextSnapshot }));
assert.equal(snapshotReduce.ok, false);
const displayResult = createSnapshotDisplayBuffer(previousSnapshot, nextSnapshot, 0.5);
assert.equal(displayResult.ok, true);
assert.deepEqual(displayResult.value.players[0].position, { x: 2, y: 0, z: 4 });
assert.equal(displayResult.value.players[0].name, 'RenamedT35');
assert.equal(displayResult.value.players[0].score.kills, 1);

const scoreboardBeforeDisconnect = deriveScoreboardRows(joinResult.matchState.players);
assert.equal(scoreboardBeforeDisconnect.length, MAX_PLAYER_SLOTS);
assert.equal(scoreboardBeforeDisconnect.some((row) => row.name === 'JoinerT35' && row.slotType === SLOT_TYPES.REMOTE), true);

const disconnectFallback = createRemoteDisconnectFallback(joinResult.matchState, {
  peerId: 'peer-t35',
  tick: 360,
});
assert.equal(disconnectFallback.ok, true);
assert.equal(disconnectFallback.reason, NETWORK_FAILURE_REASONS.DISCONNECT);
assert.equal(disconnectFallback.slotIndex, joinResult.slotIndex);
assert.equal(disconnectFallback.matchState.players.length, MAX_PLAYER_SLOTS);
assert.equal(disconnectFallback.matchState.players[joinResult.slotIndex].slotType, SLOT_TYPES.BOT);
assert.equal(countSlots(disconnectFallback.matchState.players, SLOT_TYPES.REMOTE), 0);
assert.equal(countSlots(disconnectFallback.matchState.players, SLOT_TYPES.BOT), MAX_PLAYER_SLOTS - 1);

const malformedResult = await createDeterministicManualAdapter().createAnswer('not-a-csdm-code', { playerName: 'BadCode' });
const malformedFailure = createManualCodeFailureState(malformedResult);
assert.equal(malformedFailure.ok, false);
assert.equal(malformedFailure.reason, NETWORK_FAILURE_REASONS.INVALID_CODE);
assert.equal(malformedFailure.recoveryAction, NETWORK_RECOVERY_ACTIONS.RETRY_CODE);

writeFileSync(path.join(evidenceDir, 'task-35-p2p-state.txt'), [
  'T35 deterministic local-context P2P QA evidence',
  'Browser tab run: not used in this deterministic Node test; no screenshot fabricated.',
  `Manual-code offer prefix: ${offerCode.slice(0, 10)}`,
  `Manual-code answer generated: ${answerResult.ok}`,
  `Host accept state: ${host.getState()}`,
  `Joiner local state after answer: ${joiner.getState()}`,
  `Remote slot index: ${joinResult.slotIndex}`,
  `Slots after join: ${joinResult.matchState.players.length}`,
  `Remote slots after join: ${countSlots(joinResult.matchState.players, SLOT_TYPES.REMOTE)}`,
  `Bot slots after join: ${countSlots(joinResult.matchState.players, SLOT_TYPES.BOT)}`,
  `Name update reduced action: ${nameReduce.action} -> ${nameReduce.playerName}`,
  `Input reduced action: ${inputReduce.action}; buttons=${inputReduce.inputFrame.buttons.join(',')}; sequence=${inputReduce.inputFrame.sequence}`,
  `Host snapshot from client rejected: ${snapshotReduce.ok === false}`,
  `Display snapshot interpolated position: ${JSON.stringify(displayResult.value.players[0].position)}`,
  `Display snapshot remote score: ${displayResult.value.players[0].score.kills}-${displayResult.value.players[0].score.deaths}`,
  `Scoreboard rows before disconnect: ${scoreboardBeforeDisconnect.length}`,
  `Remote scoreboard present before disconnect: ${scoreboardBeforeDisconnect.some((row) => row.name === 'JoinerT35' && row.slotType === SLOT_TYPES.REMOTE)}`,
  `Disconnect restored same slot: ${disconnectFallback.slotIndex === joinResult.slotIndex}`,
  `Slot type after disconnect: ${disconnectFallback.matchState.players[joinResult.slotIndex].slotType}`,
  `Remote slots after disconnect: ${countSlots(disconnectFallback.matchState.players, SLOT_TYPES.REMOTE)}`,
  `Bot slots after disconnect: ${countSlots(disconnectFallback.matchState.players, SLOT_TYPES.BOT)}`,
  `Malformed code reason: ${malformedFailure.reason}`,
  `Malformed code recovery action: ${malformedFailure.recoveryAction}`,
].join('\n'));

const readme = readRepoText('games/cs-dm/README.md');
const indexHtml = readRepoText('games/cs-dm/index.html');
const limitationChecks = Object.freeze({
  manualCode: readme.includes('manual code') && indexHtml.includes('room code'),
  bestEffort: readme.includes('best-effort') && indexHtml.includes('Private lobby'),
  localTabs: readme.includes('local tabs') && readme.includes('deterministic local-context'),
  natFirewall: readme.includes('NAT') && readme.includes('firewall') && !indexHtml.includes('NAT') && !indexHtml.includes('firewall'),
  noRelay: readme.includes('TURN server') && readme.includes('signaling broker') && !indexHtml.includes('No TURN relay or signaling broker'),
});
assert.deepEqual(Object.values(limitationChecks), [true, true, true, true, true]);
writeFileSync(path.join(evidenceDir, 'task-35-p2p-limitations.txt'), [
  'T35 P2P limitation documentation evidence',
  `README manual-code concept present: ${limitationChecks.manualCode}`,
  `README limitation retained and UI uses player-friendly lobby copy: ${limitationChecks.bestEffort}`,
  `README local-tabs/deterministic-context scope present: ${limitationChecks.localTabs}`,
  `README NAT/firewall limitation retained and removed from main UI: ${limitationChecks.natFirewall}`,
  `README no relay/signaling broker limitation retained and removed from main UI: ${limitationChecks.noRelay}`,
  'Reliability claim: deterministic local-context QA only in this test; no internet-wide P2P reliability claimed.',
].join('\n'));
