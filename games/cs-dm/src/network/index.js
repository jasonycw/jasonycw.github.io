import { MAX_PLAYER_SLOTS } from '../config/index.js';
import {
  NETWORK_MESSAGE_KINDS,
  NETWORK_PROTOCOL_VERSION,
  validateNetworkMessage,
} from './protocol.js';
import {
  REMOTE_SLOT_ERRORS,
  applyRemotePlayerJoin,
  restoreBotForRemoteDisconnect,
  selectReplaceableBotSlot,
} from './slots.js';

export const networkReady = true;

export * from './protocol.js';
export * from './slots.js';

export const MANUAL_CODE_VERSION = 1;
export const MANUAL_CODE_PREFIX = 'CSDM';

export const NETWORK_STATES = Object.freeze({
  IDLE: 'idle',
  OFFER_READY: 'offer-ready',
  ANSWER_READY: 'answer-ready',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  TIMEOUT: 'timeout',
  ERROR: 'error',
});

export const NETWORK_FAILURE_REASONS = Object.freeze({
  INVALID_CODE: 'invalid-code',
  TIMEOUT: 'timeout',
  FULL_ROOM: 'full-room',
  DISCONNECT: 'disconnect',
  HOST_CLOSE: 'host-close',
  VERSION_MISMATCH: 'version-mismatch',
});

export const NETWORK_RECOVERY_ACTIONS = Object.freeze({
  RETRY_CODE: 'retry-code',
  REGENERATE_CODE: 'regenerate-code',
  RESET_TO_OFFLINE_BOTS: 'reset-to-offline-bots',
  RETURN_TO_MENU: 'return-to-menu',
});

const success = (value) => Object.freeze({ ok: true, value, errors: Object.freeze([]) });
const failure = (errors, value = null) => Object.freeze({ ok: false, value, errors: Object.freeze(errors) });

const asErrors = (errors) => Object.freeze(Array.isArray(errors) ? errors : [String(errors)]);

const createFailureState = ({ reason, state = NETWORK_STATES.ERROR, errors, recoveryAction, matchState = null, slotIndex = null }) => Object.freeze({
  ok: false,
  state,
  reason,
  errors: asErrors(errors),
  recoveryAction,
  matchState,
  slotIndex,
});

const createRecoveredState = ({ reason, state = NETWORK_STATES.DISCONNECTED, message, recoveryAction, matchState, slotIndex }) => Object.freeze({
  ok: true,
  state,
  reason,
  errors: Object.freeze([]),
  message,
  recoveryAction,
  matchState,
  slotIndex,
});

const getProtocolFailureReason = (errors) => errors.some((error) => error.includes(`Unsupported protocol version: expected ${NETWORK_PROTOCOL_VERSION}.`))
  ? NETWORK_FAILURE_REASONS.VERSION_MISMATCH
  : NETWORK_FAILURE_REASONS.INVALID_CODE;

const getTextEncoder = () => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder();
  }

  return null;
};

const getTextDecoder = () => {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder();
  }

  return null;
};

const encodeBase64Url = (value) => {
  if (typeof btoa === 'function') {
    const bytes = getTextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  return Buffer.from(value, 'utf8').toString('base64url');
};

const decodeBase64Url = (value) => {
  if (typeof atob === 'function') {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return getTextDecoder().decode(bytes);
  }

  return Buffer.from(value, 'base64url').toString('utf8');
};

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeCode = (code) => String(code ?? '').trim();

export function encodeManualCode(kind, payload) {
  return `${MANUAL_CODE_PREFIX}:${kind}:${encodeBase64Url(JSON.stringify({ version: MANUAL_CODE_VERSION, kind, payload }))}`;
}

export function decodeManualCode(code, expectedKind = null) {
  const normalized = normalizeCode(code);
  const parts = normalized.split(':');

  if (parts.length !== 3 || parts[0] !== MANUAL_CODE_PREFIX) {
    return failure(['Manual code must start with CSDM and contain a valid payload.']);
  }

  const [, kind, encodedPayload] = parts;
  if (expectedKind !== null && kind !== expectedKind) {
    return failure([`Manual code must be a ${expectedKind} code.`]);
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload));
    if (parsed.version !== MANUAL_CODE_VERSION || parsed.kind !== kind || parsed.payload === null || typeof parsed.payload !== 'object') {
      return failure(['Manual code payload is not recognized.']);
    }

    return success(Object.freeze({ kind, payload: Object.freeze(parsed.payload) }));
  } catch {
    return failure(['Manual code payload could not be decoded.']);
  }
}

export function createManualCodeFailureState(result) {
  return result.ok
    ? Object.freeze({ ok: true, state: NETWORK_STATES.IDLE, reason: null, errors: Object.freeze([]), recoveryAction: null })
    : createFailureState({
      reason: NETWORK_FAILURE_REASONS.INVALID_CODE,
      errors: result.errors,
      recoveryAction: NETWORK_RECOVERY_ACTIONS.RETRY_CODE,
    });
}

export function createConnectionTimeoutState({ message = 'P2P connection timed out. Check the manual code, NAT, firewall, or retry offline bots.' } = {}) {
  return createFailureState({
    reason: NETWORK_FAILURE_REASONS.TIMEOUT,
    state: NETWORK_STATES.TIMEOUT,
    errors: [message],
    recoveryAction: NETWORK_RECOVERY_ACTIONS.REGENERATE_CODE,
  });
}

export function createFullRoomJoinRejection(matchState, joinHelloMessage) {
  const messageResult = validateNetworkMessage(joinHelloMessage, NETWORK_MESSAGE_KINDS.JOIN_HELLO);
  if (!messageResult.ok) {
    return createFailureState({
      reason: getProtocolFailureReason(messageResult.errors),
      errors: messageResult.errors,
      recoveryAction: NETWORK_RECOVERY_ACTIONS.RETRY_CODE,
    });
  }

  const selectionResult = selectReplaceableBotSlot(matchState?.players, {
    requestedSlotIndex: messageResult.value.payload.requestedSlotIndex,
    peerId: messageResult.value.payload.peerId,
  });
  if (!selectionResult.ok && selectionResult.reason === REMOTE_SLOT_ERRORS.NO_REPLACEABLE_BOT) {
    return createFailureState({
      reason: NETWORK_FAILURE_REASONS.FULL_ROOM,
      errors: [`Room is full: all ${MAX_PLAYER_SLOTS} slots are occupied and no replaceable bot is available.`],
      recoveryAction: NETWORK_RECOVERY_ACTIONS.RETURN_TO_MENU,
      matchState,
    });
  }

  const joinResult = applyRemotePlayerJoin(matchState, {
    peerId: messageResult.value.payload.peerId,
    playerName: messageResult.value.payload.playerName,
    requestedSlotIndex: messageResult.value.payload.requestedSlotIndex,
  });
  return joinResult.ok
    ? Object.freeze({ ok: true, state: NETWORK_STATES.CONNECTED, reason: null, errors: Object.freeze([]), recoveryAction: null, matchState: joinResult.matchState, slotIndex: joinResult.slotIndex })
    : createFailureState({ reason: NETWORK_FAILURE_REASONS.FULL_ROOM, errors: joinResult.errors, recoveryAction: NETWORK_RECOVERY_ACTIONS.RETURN_TO_MENU, matchState });
}

export function createRemoteDisconnectFallback(matchState, { peerId, slotIndex = null, tick = null, reason = NETWORK_FAILURE_REASONS.DISCONNECT } = {}) {
  const restoreResult = restoreBotForRemoteDisconnect(matchState, { peerId, slotIndex, tick });
  if (!restoreResult.ok) {
    return createFailureState({
      reason,
      errors: restoreResult.errors,
      recoveryAction: NETWORK_RECOVERY_ACTIONS.RESET_TO_OFFLINE_BOTS,
      matchState,
    });
  }

  return createRecoveredState({
    reason,
    message: 'Remote player disconnected; bot fallback restored the same slot.',
    recoveryAction: NETWORK_RECOVERY_ACTIONS.RESET_TO_OFFLINE_BOTS,
    matchState: restoreResult.matchState,
    slotIndex: restoreResult.slotIndex,
  });
}

export function createHostCloseFallback(matchState, { peerId, slotIndex = null, tick = null } = {}) {
  return createRemoteDisconnectFallback(matchState, { peerId, slotIndex, tick, reason: NETWORK_FAILURE_REASONS.HOST_CLOSE });
}

const hasNativeWebRtc = () => typeof RTCPeerConnection === 'function' && typeof RTCSessionDescription === 'function';

const waitForIceGathering = (connection) => new Promise((resolve) => {
  if (connection.iceGatheringState === 'complete') {
    resolve();
    return;
  }

  const timeout = setTimeout(() => {
    connection.removeEventListener('icegatheringstatechange', handleChange);
    resolve();
  }, 2000);

  function handleChange() {
    if (connection.iceGatheringState === 'complete') {
      clearTimeout(timeout);
      connection.removeEventListener('icegatheringstatechange', handleChange);
      resolve();
    }
  }

  connection.addEventListener('icegatheringstatechange', handleChange);
});

export function createDeterministicManualAdapter({ sessionId = createSessionId() } = {}) {
  let state = NETWORK_STATES.IDLE;
  let localOffer = null;
  let remoteOffer = null;
  let localAnswer = null;

  return {
    getState() {
      return state;
    },
    async createOffer({ playerName = 'Host' } = {}) {
      localOffer = Object.freeze({ mode: 'deterministic', sessionId, playerName });
      state = NETWORK_STATES.OFFER_READY;
      return encodeManualCode('offer', localOffer);
    },
    async createAnswer(offerCode, { playerName = 'Joiner' } = {}) {
      const offerResult = decodeManualCode(offerCode, 'offer');
      if (!offerResult.ok) {
        state = NETWORK_STATES.ERROR;
        return offerResult;
      }

      remoteOffer = offerResult.value.payload;
      localAnswer = Object.freeze({ mode: 'deterministic', sessionId: remoteOffer.sessionId, playerName });
      state = NETWORK_STATES.ANSWER_READY;
      return success(encodeManualCode('answer', localAnswer));
    },
    async acceptAnswer(answerCode) {
      const answerResult = decodeManualCode(answerCode, 'answer');
      if (!answerResult.ok) {
        state = NETWORK_STATES.ERROR;
        return answerResult;
      }

      if (!localOffer || answerResult.value.payload.sessionId !== localOffer.sessionId) {
        state = NETWORK_STATES.ERROR;
        return failure(['Answer code does not match this host offer.']);
      }

      state = NETWORK_STATES.CONNECTED;
      return success(state);
    },
  };
}

export function createBrowserManualWebRtcAdapter({ connectionFactory = () => new RTCPeerConnection() } = {}) {
  if (!hasNativeWebRtc()) {
    return createDeterministicManualAdapter();
  }

  let state = NETWORK_STATES.IDLE;
  let connection = null;

  const setConnection = () => {
    connection = connectionFactory();
    connection.addEventListener('connectionstatechange', () => {
      if (connection.connectionState === 'connected') {
        state = NETWORK_STATES.CONNECTED;
      }
    });
    return connection;
  };

  return {
    getState() {
      return state;
    },
    async createOffer({ playerName = 'Host' } = {}) {
      const peer = setConnection();
      peer.createDataChannel('cs-dm');
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer);
      state = NETWORK_STATES.OFFER_READY;
      return encodeManualCode('offer', { mode: 'webrtc', playerName, description: peer.localDescription.toJSON() });
    },
    async createAnswer(offerCode, { playerName = 'Joiner' } = {}) {
      const offerResult = decodeManualCode(offerCode, 'offer');
      if (!offerResult.ok) {
        state = NETWORK_STATES.ERROR;
        return offerResult;
      }

      const peer = setConnection();
      await peer.setRemoteDescription(new RTCSessionDescription(offerResult.value.payload.description));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIceGathering(peer);
      state = NETWORK_STATES.ANSWER_READY;
      return success(encodeManualCode('answer', { mode: 'webrtc', playerName, description: peer.localDescription.toJSON() }));
    },
    async acceptAnswer(answerCode) {
      const answerResult = decodeManualCode(answerCode, 'answer');
      if (!answerResult.ok) {
        state = NETWORK_STATES.ERROR;
        return answerResult;
      }

      if (!connection) {
        state = NETWORK_STATES.ERROR;
        return failure(['Create a host offer before accepting an answer.']);
      }

      state = NETWORK_STATES.CONNECTING;
      await connection.setRemoteDescription(new RTCSessionDescription(answerResult.value.payload.description));
      return success(state);
    },
  };
}
