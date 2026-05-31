import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatchState, createOfflineSlots } from '../core/index.js';
import { MAX_PLAYER_SLOTS, PLAYER_LIFE_STATES, SLOT_TYPES } from '../config/index.js';
import { deriveScoreboardRows } from '../ui/hudData.js';
import {
  applyRemotePlayerJoin,
  restoreBotForRemoteDisconnect,
  selectReplaceableBotSlot,
} from './slots.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const countSlots = (players, slotType) => players.filter((player) => player.slotType === slotType).length;

const initialMatchState = createMatchState({ phase: 'running', tick: 42, players: createOfflineSlots('Host') });
const selectedSlot = selectReplaceableBotSlot(initialMatchState.players);
assert.equal(selectedSlot.ok, true);
assert.notEqual(selectedSlot.slotIndex, 0);
assert.equal(selectedSlot.slotIndex, 1);

const joinResult = applyRemotePlayerJoin(initialMatchState, {
  peerId: 'peer-join-agent',
  playerName: 'join-agent',
  tick: 43,
});
assert.equal(joinResult.ok, true);
assert.equal(joinResult.matchState.players.length, MAX_PLAYER_SLOTS);
assert.equal(joinResult.slotIndex, selectedSlot.slotIndex);
assert.equal(joinResult.matchState.players[0].slotType, SLOT_TYPES.LOCAL);
assert.equal(joinResult.matchState.players[joinResult.slotIndex].slotType, SLOT_TYPES.REMOTE);
assert.equal(joinResult.matchState.players[joinResult.slotIndex].name, 'join-agent');
assert.equal(joinResult.matchState.players[joinResult.slotIndex].remote.peerId, 'peer-join-agent');
assert.equal(joinResult.matchState.players[joinResult.slotIndex].handoff.replacementToken, selectedSlot.player.bot.handoff.replacementToken);
assert.equal(countSlots(joinResult.matchState.players, SLOT_TYPES.REMOTE), 1);
assert.equal(countSlots(joinResult.matchState.players, SLOT_TYPES.BOT), 14);

const scoreboard = deriveScoreboardRows(joinResult.matchState.players);
assert.equal(scoreboard.length, MAX_PLAYER_SLOTS);
assert.equal(scoreboard.some((row) => row.name === 'join-agent' && row.slotType === SLOT_TYPES.REMOTE), true);

const localReplaceResult = applyRemotePlayerJoin(initialMatchState, {
  peerId: 'peer-local-attack',
  playerName: 'not-local',
  requestedSlotIndex: 0,
});
assert.equal(localReplaceResult.ok, false);
assert.equal(initialMatchState.players[0].slotType, SLOT_TYPES.LOCAL);

writeFileSync(path.join(evidenceDir, 'task-24-remote-replaces-bot.txt'), [
  'T24 remote replaces bot evidence',
  `Initial slot count: ${initialMatchState.players.length}`,
  `Selected replaceable bot slot: ${selectedSlot.slotIndex}`,
  `Local slot preserved: ${joinResult.matchState.players[0].slotType === SLOT_TYPES.LOCAL}`,
  `Slot count after join: ${joinResult.matchState.players.length}`,
  `Remote slots after join: ${countSlots(joinResult.matchState.players, SLOT_TYPES.REMOTE)}`,
  `Bot slots after join: ${countSlots(joinResult.matchState.players, SLOT_TYPES.BOT)}`,
  `Remote scoreboard name present: ${scoreboard.some((row) => row.name === 'join-agent' && row.slotType === SLOT_TYPES.REMOTE)}`,
  `Local slot replacement rejected: ${localReplaceResult.ok === false}`,
].join('\n'));

const remoteSlotIndex = joinResult.slotIndex;
const remoteRespawningPlayers = joinResult.matchState.players.map((player, index) => index === remoteSlotIndex
  ? Object.freeze({
    ...player,
    lifeState: PLAYER_LIFE_STATES.RESPAWNING,
    health: 0,
    armor: 12,
    respawnAtMs: 5000,
    score: Object.freeze({ kills: 3, deaths: 2 }),
    loadout: Object.freeze({ ...player.loadout, activeWeaponId: 'm4a1' }),
  })
  : player);
const remoteRespawningMatchState = Object.freeze({ ...joinResult.matchState, tick: 44, players: Object.freeze(remoteRespawningPlayers) });
const restoreResult = restoreBotForRemoteDisconnect(remoteRespawningMatchState, {
  peerId: 'peer-join-agent',
  tick: 45,
});
assert.equal(restoreResult.ok, true);
assert.equal(restoreResult.matchState.players.length, MAX_PLAYER_SLOTS);
assert.equal(restoreResult.slotIndex, remoteSlotIndex);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].slotType, SLOT_TYPES.BOT);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].name, selectedSlot.player.name);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].lifeState, PLAYER_LIFE_STATES.RESPAWNING);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].health, 0);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].armor, 12);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].respawnAtMs, 5000);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].score.kills, 3);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].loadout.activeWeaponId, 'm4a1');
assert.equal(restoreResult.matchState.players[remoteSlotIndex].bot.handoff.canBeReplacedByRemote, true);
assert.equal(restoreResult.matchState.players[remoteSlotIndex].bot.handoff.handoffTick, 45);
assert.equal(countSlots(restoreResult.matchState.players, SLOT_TYPES.REMOTE), 0);
assert.equal(countSlots(restoreResult.matchState.players, SLOT_TYPES.BOT), 15);

writeFileSync(path.join(evidenceDir, 'task-24-disconnect-bot.txt'), [
  'T24 remote disconnect restores bot evidence',
  `Remote slot index: ${remoteSlotIndex}`,
  `Slot count after disconnect restore: ${restoreResult.matchState.players.length}`,
  `Restored slot type: ${restoreResult.matchState.players[remoteSlotIndex].slotType}`,
  `Same slot restored: ${restoreResult.slotIndex === remoteSlotIndex}`,
  `Remote slots after restore: ${countSlots(restoreResult.matchState.players, SLOT_TYPES.REMOTE)}`,
  `Bot slots after restore: ${countSlots(restoreResult.matchState.players, SLOT_TYPES.BOT)}`,
  'Reset behavior: bot identity/name/runtime contract are recreated for the same slot; score, loadout, lifeState, health, armor, respawnAtMs, spawnId, and faction are preserved from the remote slot.',
  `Respawning state preserved: ${restoreResult.matchState.players[remoteSlotIndex].lifeState === PLAYER_LIFE_STATES.RESPAWNING}`,
].join('\n'));
