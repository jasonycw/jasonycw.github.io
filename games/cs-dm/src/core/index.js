import {
  DEFAULT_LOADOUT,
  COMBAT_DEFAULTS,
  FACTIONS,
  LOCAL_PLAYER_SLOT_INDEX,
  MATCH_PHASES,
  MAX_PLAYER_SLOTS,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
  SPAWN_REFERENCES,
  WEAPONS,
} from '../config/index.js';
import { createBotSlotFields, getBotNameForSlot } from '../bots/index.js';

export const PLAYER_NAME_LIMITS = Object.freeze({
  MIN_LENGTH: 1,
  MAX_LENGTH: 20,
});

export const INPUT_BUTTONS = Object.freeze({
  FORWARD: 'forward',
  BACK: 'back',
  LEFT: 'left',
  RIGHT: 'right',
  JUMP: 'jump',
  CROUCH: 'crouch',
  FIRE: 'fire',
  RELOAD: 'reload',
  BUY: 'buy',
  SCOREBOARD: 'scoreboard',
});

export const VALID_INPUT_BUTTONS = Object.freeze(Object.values(INPUT_BUTTONS));
export const VALID_WEAPON_IDS = Object.freeze(Object.values(WEAPONS).map((weapon) => weapon.id));

export const INPUT_FRAME_CONTRACT = Object.freeze({
  frame: 'integer >= 0',
  sequence: 'integer >= 0',
  buttons: 'array of input button ids',
  look: '{ yawDelta: finite number, pitchDelta: finite number }',
  activeWeaponId: 'known weapon id',
});

export const PLAYER_STATE_CONTRACT = Object.freeze({
  id: 'stable slot-scoped player id',
  slotIndex: 'integer 0..15',
  slotType: 'local | bot | remote',
  name: 'validated plain-text display name',
  faction: 'terrorists | counter-terrorists | spectator',
  lifeState: 'alive | dead | respawning',
  health: 'integer 0..100',
  armor: 'integer 0..100',
  respawnAtMs: 'null or match clock timestamp when automatic respawn completes',
  spawnProtectionUntilMs: 'match clock timestamp until damage is ignored',
  loadout: DEFAULT_LOADOUT,
  score: '{ kills: integer >= 0, deaths: integer >= 0 }',
  spawnId: 'id from SPAWN_REFERENCES',
  bot: 'present for bot slots; lifecycle/difficulty/path/combatIntent/handoff contract',
});

export const MATCH_STATE_CONTRACT = Object.freeze({
  phase: 'menu | warmup | running | paused | ended',
  tick: 'integer >= 0',
  players: 'exactly 16 player slot records',
  localSlotIndex: LOCAL_PLAYER_SLOT_INDEX,
});

export const NETWORK_SNAPSHOT_CONTRACT = Object.freeze({
  kind: 'snapshot',
  matchId: 'non-empty string',
  tick: 'integer >= 0',
  hostSlotIndex: 'integer 0..15',
  players: 'array of player snapshots, max 16',
});

const HTML_LIKE_PATTERN = /[<>&]/;
const hasControlCharacter = (value) => Array.from(value).some((character) => {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
});
const WHITESPACE_PATTERN = /\s+/g;

const success = (value) => Object.freeze({ ok: true, value, errors: Object.freeze([]) });
const failure = (errors, value = null) => Object.freeze({ ok: false, value, errors: Object.freeze(errors) });

export const isPlainRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const isIntegerInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export const normalizePlayerName = (name) => String(name ?? '').replace(WHITESPACE_PATTERN, ' ').trim();

export function validatePlayerName(name, existingNames = []) {
  const normalizedName = normalizePlayerName(name);
  const errors = [];

  if (normalizedName.length < PLAYER_NAME_LIMITS.MIN_LENGTH) {
    errors.push('Player name is required.');
  }

  if (normalizedName.length > PLAYER_NAME_LIMITS.MAX_LENGTH) {
    errors.push(`Player name must be ${PLAYER_NAME_LIMITS.MAX_LENGTH} characters or fewer.`);
  }

  if (HTML_LIKE_PATTERN.test(normalizedName) || hasControlCharacter(normalizedName)) {
    errors.push('Player name must be plain text.');
  }

  const duplicateName = existingNames.some((existingName) => normalizePlayerName(existingName).toLowerCase() === normalizedName.toLowerCase());
  if (duplicateName) {
    errors.push('Player name is already in use.');
  }

  return errors.length === 0 ? success(normalizedName) : failure(errors, normalizedName);
}

export function createPlayerState({
  id,
  slotIndex,
  slotType,
  name,
  faction = FACTIONS.TERRORISTS,
  spawnId = SPAWN_REFERENCES[slotIndex]?.id ?? SPAWN_REFERENCES[0].id,
  loadout = DEFAULT_LOADOUT,
  bot = null,
}) {
  const baseState = {
    id,
    slotIndex,
    slotType,
    name,
    faction,
    lifeState: PLAYER_LIFE_STATES.ALIVE,
    health: COMBAT_DEFAULTS.maxHealth,
    armor: 0,
    respawnAtMs: null,
    spawnProtectionUntilMs: COMBAT_DEFAULTS.spawnProtectionMs,
    loadout,
    score: Object.freeze({ kills: 0, deaths: 0 }),
    spawnId,
  };

  if (bot !== null) {
    baseState.bot = bot;
  }

  return Object.freeze(baseState);
}

export function createOfflineSlots(localPlayerName) {
  const localNameResult = validatePlayerName(localPlayerName);
  const localName = localNameResult.ok ? localNameResult.value : 'Player';

  return Object.freeze(
    Array.from({ length: MAX_PLAYER_SLOTS }, (_, slotIndex) => {
      const isLocal = slotIndex === LOCAL_PLAYER_SLOT_INDEX;
      return createPlayerState({
        id: isLocal ? 'player-local' : `bot-${String(slotIndex).padStart(2, '0')}`,
        slotIndex,
        slotType: isLocal ? SLOT_TYPES.LOCAL : SLOT_TYPES.BOT,
        name: isLocal ? localName : getBotNameForSlot(slotIndex),
        faction: slotIndex % 2 === 0 ? FACTIONS.COUNTER_TERRORISTS : FACTIONS.TERRORISTS,
        bot: isLocal ? null : createBotSlotFields({ slotIndex }).bot,
      });
    }),
  );
}

export function createMatchState({ phase = MATCH_PHASES.MENU, tick = 0, players = createOfflineSlots('Player') } = {}) {
  return Object.freeze({
    phase,
    tick,
    players,
    localSlotIndex: LOCAL_PLAYER_SLOT_INDEX,
  });
}

export function validateInputFrame(frame) {
  const errors = [];

  if (!isPlainRecord(frame)) {
    return failure(['Input frame must be an object.']);
  }

  if (!isIntegerInRange(frame.frame, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push('Input frame.frame must be a non-negative integer.');
  }

  if (!isIntegerInRange(frame.sequence, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push('Input frame.sequence must be a non-negative integer.');
  }

  if (!Array.isArray(frame.buttons) || frame.buttons.some((button) => !VALID_INPUT_BUTTONS.includes(button))) {
    errors.push('Input frame.buttons must contain only known input buttons.');
  }

  if (!isPlainRecord(frame.look) || !Number.isFinite(frame.look.yawDelta) || !Number.isFinite(frame.look.pitchDelta)) {
    errors.push('Input frame.look must contain finite yawDelta and pitchDelta values.');
  }

  if (frame.activeWeaponId !== undefined && !VALID_WEAPON_IDS.includes(frame.activeWeaponId)) {
    errors.push('Input frame.activeWeaponId must be a known weapon id.');
  }

  return errors.length === 0
    ? success(Object.freeze({
      frame: frame.frame,
      sequence: frame.sequence,
      buttons: Object.freeze([...frame.buttons]),
      look: Object.freeze({ yawDelta: frame.look.yawDelta, pitchDelta: frame.look.pitchDelta }),
      activeWeaponId: frame.activeWeaponId,
    }))
    : failure(errors);
}

export function validateNetworkSnapshot(snapshot) {
  const errors = [];

  if (!isPlainRecord(snapshot)) {
    return failure(['Network snapshot must be an object.']);
  }

  if (snapshot.kind !== 'snapshot') {
    errors.push('Network snapshot.kind must be "snapshot".');
  }

  if (typeof snapshot.matchId !== 'string' || snapshot.matchId.trim().length === 0) {
    errors.push('Network snapshot.matchId must be a non-empty string.');
  }

  if (!isIntegerInRange(snapshot.tick, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push('Network snapshot.tick must be a non-negative integer.');
  }

  if (!isIntegerInRange(snapshot.hostSlotIndex, 0, MAX_PLAYER_SLOTS - 1)) {
    errors.push('Network snapshot.hostSlotIndex must be a valid slot index.');
  }

  if (!Array.isArray(snapshot.players) || snapshot.players.length > MAX_PLAYER_SLOTS) {
    errors.push('Network snapshot.players must be an array of at most 16 players.');
  } else {
    snapshot.players.forEach((player, playerIndex) => {
      if (!isPlainRecord(player)) {
        errors.push(`Network snapshot player ${playerIndex} must be an object.`);
        return;
      }

      if (!isIntegerInRange(player.slotIndex, 0, MAX_PLAYER_SLOTS - 1)) {
        errors.push(`Network snapshot player ${playerIndex} has an invalid slotIndex.`);
      }

      if (!Object.values(SLOT_TYPES).includes(player.slotType)) {
        errors.push(`Network snapshot player ${playerIndex} has an invalid slotType.`);
      }

      if (!validatePlayerName(player.name).ok) {
        errors.push(`Network snapshot player ${playerIndex} has an invalid name.`);
      }
    });
  }

  return errors.length === 0 ? success(snapshot) : failure(errors);
}

export {
  createBotSlotFields,
  DEFAULT_LOADOUT,
  COMBAT_DEFAULTS,
  FACTIONS,
  LOCAL_PLAYER_SLOT_INDEX,
  MATCH_PHASES,
  MAX_PLAYER_SLOTS,
  PLAYER_LIFE_STATES,
  SLOT_TYPES,
  SPAWN_REFERENCES,
  WEAPONS,
};
