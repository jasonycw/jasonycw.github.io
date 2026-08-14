import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_PLAYER_SLOTS, SLOT_TYPES, createMatchState, createOfflineSlots } from '../core/index.js';
import {
  NETWORK_FAILURE_REASONS,
  NETWORK_RECOVERY_ACTIONS,
  NETWORK_STATES,
  createConnectionTimeoutState,
  createDeterministicManualAdapter,
  createFullRoomJoinRejection,
  createHostCloseFallback,
  createManualCodeFailureState,
  createRemoteDisconnectFallback,
} from './index.js';
import { NETWORK_PROTOCOL_VERSION, createJoinHelloMessage } from './protocol.js';
import { applyRemotePlayerJoin } from './slots.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const countSlots = (players, slotType) => players.filter((player) => player.slotType === slotType).length;

const createMatchWithRemote = () => {
  const matchState = createMatchState({ phase: 'running', tick: 100, players: createOfflineSlots('Host') });
  const joinResult = applyRemotePlayerJoin(matchState, {
    peerId: 'peer-disconnect',
    playerName: 'Remote One',
    tick: 101,
  });
  assert.equal(joinResult.ok, true);
  return joinResult;
};

const createFullRoomMatch = () => {
  let matchState = createMatchState({ phase: 'running', tick: 200, players: createOfflineSlots('Host') });
  for (let index = 1; index < MAX_PLAYER_SLOTS; index += 1) {
    const joinResult = applyRemotePlayerJoin(matchState, {
      peerId: `peer-${index}`,
      playerName: `Remote ${index}`,
      tick: 200 + index,
    });
    assert.equal(joinResult.ok, true);
    matchState = joinResult.matchState;
  }
  assert.equal(matchState.players.length, MAX_PLAYER_SLOTS);
  assert.equal(countSlots(matchState.players, SLOT_TYPES.REMOTE), MAX_PLAYER_SLOTS - 1);
  assert.equal(countSlots(matchState.players, SLOT_TYPES.BOT), 0);
  return matchState;
};

const retryJoiner = createDeterministicManualAdapter();
const invalidCodeResult = await retryJoiner.createAnswer('invalid-manual-code', { playerName: 'Joiner' });
const invalidFailure = createManualCodeFailureState(invalidCodeResult);
assert.equal(invalidFailure.ok, false);
assert.equal(invalidFailure.reason, NETWORK_FAILURE_REASONS.INVALID_CODE);
assert.equal(invalidFailure.recoveryAction, NETWORK_RECOVERY_ACTIONS.RETRY_CODE);

const host = createDeterministicManualAdapter({ sessionId: 'retry-session' });
const retryOffer = await host.createOffer({ playerName: 'Host' });
const retryResult = await retryJoiner.createAnswer(retryOffer, { playerName: 'Joiner' });
assert.equal(retryResult.ok, true);
assert.equal(retryJoiner.getState(), NETWORK_STATES.ANSWER_READY);

const timeoutState = createConnectionTimeoutState();
assert.equal(timeoutState.ok, false);
assert.equal(timeoutState.state, NETWORK_STATES.TIMEOUT);
assert.equal(timeoutState.reason, NETWORK_FAILURE_REASONS.TIMEOUT);
assert.equal(timeoutState.recoveryAction, NETWORK_RECOVERY_ACTIONS.REGENERATE_CODE);

const versionMismatchMessage = {
  ...createJoinHelloMessage({ peerId: 'peer-version', playerName: 'Versioned' }),
  version: NETWORK_PROTOCOL_VERSION + 1,
};
const versionMismatch = createFullRoomJoinRejection(createMatchState({ phase: 'running', players: createOfflineSlots('Host') }), versionMismatchMessage);
assert.equal(versionMismatch.ok, false);
assert.equal(versionMismatch.reason, NETWORK_FAILURE_REASONS.VERSION_MISMATCH);
assert.equal(versionMismatch.recoveryAction, NETWORK_RECOVERY_ACTIONS.RETRY_CODE);

const fullRoomMatch = createFullRoomMatch();
const fullRoomRejection = createFullRoomJoinRejection(fullRoomMatch, createJoinHelloMessage({ peerId: 'peer-full', playerName: 'Late Joiner' }));
assert.equal(fullRoomRejection.ok, false);
assert.equal(fullRoomRejection.reason, NETWORK_FAILURE_REASONS.FULL_ROOM);
assert.equal(fullRoomRejection.matchState.players.length, MAX_PLAYER_SLOTS);
assert.equal(countSlots(fullRoomRejection.matchState.players, SLOT_TYPES.REMOTE), MAX_PLAYER_SLOTS - 1);
assert.equal(fullRoomRejection.recoveryAction, NETWORK_RECOVERY_ACTIONS.RETURN_TO_MENU);

writeFileSync(path.join(evidenceDir, 'task-26-full-room.txt'), [
  'T26 full-room rejection evidence',
  `Slots before rejected join: ${fullRoomMatch.players.length}`,
  `Remote slots before rejected join: ${countSlots(fullRoomMatch.players, SLOT_TYPES.REMOTE)}`,
  `Bot slots before rejected join: ${countSlots(fullRoomMatch.players, SLOT_TYPES.BOT)}`,
  `Rejected reason: ${fullRoomRejection.reason}`,
  `Recovery action: ${fullRoomRejection.recoveryAction}`,
  `Slots after rejection: ${fullRoomRejection.matchState.players.length}`,
].join('\n'));

const disconnectJoin = createMatchWithRemote();
const disconnectFallback = createRemoteDisconnectFallback(disconnectJoin.matchState, {
  peerId: 'peer-disconnect',
  tick: 110,
});
assert.equal(disconnectFallback.ok, true);
assert.equal(disconnectFallback.reason, NETWORK_FAILURE_REASONS.DISCONNECT);
assert.equal(disconnectFallback.matchState.players.length, MAX_PLAYER_SLOTS);
assert.equal(disconnectFallback.slotIndex, disconnectJoin.slotIndex);
assert.equal(disconnectFallback.matchState.players[disconnectJoin.slotIndex].slotType, SLOT_TYPES.BOT);
assert.equal(countSlots(disconnectFallback.matchState.players, SLOT_TYPES.BOT), MAX_PLAYER_SLOTS - 1);
assert.equal(countSlots(disconnectFallback.matchState.players, SLOT_TYPES.REMOTE), 0);
assert.equal(disconnectFallback.recoveryAction, NETWORK_RECOVERY_ACTIONS.RESET_TO_OFFLINE_BOTS);

const hostCloseJoin = createMatchWithRemote();
const hostCloseFallback = createHostCloseFallback(hostCloseJoin.matchState, {
  peerId: 'peer-disconnect',
  tick: 120,
});
assert.equal(hostCloseFallback.ok, true);
assert.equal(hostCloseFallback.reason, NETWORK_FAILURE_REASONS.HOST_CLOSE);
assert.equal(hostCloseFallback.matchState.players.length, MAX_PLAYER_SLOTS);
assert.equal(hostCloseFallback.matchState.players[hostCloseJoin.slotIndex].slotType, SLOT_TYPES.BOT);
assert.equal(countSlots(hostCloseFallback.matchState.players, SLOT_TYPES.BOT), MAX_PLAYER_SLOTS - 1);
assert.equal(countSlots(hostCloseFallback.matchState.players, SLOT_TYPES.REMOTE), 0);

writeFileSync(path.join(evidenceDir, 'task-26-host-close.txt'), [
  'T26 host-close/disconnect fallback evidence',
  `Invalid manual code reason: ${invalidFailure.reason}`,
  `Invalid manual code retry action: ${invalidFailure.recoveryAction}`,
  `Retry after invalid code state: ${retryJoiner.getState()}`,
  `Timeout state: ${timeoutState.state}`,
  `Version mismatch reason: ${versionMismatch.reason}`,
  `Disconnect fallback slots: ${disconnectFallback.matchState.players.length}`,
  `Disconnect restored slot type: ${disconnectFallback.matchState.players[disconnectJoin.slotIndex].slotType}`,
  `Host close fallback slots: ${hostCloseFallback.matchState.players.length}`,
  `Host close restored slot type: ${hostCloseFallback.matchState.players[hostCloseJoin.slotIndex].slotType}`,
  `Bot fallback preserves 16 slots: ${hostCloseFallback.matchState.players.length === MAX_PLAYER_SLOTS}`,
].join('\n'));
