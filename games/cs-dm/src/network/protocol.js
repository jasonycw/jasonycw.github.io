import {
  DEFAULT_LOADOUT,
  MAX_PLAYER_SLOTS,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
  VALID_WEAPON_IDS,
  isIntegerInRange,
  isPlainRecord,
  validateInputFrame,
  validateNetworkSnapshot,
  validatePlayerName,
} from '../core/index.js';

export const NETWORK_PROTOCOL_VERSION = 1;

export const NETWORK_MESSAGE_KINDS = Object.freeze({
  JOIN_HELLO: 'join-hello',
  NAME_UPDATE: 'name-update',
  INPUT_FRAME: 'input-frame',
  HOST_SNAPSHOT: 'host-snapshot',
  DAMAGE_EVENT: 'damage-event',
  DEATH_EVENT: 'death-event',
  LOADOUT_CHANGE: 'loadout-change',
  PING: 'ping',
  LATENCY: 'latency',
  DISCONNECT: 'disconnect',
});

export const HOST_AUTHORITATIVE_REJECTION_REASONS = Object.freeze({
  INVALID_MESSAGE: 'invalid-message',
  CLIENT_STATE_MUTATION: 'client-state-mutation',
  CLIENT_SNAPSHOT: 'client-snapshot',
});

const CLIENT_ALLOWED_KINDS = Object.freeze([
  NETWORK_MESSAGE_KINDS.JOIN_HELLO,
  NETWORK_MESSAGE_KINDS.NAME_UPDATE,
  NETWORK_MESSAGE_KINDS.INPUT_FRAME,
  NETWORK_MESSAGE_KINDS.LOADOUT_CHANGE,
  NETWORK_MESSAGE_KINDS.PING,
  NETWORK_MESSAGE_KINDS.DISCONNECT,
]);

const STATE_MUTATION_FIELDS = Object.freeze([
  'health',
  'armor',
  'lifeState',
  'kills',
  'deaths',
  'score',
  'position',
  'velocity',
  'players',
  'snapshot',
  'worldState',
  'matchState',
]);

const success = (value) => Object.freeze({ ok: true, value, errors: Object.freeze([]) });
const failure = (errors, value = null) => Object.freeze({ ok: false, value, errors: Object.freeze(errors) });
const round = (value) => Number(value.toFixed(6));
const freezeVector = (vector) => Object.freeze({ x: round(vector.x), y: round(vector.y), z: round(vector.z) });
const safeString = (value) => String(value ?? '').trim();

const createMessage = (kind, payload) => Object.freeze({
  version: NETWORK_PROTOCOL_VERSION,
  kind,
  payload: Object.freeze(payload),
});

const validateProtocolEnvelope = (message, expectedKind = null) => {
  const errors = [];

  if (!isPlainRecord(message)) {
    return failure([`Protocol version ${NETWORK_PROTOCOL_VERSION} message must be an object.`]);
  }

  if (message.version !== NETWORK_PROTOCOL_VERSION) {
    errors.push(`Unsupported protocol version: expected ${NETWORK_PROTOCOL_VERSION}.`);
  }

  if (!Object.values(NETWORK_MESSAGE_KINDS).includes(message.kind)) {
    errors.push('Network message kind is not recognized.');
  }

  if (expectedKind !== null && message.kind !== expectedKind) {
    errors.push(`Network message kind must be ${expectedKind}.`);
  }

  if (!isPlainRecord(message.payload)) {
    errors.push(`Protocol version ${NETWORK_PROTOCOL_VERSION} payload must be an object.`);
  }

  return errors.length === 0 ? success(message.payload) : failure(errors);
};

const validateSlotIndex = (slotIndex, label, errors) => {
  if (!isIntegerInRange(slotIndex, 0, MAX_PLAYER_SLOTS - 1)) {
    errors.push(`${label} must be a valid slot index.`);
  }
};

const validateMatchId = (matchId, label, errors) => {
  if (safeString(matchId).length === 0) {
    errors.push(`${label} must be a non-empty string.`);
  }
};

const validateTimestamp = (value, label, errors) => {
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${label} must be a non-negative finite number.`);
  }
};

const validateOptionalReason = (reason, label, errors) => {
  if (reason !== undefined && safeString(reason).length === 0) {
    errors.push(`${label} must be a non-empty string when provided.`);
  }
};

const hasClientStateMutationFields = (payload) => STATE_MUTATION_FIELDS.some((field) => Object.hasOwn(payload, field));

export function createJoinHelloMessage({ peerId, playerName, requestedSlotIndex = null }) {
  return createMessage(NETWORK_MESSAGE_KINDS.JOIN_HELLO, { peerId, playerName, requestedSlotIndex });
}

export function createNameUpdateMessage({ peerId, playerName }) {
  return createMessage(NETWORK_MESSAGE_KINDS.NAME_UPDATE, { peerId, playerName });
}

export function createInputFrameMessage({ peerId, slotIndex, inputFrame }) {
  return createMessage(NETWORK_MESSAGE_KINDS.INPUT_FRAME, { peerId, slotIndex, inputFrame });
}

export function createHostSnapshotMessage({ snapshot }) {
  return createMessage(NETWORK_MESSAGE_KINDS.HOST_SNAPSHOT, { snapshot });
}

export function createDamageEventMessage({ matchId, tick, attackerSlotIndex, victimSlotIndex, damage, healthAfter }) {
  return createMessage(NETWORK_MESSAGE_KINDS.DAMAGE_EVENT, { matchId, tick, attackerSlotIndex, victimSlotIndex, damage, healthAfter });
}

export function createDeathEventMessage({ matchId, tick, killerSlotIndex, victimSlotIndex, weaponId }) {
  return createMessage(NETWORK_MESSAGE_KINDS.DEATH_EVENT, { matchId, tick, killerSlotIndex, victimSlotIndex, weaponId });
}

export function createLoadoutChangeMessage({ peerId, slotIndex, loadout }) {
  return createMessage(NETWORK_MESSAGE_KINDS.LOADOUT_CHANGE, { peerId, slotIndex, loadout });
}

export function createPingMessage({ peerId, sentAtMs, sequence }) {
  return createMessage(NETWORK_MESSAGE_KINDS.PING, { peerId, sentAtMs, sequence });
}

export function createLatencyMessage({ peerId, sentAtMs, receivedAtMs, latencyMs, sequence }) {
  return createMessage(NETWORK_MESSAGE_KINDS.LATENCY, { peerId, sentAtMs, receivedAtMs, latencyMs, sequence });
}

export function createDisconnectMessage({ peerId, reason = 'left' }) {
  return createMessage(NETWORK_MESSAGE_KINDS.DISCONNECT, { peerId, reason });
}

export function validateLoadoutChangePayload(payload) {
  const errors = [];
  const loadout = payload?.loadout;

  if (!isPlainRecord(payload)) {
    return failure(['Loadout change payload must be an object.']);
  }

  if (safeString(payload.peerId).length === 0) {
    errors.push('Loadout change peerId must be a non-empty string.');
  }
  validateSlotIndex(payload.slotIndex, 'Loadout change slotIndex', errors);

  if (!isPlainRecord(loadout)) {
    errors.push('Loadout change loadout must be an object.');
  } else {
    if (loadout.primaryWeaponId !== undefined && !VALID_WEAPON_IDS.includes(loadout.primaryWeaponId)) {
      errors.push('Loadout change primaryWeaponId must be a known weapon id.');
    }
    if (loadout.secondaryWeaponId !== undefined && !VALID_WEAPON_IDS.includes(loadout.secondaryWeaponId)) {
      errors.push('Loadout change secondaryWeaponId must be a known weapon id.');
    }
    if (loadout.activeWeaponId !== undefined && !VALID_WEAPON_IDS.includes(loadout.activeWeaponId)) {
      errors.push('Loadout change activeWeaponId must be a known weapon id.');
    }
    if (loadout.equipmentIds !== undefined && (!Array.isArray(loadout.equipmentIds) || loadout.equipmentIds.some((weaponId) => !VALID_WEAPON_IDS.includes(weaponId)))) {
      errors.push('Loadout change equipmentIds must contain known weapon ids.');
    }
  }

  if (hasClientStateMutationFields(payload) || (isPlainRecord(loadout) && hasClientStateMutationFields(loadout))) {
    errors.push('Loadout change cannot include health, score, position, or world state.');
  }

  return errors.length === 0 ? success(Object.freeze({
    peerId: safeString(payload.peerId),
    slotIndex: payload.slotIndex,
    loadout: Object.freeze({
      primaryWeaponId: loadout.primaryWeaponId ?? DEFAULT_LOADOUT.primaryWeaponId,
      secondaryWeaponId: loadout.secondaryWeaponId ?? DEFAULT_LOADOUT.secondaryWeaponId,
      equipmentIds: Object.freeze([...(loadout.equipmentIds ?? DEFAULT_LOADOUT.equipmentIds)]),
      activeWeaponId: loadout.activeWeaponId ?? loadout.primaryWeaponId ?? DEFAULT_LOADOUT.activeWeaponId,
    }),
  })) : failure(errors);
}

export function validateNetworkMessage(message, expectedKind = null) {
  const envelopeResult = validateProtocolEnvelope(message, expectedKind);
  if (!envelopeResult.ok) {
    return envelopeResult;
  }

  const payload = envelopeResult.value;
  const errors = [];

  switch (message.kind) {
    case NETWORK_MESSAGE_KINDS.JOIN_HELLO: {
      if (safeString(payload.peerId).length === 0) errors.push('Join hello peerId must be a non-empty string.');
      const nameResult = validatePlayerName(payload.playerName);
      if (!nameResult.ok) errors.push(...nameResult.errors);
      if (payload.requestedSlotIndex !== null) validateSlotIndex(payload.requestedSlotIndex, 'Join hello requestedSlotIndex', errors);
      break;
    }
    case NETWORK_MESSAGE_KINDS.NAME_UPDATE: {
      if (safeString(payload.peerId).length === 0) errors.push('Name update peerId must be a non-empty string.');
      const nameResult = validatePlayerName(payload.playerName);
      if (!nameResult.ok) errors.push(...nameResult.errors);
      break;
    }
    case NETWORK_MESSAGE_KINDS.INPUT_FRAME: {
      if (safeString(payload.peerId).length === 0) errors.push('Input frame peerId must be a non-empty string.');
      validateSlotIndex(payload.slotIndex, 'Input frame slotIndex', errors);
      const inputFrameResult = validateInputFrame(payload.inputFrame);
      if (!inputFrameResult.ok) errors.push(...inputFrameResult.errors);
      if (hasClientStateMutationFields(payload)) errors.push('Input frame cannot include health, score, position, or world state.');
      break;
    }
    case NETWORK_MESSAGE_KINDS.HOST_SNAPSHOT: {
      const snapshotResult = validateNetworkSnapshot(payload.snapshot);
      if (!snapshotResult.ok) errors.push(...snapshotResult.errors);
      break;
    }
    case NETWORK_MESSAGE_KINDS.DAMAGE_EVENT: {
      validateMatchId(payload.matchId, 'Damage event matchId', errors);
      if (!isIntegerInRange(payload.tick, 0, Number.MAX_SAFE_INTEGER)) errors.push('Damage event tick must be a non-negative integer.');
      validateSlotIndex(payload.attackerSlotIndex, 'Damage event attackerSlotIndex', errors);
      validateSlotIndex(payload.victimSlotIndex, 'Damage event victimSlotIndex', errors);
      if (!Number.isFinite(payload.damage) || payload.damage < 0) errors.push('Damage event damage must be a non-negative finite number.');
      if (!isIntegerInRange(payload.healthAfter, 0, 100)) errors.push('Damage event healthAfter must be an integer from 0 to 100.');
      break;
    }
    case NETWORK_MESSAGE_KINDS.DEATH_EVENT: {
      validateMatchId(payload.matchId, 'Death event matchId', errors);
      if (!isIntegerInRange(payload.tick, 0, Number.MAX_SAFE_INTEGER)) errors.push('Death event tick must be a non-negative integer.');
      validateSlotIndex(payload.killerSlotIndex, 'Death event killerSlotIndex', errors);
      validateSlotIndex(payload.victimSlotIndex, 'Death event victimSlotIndex', errors);
      if (!VALID_WEAPON_IDS.includes(payload.weaponId)) errors.push('Death event weaponId must be a known weapon id.');
      break;
    }
    case NETWORK_MESSAGE_KINDS.LOADOUT_CHANGE: {
      const loadoutResult = validateLoadoutChangePayload(payload);
      if (!loadoutResult.ok) errors.push(...loadoutResult.errors);
      break;
    }
    case NETWORK_MESSAGE_KINDS.PING: {
      if (safeString(payload.peerId).length === 0) errors.push('Ping peerId must be a non-empty string.');
      validateTimestamp(payload.sentAtMs, 'Ping sentAtMs', errors);
      if (!isIntegerInRange(payload.sequence, 0, Number.MAX_SAFE_INTEGER)) errors.push('Ping sequence must be a non-negative integer.');
      break;
    }
    case NETWORK_MESSAGE_KINDS.LATENCY: {
      if (safeString(payload.peerId).length === 0) errors.push('Latency peerId must be a non-empty string.');
      validateTimestamp(payload.sentAtMs, 'Latency sentAtMs', errors);
      validateTimestamp(payload.receivedAtMs, 'Latency receivedAtMs', errors);
      validateTimestamp(payload.latencyMs, 'Latency latencyMs', errors);
      if (!isIntegerInRange(payload.sequence, 0, Number.MAX_SAFE_INTEGER)) errors.push('Latency sequence must be a non-negative integer.');
      break;
    }
    case NETWORK_MESSAGE_KINDS.DISCONNECT: {
      if (safeString(payload.peerId).length === 0) errors.push('Disconnect peerId must be a non-empty string.');
      validateOptionalReason(payload.reason, 'Disconnect reason', errors);
      break;
    }
    default:
      errors.push('Network message kind is not recognized.');
  }

  return errors.length === 0 ? success(Object.freeze({
    version: NETWORK_PROTOCOL_VERSION,
    kind: message.kind,
    payload: Object.freeze(payload),
  })) : failure(errors);
}

export function reduceHostAuthoritativeMessage(hostState, message) {
  const messageResult = validateNetworkMessage(message);
  if (!messageResult.ok) {
    return Object.freeze({ ok: false, reason: HOST_AUTHORITATIVE_REJECTION_REASONS.INVALID_MESSAGE, hostState, errors: messageResult.errors });
  }

  if (!CLIENT_ALLOWED_KINDS.includes(message.kind)) {
    return Object.freeze({ ok: false, reason: HOST_AUTHORITATIVE_REJECTION_REASONS.CLIENT_SNAPSHOT, hostState, errors: Object.freeze(['Remote clients cannot send authoritative host snapshots or combat events.']) });
  }

  if (hasClientStateMutationFields(message.payload)) {
    return Object.freeze({ ok: false, reason: HOST_AUTHORITATIVE_REJECTION_REASONS.CLIENT_STATE_MUTATION, hostState, errors: Object.freeze(['Remote clients cannot set health, kills, positions, snapshots, or world state.']) });
  }

  switch (message.kind) {
    case NETWORK_MESSAGE_KINDS.INPUT_FRAME:
      return Object.freeze({ ok: true, hostState, action: 'remote-input', inputFrame: validateInputFrame(message.payload.inputFrame).value });
    case NETWORK_MESSAGE_KINDS.LOADOUT_CHANGE:
      return Object.freeze({ ok: true, hostState, action: 'loadout-request', loadout: validateLoadoutChangePayload(message.payload).value.loadout });
    case NETWORK_MESSAGE_KINDS.NAME_UPDATE:
      return Object.freeze({ ok: true, hostState, action: 'name-request', playerName: validatePlayerName(message.payload.playerName).value });
    case NETWORK_MESSAGE_KINDS.JOIN_HELLO:
      return Object.freeze({ ok: true, hostState, action: 'join-request', playerName: validatePlayerName(message.payload.playerName).value });
    case NETWORK_MESSAGE_KINDS.PING:
      return Object.freeze({ ok: true, hostState, action: 'ping', sentAtMs: message.payload.sentAtMs, sequence: message.payload.sequence });
    case NETWORK_MESSAGE_KINDS.DISCONNECT:
      return Object.freeze({ ok: true, hostState, action: 'disconnect', reason: message.payload.reason });
    default:
      return Object.freeze({ ok: false, reason: HOST_AUTHORITATIVE_REJECTION_REASONS.INVALID_MESSAGE, hostState, errors: Object.freeze(['Unsupported client message.']) });
  }
}

export function createSnapshotDisplayBuffer(previousSnapshot, nextSnapshot, interpolationAlpha = 0) {
  const previousResult = validateNetworkSnapshot(previousSnapshot);
  const nextResult = validateNetworkSnapshot(nextSnapshot);
  if (!previousResult.ok || !nextResult.ok) {
    return failure([...previousResult.errors, ...nextResult.errors]);
  }

  const clampedAlpha = Math.min(1, Math.max(0, interpolationAlpha));
  const previousPlayers = new Map(previousSnapshot.players.map((player) => [player.slotIndex, player]));
  const players = nextSnapshot.players.map((nextPlayer) => {
    const previousPlayer = previousPlayers.get(nextPlayer.slotIndex) ?? nextPlayer;
    const canInterpolate = isPlainRecord(previousPlayer.position) && isPlainRecord(nextPlayer.position)
      && Number.isFinite(previousPlayer.position.x) && Number.isFinite(previousPlayer.position.y) && Number.isFinite(previousPlayer.position.z)
      && Number.isFinite(nextPlayer.position.x) && Number.isFinite(nextPlayer.position.y) && Number.isFinite(nextPlayer.position.z);
    const position = canInterpolate
      ? freezeVector({
        x: previousPlayer.position.x + (nextPlayer.position.x - previousPlayer.position.x) * clampedAlpha,
        y: previousPlayer.position.y + (nextPlayer.position.y - previousPlayer.position.y) * clampedAlpha,
        z: previousPlayer.position.z + (nextPlayer.position.z - previousPlayer.position.z) * clampedAlpha,
      })
      : isPlainRecord(nextPlayer.position) && Number.isFinite(nextPlayer.position.x) && Number.isFinite(nextPlayer.position.y) && Number.isFinite(nextPlayer.position.z)
        ? freezeVector(nextPlayer.position)
        : freezeVector({ x: 0, y: 0, z: 0 });

    return Object.freeze({
      slotIndex: nextPlayer.slotIndex,
      slotType: nextPlayer.slotType ?? SLOT_TYPES.REMOTE,
      name: validatePlayerName(nextPlayer.name).ok ? validatePlayerName(nextPlayer.name).value : `Player ${nextPlayer.slotIndex + 1}`,
      lifeState: Object.values(PLAYER_LIFE_STATES).includes(nextPlayer.lifeState) ? nextPlayer.lifeState : PLAYER_LIFE_STATES.DEAD,
      position,
      yaw: Number.isFinite(nextPlayer.yaw) ? round(nextPlayer.yaw) : 0,
      activeWeaponId: VALID_WEAPON_IDS.includes(nextPlayer.activeWeaponId) ? nextPlayer.activeWeaponId : DEFAULT_LOADOUT.activeWeaponId,
      health: isIntegerInRange(nextPlayer.health, 0, 100) ? nextPlayer.health : 0,
      armor: isIntegerInRange(nextPlayer.armor, 0, 100) ? nextPlayer.armor : 0,
      score: Object.freeze({
        kills: isIntegerInRange(nextPlayer.score?.kills, 0, Number.MAX_SAFE_INTEGER) ? nextPlayer.score.kills : 0,
        deaths: isIntegerInRange(nextPlayer.score?.deaths, 0, Number.MAX_SAFE_INTEGER) ? nextPlayer.score.deaths : 0,
      }),
    });
  });

  return success(Object.freeze({
    matchId: nextSnapshot.matchId,
    tick: nextSnapshot.tick,
    alpha: clampedAlpha,
    players: Object.freeze(players),
  }));
}
