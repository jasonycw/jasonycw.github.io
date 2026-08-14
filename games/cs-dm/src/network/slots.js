import {
  LOCAL_PLAYER_SLOT_INDEX,
  MAX_PLAYER_SLOTS,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
} from '../config/index.js';
import { createBotSlotFields, getBotNameForSlot } from '../bots/index.js';
import { isIntegerInRange, validatePlayerName } from '../core/index.js';

export const REMOTE_SLOT_ERRORS = Object.freeze({
  INVALID_MATCH: 'invalid-match',
  INVALID_PEER: 'invalid-peer',
  INVALID_NAME: 'invalid-name',
  NO_REPLACEABLE_BOT: 'no-replaceable-bot',
  REMOTE_NOT_FOUND: 'remote-not-found',
});

const success = (value) => Object.freeze({ ok: true, ...value, errors: Object.freeze([]) });
const failure = (reason, errors = []) => Object.freeze({ ok: false, reason, errors: Object.freeze(errors) });
const cloneLoadout = (loadout) => Object.freeze({
  primaryWeaponId: loadout.primaryWeaponId,
  secondaryWeaponId: loadout.secondaryWeaponId,
  equipmentIds: Object.freeze([...(loadout.equipmentIds ?? [])]),
  activeWeaponId: loadout.activeWeaponId,
});
const cloneScore = (score = {}) => Object.freeze({ kills: score.kills ?? 0, deaths: score.deaths ?? 0 });
const hasExactSlotCount = (players) => Array.isArray(players) && players.length === MAX_PLAYER_SLOTS;
const getTick = (matchState, fallbackTick) => fallbackTick ?? matchState?.tick ?? 0;
const getRemotePeerId = (player) => player.remote?.peerId ?? player.handoff?.reservedForRemotePeerId ?? null;

const createRemoteHandoff = ({ sourceBot, peerId, slotIndex, tick }) => Object.freeze({
  canBeReplacedByRemote: false,
  reservedForRemotePeerId: peerId,
  replacementToken: sourceBot?.handoff?.replacementToken ?? `bot-slot-${String(slotIndex).padStart(2, '0')}`,
  replacedByRemoteSlotId: slotIndex,
  handoffTick: tick,
});

const createRestoredBotHandoff = ({ sourceRemote, slotIndex, tick }) => Object.freeze({
  canBeReplacedByRemote: true,
  reservedForRemotePeerId: null,
  replacementToken: sourceRemote.handoff?.replacementToken ?? `bot-slot-${String(slotIndex).padStart(2, '0')}`,
  replacedByRemoteSlotId: sourceRemote.slotIndex,
  handoffTick: tick,
});

export function selectReplaceableBotSlot(players, { requestedSlotIndex = null, peerId = null } = {}) {
  if (!hasExactSlotCount(players)) {
    return failure(REMOTE_SLOT_ERRORS.INVALID_MATCH, [`Match must contain exactly ${MAX_PLAYER_SLOTS} slots.`]);
  }

  const isReplaceable = (player) => player.slotIndex !== LOCAL_PLAYER_SLOT_INDEX
    && player.slotType === SLOT_TYPES.BOT
    && player.bot?.handoff?.canBeReplacedByRemote === true
    && (player.bot.handoff.reservedForRemotePeerId === null || player.bot.handoff.reservedForRemotePeerId === peerId);

  if (requestedSlotIndex !== null) {
    if (!isIntegerInRange(requestedSlotIndex, 1, MAX_PLAYER_SLOTS - 1)) {
      return failure(REMOTE_SLOT_ERRORS.NO_REPLACEABLE_BOT, ['Requested remote slot must be a replaceable bot slot and cannot be the local slot.']);
    }

    const requestedSlot = players[requestedSlotIndex];
    return requestedSlot && isReplaceable(requestedSlot)
      ? success({ slotIndex: requestedSlotIndex, player: requestedSlot })
      : failure(REMOTE_SLOT_ERRORS.NO_REPLACEABLE_BOT, ['Requested remote slot is not replaceable.']);
  }

  const selected = players.find(isReplaceable);
  return selected
    ? success({ slotIndex: selected.slotIndex, player: selected })
    : failure(REMOTE_SLOT_ERRORS.NO_REPLACEABLE_BOT, ['No bot slot is available for remote replacement.']);
}

export function applyRemotePlayerJoin(matchState, { peerId, playerName, requestedSlotIndex = null, tick = null } = {}) {
  if (!hasExactSlotCount(matchState?.players)) {
    return failure(REMOTE_SLOT_ERRORS.INVALID_MATCH, [`Match must contain exactly ${MAX_PLAYER_SLOTS} slots.`]);
  }

  const normalizedPeerId = String(peerId ?? '').trim();
  if (normalizedPeerId.length === 0) {
    return failure(REMOTE_SLOT_ERRORS.INVALID_PEER, ['Remote peer id is required.']);
  }

  const selectedSlotResult = selectReplaceableBotSlot(matchState.players, { requestedSlotIndex, peerId: normalizedPeerId });
  if (!selectedSlotResult.ok) {
    return selectedSlotResult;
  }

  const existingNames = matchState.players
    .filter((player) => player.slotIndex !== selectedSlotResult.slotIndex)
    .map((player) => player.name);
  const nameResult = validatePlayerName(playerName, existingNames);
  if (!nameResult.ok) {
    return failure(REMOTE_SLOT_ERRORS.INVALID_NAME, nameResult.errors);
  }

  const slotIndex = selectedSlotResult.slotIndex;
  const sourceBot = selectedSlotResult.player;
  const handoffTick = getTick(matchState, tick);
  const remotePlayer = Object.freeze({
    ...sourceBot,
    id: `remote-${normalizedPeerId}`,
    slotType: SLOT_TYPES.REMOTE,
    name: nameResult.value,
    bot: undefined,
    remote: Object.freeze({ peerId: normalizedPeerId, joinedAtTick: handoffTick }),
    handoff: createRemoteHandoff({ sourceBot: sourceBot.bot, peerId: normalizedPeerId, slotIndex, tick: handoffTick }),
    loadout: cloneLoadout(sourceBot.loadout),
    score: cloneScore(sourceBot.score),
  });
  const players = Object.freeze(matchState.players.map((player, index) => index === slotIndex ? remotePlayer : player));

  return success({
    matchState: Object.freeze({ ...matchState, players }),
    slotIndex,
    remotePlayer,
    replacedBotName: sourceBot.name,
  });
}

export function restoreBotForRemoteDisconnect(matchState, { peerId, slotIndex = null, tick = null } = {}) {
  if (!hasExactSlotCount(matchState?.players)) {
    return failure(REMOTE_SLOT_ERRORS.INVALID_MATCH, [`Match must contain exactly ${MAX_PLAYER_SLOTS} slots.`]);
  }

  const normalizedPeerId = String(peerId ?? '').trim();
  const remoteSlotIndex = slotIndex ?? matchState.players.findIndex((player) => player.slotType === SLOT_TYPES.REMOTE && getRemotePeerId(player) === normalizedPeerId);
  if (!isIntegerInRange(remoteSlotIndex, 1, MAX_PLAYER_SLOTS - 1)) {
    return failure(REMOTE_SLOT_ERRORS.REMOTE_NOT_FOUND, ['Remote peer slot was not found or attempted to restore the local slot.']);
  }

  const sourceRemote = matchState.players[remoteSlotIndex];
  if (sourceRemote.slotType !== SLOT_TYPES.REMOTE || (normalizedPeerId.length > 0 && getRemotePeerId(sourceRemote) !== normalizedPeerId)) {
    return failure(REMOTE_SLOT_ERRORS.REMOTE_NOT_FOUND, ['Remote peer slot was not found.']);
  }

  const restoredBotFields = createBotSlotFields({ slotIndex: remoteSlotIndex }).bot;
  const handoffTick = getTick(matchState, tick);
  const bot = Object.freeze({
    ...restoredBotFields,
    state: sourceRemote.lifeState === PLAYER_LIFE_STATES.ALIVE ? restoredBotFields.state : PLAYER_LIFE_STATES.RESPAWNING,
    handoff: createRestoredBotHandoff({ sourceRemote, slotIndex: remoteSlotIndex, tick: handoffTick }),
  });
  const restoredBot = Object.freeze({
    ...sourceRemote,
    id: `bot-${String(remoteSlotIndex).padStart(2, '0')}`,
    slotType: SLOT_TYPES.BOT,
    name: getBotNameForSlot(remoteSlotIndex),
    bot,
    remote: undefined,
    handoff: undefined,
    loadout: cloneLoadout(sourceRemote.loadout),
    score: cloneScore(sourceRemote.score),
  });
  const players = Object.freeze(matchState.players.map((player, index) => index === remoteSlotIndex ? restoredBot : player));

  return success({
    matchState: Object.freeze({ ...matchState, players }),
    slotIndex: remoteSlotIndex,
    restoredBot,
  });
}
