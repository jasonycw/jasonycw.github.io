import { INPUT_BUTTONS, validatePlayerName } from './core/index.js';
import { getWeaponById } from './config/index.js';
import { AudioEvent, createAudioController } from './audio/index.js';
import { OFFLINE_TICK_RATE, advanceOfflineMatchTick, buyOfflineWeapon, createOfflineMatch, deriveOfflineMatchHud, reloadOfflineWeapon, summarizeOfflinePerformance, switchOfflineWeaponSlot } from './gameplay/index.js';
import { DEFAULT_MOUSE_SETTINGS, InputAction, createDefaultBindingMap, getConfiguredMouseLookDelta, getLiveBindingCandidates, getMouseSensitivityPercent, normalizeMouseSettings, readStoredKeybindings, readStoredMouseSettings, readStoredPlayerName, writeStoredKeybindings, writeStoredMouseSettings, writeStoredPlayerName } from './input/index.js';
import { isTextEntryElement } from './input/domGuards.js';
import { getBindingChangeResult, getBindingLabel, hasBindingConflict } from './input/settings.js';
import { NETWORK_STATES, createBrowserManualWebRtcAdapter, createManualCodeFailureState } from './network/index.js';
import { createRendererShell } from './render/index.js';
import {
  createBuyMenuController,
  setFieldError,
  setInputValue,
  setPanelVisibility,
  setTextContent,
} from './ui/index.js';

const playerNameInput = document.getElementById('player-name');
const offlineStartButton = document.getElementById('offline-start');
const hostGameButton = document.getElementById('host-game');
const joinGameButton = document.getElementById('join-game');
const openSettingsButton = document.getElementById('open-settings');
const nameError = document.getElementById('name-error');
const menuPanel = document.querySelector('[data-shell-panel="menu"]');
const settingsPanel = document.querySelector('[data-shell-panel="settings"]');
const hostPanel = document.getElementById('host-panel');
const joinPanel = document.getElementById('join-panel');
const matchPanel = document.getElementById('match-panel');
const settingsCloseButton = document.getElementById('settings-close');
const settingsResetDefaultsButton = document.getElementById('settings-reset-defaults');
const settingsApplyNameButton = document.getElementById('settings-apply-name');
const settingsPlayerNameInput = document.getElementById('settings-player-name');
const settingsNameError = document.getElementById('settings-name-error');
const bindingConflict = document.getElementById('binding-conflict');
const bindingList = document.getElementById('binding-list');
const mouseSensitivity = document.getElementById('mouse-sensitivity');
const mouseSensitivityValue = document.getElementById('mouse-sensitivity-value');
const mouseInvertY = document.getElementById('mouse-invert-y');
const mouseStatus = document.getElementById('mouse-status');
const hostOfferCode = document.getElementById('host-offer-code');
const hostCreateOfferButton = document.getElementById('host-create-offer');
const hostBackButton = document.getElementById('host-back');
const hostAnswerInput = document.getElementById('host-answer-input');
const hostAcceptAnswerButton = document.getElementById('accept-answer') ?? document.getElementById('host-accept-answer');
const joinOfferInput = document.getElementById('join-offer-input');
const joinCreateAnswerButton = document.getElementById('create-answer') ?? document.getElementById('join-create-answer');
const joinBackButton = document.getElementById('join-back');
const joinAnswerCode = document.getElementById('join-answer-code');
const networkPanel = document.getElementById('network-panel');
const networkError = document.getElementById('network-error');
const networkState = document.querySelector('[data-network-state]');
const matchPlayerNameInput = document.getElementById('match-player-name');
const matchNameError = document.getElementById('match-name-error');
const matchApplyNameButton = document.getElementById('match-apply-name');
const matchBackButton = document.getElementById('match-back');
const matchOpenSettingsButton = document.getElementById('match-open-settings');
const gameCanvas = document.getElementById('game-canvas');
const pointerLockHelp = document.getElementById('pointer-lock-help');
const webglError = document.getElementById('webgl-error');
const buyMenu = document.getElementById('buy-menu');
const buyCategories = document.getElementById('buy-categories');
const buyWeapons = document.getElementById('buy-weapons');
const buyError = document.getElementById('buy-error');
const hudWeapon = document.getElementById('hud-weapon');
const hudHealth = document.getElementById('hud-health');
const hudArmor = document.getElementById('hud-armor');
const hudPhase = document.getElementById('hud-phase');
const hudRadar = document.getElementById('hud-radar');
const hudKillfeed = document.getElementById('hud-killfeed');
const hudScoreboardBody = document.getElementById('scoreboard-body');
const scoreboardPanel = document.querySelector('.scoreboard');
const openBuyMenuButton = document.getElementById('open-buy-menu');
const buyCloseButton = document.getElementById('buy-close');
const perfSummary = document.getElementById('perf-summary');
const audioMuteToggle = document.getElementById('audio-mute-toggle');
const audioVolume = document.getElementById('audio-volume');
const audioStatus = document.getElementById('audio-status');
const matchAudioToggle = document.getElementById('match-audio-toggle');
const matchStageNotice = document.getElementById('match-stage-notice');
const matchStageKillcam = document.getElementById('match-stage-killcam');
const matchStageHitmarker = document.querySelector('.match-stage__hitmarker');

const mainButtons = [offlineStartButton, hostGameButton, joinGameButton];
const panelMap = {
  menu: menuPanel,
  settings: settingsPanel,
  host: hostPanel,
  join: joinPanel,
  match: matchPanel,
};

const setShellMode = (mode) => {
  document.body.dataset.gameMode = mode;
};

const setInGameSettingsOpen = (open) => {
  document.body.classList.toggle('in-game-settings-open', open);
  if (open) {
    settingsPanel.hidden = false;
    settingsPanel.setAttribute('aria-hidden', 'false');
    return;
  }

  if (settingsReturnPanel === 'match') {
    settingsPanel.hidden = true;
    settingsPanel.setAttribute('aria-hidden', 'true');
  }
};

let rendererShell = null;
let selectedLoadout = null;
let offlineMatchState = null;
let offlineMatchTimer = null;
let currentBindings = createDefaultBindingMap();
let currentMouseSettings = { ...DEFAULT_MOUSE_SETTINGS };
let activeBindingAction = null;
let settingsReturnPanel = 'menu';
let hostNetworkAdapter = createBrowserManualWebRtcAdapter();
let joinNetworkAdapter = createBrowserManualWebRtcAdapter();
let lastFootstepAt = 0;
let pressedMovementButtons = new Set();
let pendingLookDelta = { yawDelta: 0, pitchDelta: 0 };
let localFireQueued = false;
let localAltFireQueued = false;
let localJumpQueued = false;
let localReloadQueued = false;
let lastLocalShotRegistered = false;
let suppressNextCanvasClick = false;
let killfeedEntries = [];

const SCOREBOARD_FACTION_LABELS = Object.freeze({
  terrorists: 'Terrorists',
  'counter-terrorists': 'Counter-Terrorists',
});

const SCOREBOARD_FACTION_ORDER = Object.freeze(['terrorists', 'counter-terrorists']);

const MOVEMENT_ACTION_BUTTONS = Object.freeze({
  [InputAction.MoveForward]: INPUT_BUTTONS.FORWARD,
  [InputAction.MoveBack]: INPUT_BUTTONS.BACK,
  [InputAction.MoveLeft]: INPUT_BUTTONS.LEFT,
  [InputAction.MoveRight]: INPUT_BUTTONS.RIGHT,
  [InputAction.Jump]: INPUT_BUTTONS.JUMP,
  [InputAction.Crouch]: INPUT_BUTTONS.CROUCH,
});


const audioController = createAudioController();

const getEventCode = (event) => event.code || (typeof event.key === 'string' && event.key.length === 1 ? `Key${event.key.toUpperCase()}` : event.key);

const getDigitSlotIdForEvent = (event) => {
  const code = getEventCode(event);
  if (event.code === 'Digit1' || code === 'Digit1' || event.key === '1') return 'primary';
  if (event.code === 'Digit2' || code === 'Digit2' || event.key === '2') return 'secondary';
  if (event.code === 'Digit3' || code === 'Digit3' || event.key === '3') return 'knife';
  return null;
};

const isReloadEvent = (event) => event.code === 'KeyR' || getEventCode(event) === 'KeyR' || String(event.key ?? '').toLowerCase() === 'r';

const isBindingEventForAction = (event, action) => getLiveBindingCandidates(currentBindings, action).includes(getEventCode(event));

const getMovementButtonForEvent = (event) => Object.entries(MOVEMENT_ACTION_BUTTONS)
  .find(([action]) => isBindingEventForAction(event, action))?.[1] ?? null;

const syncAudioControls = () => {
  const state = audioController.getState();
  const label = state.muted || state.volume <= 0 ? 'Audio: Muted' : 'Audio: On';
  setTextContent(audioMuteToggle, label);
  setTextContent(matchAudioToggle, label);
  audioMuteToggle.setAttribute('aria-pressed', String(state.muted));
  matchAudioToggle.setAttribute('aria-pressed', String(state.muted));
  audioVolume.value = String(state.volume);
  setTextContent(audioStatus, state.supported
    ? `${state.unlocked ? 'Unlocked' : 'Locked until user gesture'} · generated tones · volume ${Math.round(state.volume * 100)}%`
    : 'Silent fallback active because Web Audio is unavailable.');
};

const playAudioEvent = async (eventId, { unlock = false } = {}) => {
  if (unlock) {
    const unlockResult = audioController.unlock();
    if (unlockResult.resumePromise) {
      await unlockResult.resumePromise.catch(() => undefined);
    }
  }
  const result = audioController.play(eventId);
  syncAudioControls();
  return result;
};

const buyMenuController = createBuyMenuController({
  menuElement: buyMenu,
  categoryListElement: buyCategories,
  weaponListElement: buyWeapons,
  errorElement: buyError,
  hudWeaponElement: hudWeapon,
  closeButton: buyCloseButton,
  onLoadoutChange(loadout, purchaseResult) {
    playAudioEvent(AudioEvent.BUY_SUCCESS, { unlock: true });
    selectedLoadout = loadout;
    if (offlineMatchState) {
      offlineMatchState = buyOfflineWeapon(offlineMatchState, purchaseResult.selectedWeapon.id).state;
      renderOfflineHud();
      syncRendererState();
    }
  },
  onPurchaseFailure() {
    playAudioEvent(AudioEvent.BUY_FAILURE, { unlock: true });
  },
  onClose(loadout, options = Object.freeze({ playFeedback: true })) {
    if (options.playFeedback !== false) {
      playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
    }
    document.body.classList.remove('buy-menu-open');
    matchPanel.focus({ preventScroll: true });
    if (options.restorePointerLock !== false && !matchPanel.hidden && document.body.dataset.gameMode === 'match') {
      rendererShell?.requestPointerLock?.();
    }
  },
});
selectedLoadout = buyMenuController.getLoadout();

const getNormalizedName = (name) => validatePlayerName(name);

const getBindingStatusMessage = () => {
  if (hasBindingConflict(currentBindings)) {
    return 'Duplicate critical bindings are blocked until the conflict is cleared.';
  }

  return '';
};

const syncBindingWarning = () => {
  setTextContent(bindingConflict, getBindingStatusMessage());
};

const syncMouseSettingsControls = () => {
  const mouseSettings = normalizeMouseSettings(currentMouseSettings);

  mouseSensitivity.value = String(mouseSettings.sensitivity);
  mouseInvertY.checked = mouseSettings.invertY;
  setTextContent(mouseSensitivityValue, getMouseSensitivityPercent(mouseSettings));
  setTextContent(mouseStatus, mouseSettings.invertY ? 'Mouse Y is inverted.' : 'Mouse Y uses standard vertical look.');
};

const applyMouseSettings = (settings) => {
  currentMouseSettings = normalizeMouseSettings(settings);
  syncMouseSettingsControls();
  writeStoredMouseSettings(undefined, currentMouseSettings);
};

const renderBindingRows = () => {
  bindingList.replaceChildren();

  Object.values(InputAction).forEach((action) => {
    const row = document.createElement('div');
    row.className = 'binding-row';
    row.dataset.bindAction = action;

    if (action === activeBindingAction) {
      row.classList.add('binding-row--listening');
    }

    const label = document.createElement('div');
    label.className = 'binding-row__label';

    const actionName = document.createElement('strong');
    actionName.textContent = action;

    const actionHint = document.createElement('span');
    actionHint.textContent = action === InputAction.Buy ? 'Open buy menu in match' : action === InputAction.Settings ? 'Open settings panel' : 'Primary gameplay action';

    label.append(actionName, actionHint);

    const current = document.createElement('span');
    current.className = 'binding-row__current';
    current.textContent = getBindingLabel(currentBindings[action]);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'binding-row__button secondary';
    button.dataset.bindAction = action;
    button.setAttribute('aria-pressed', String(action === activeBindingAction));
    button.textContent = action === activeBindingAction ? 'Press a key…' : 'Rebind';

    const status = document.createElement('span');
    status.className = 'binding-row__status';
    if (action === activeBindingAction) {
      status.classList.add('binding-row__status--listen');
      status.textContent = 'Listening';
    } else {
      status.textContent = 'Ready';
    }

    if (action === InputAction.Buy && hasBindingConflict(currentBindings)) {
      row.classList.add('binding-row--conflict');
      status.classList.add('binding-row__status--error');
      status.textContent = 'Conflict';
    }

    row.append(label, current, button, status);
    bindingList.append(row);
  });
};

const syncSettingsPanel = () => {
  setInputValue(settingsPlayerNameInput, playerNameInput.value);
  setFieldError(settingsNameError, '');
  syncMouseSettingsControls();
  syncBindingWarning();
  renderBindingRows();
};

const applyBindings = (bindings) => {
  currentBindings = bindings;
  renderBindingRows();
  syncBindingWarning();
  writeStoredKeybindings(undefined, currentBindings);
};

const beginRebind = (action) => {
  activeBindingAction = action;
  renderBindingRows();
};

const finishRebind = (code) => {
  if (!activeBindingAction) {
    return;
  }

  const result = getBindingChangeResult(currentBindings, activeBindingAction, code);
  activeBindingAction = null;
  applyBindings(result.bindings);
  if (!result.ok) {
    setTextContent(bindingConflict, 'Duplicate critical bindings are blocked until the conflict is cleared.');
  }
};

const syncMainMenuState = () => {
  const nameResult = getNormalizedName(playerNameInput.value);

  mainButtons.forEach((button) => {
    button.disabled = !nameResult.ok;
  });

  setFieldError(nameError, nameResult.ok ? '' : nameResult.errors[0]);
  if (nameResult.ok) {
    setInputValue(matchPlayerNameInput, nameResult.value);
    setTextContent(matchNameError, '');
    writeStoredPlayerName(undefined, nameResult.value);
  }

  return nameResult;
};

const showPanel = (panelName) => {
  setInGameSettingsOpen(false);
  setPanelVisibility(panelMap, panelName);
  networkPanel.hidden = panelName !== 'host' && panelName !== 'join';
  networkPanel.setAttribute('aria-hidden', String(networkPanel.hidden));
  setShellMode(panelName === 'match' ? 'match' : 'pregame');
};

const setNetworkStatus = (state, message = '') => {
  setTextContent(networkState, state);
  setFieldError(networkError, message);
};

const renderPerfSummary = () => {
  if (!perfSummary || !offlineMatchState) {
    return;
  }

  const summary = summarizeOfflinePerformance(offlineMatchState);
  setTextContent(perfSummary, `ticks=${summary.tick} simMs=${summary.nowMs} players=${summary.playerCount} botShots=${summary.botShotsFired} kills=${summary.totalKills}`);
};

const renderRadar = (radar) => {
  if (!hudRadar || !radar) {
    return;
  }

  hudRadar.replaceChildren();
  hudRadar.dataset.radarKind = radar.kind;
  radar.blocks.forEach((block) => {
    const element = document.createElement('span');
    element.className = 'match-hud__radar-block';
    element.style.left = `${block.x}%`;
    element.style.top = `${block.y}%`;
    element.style.width = `${block.width}%`;
    element.style.height = `${block.height}%`;
    hudRadar.append(element);
  });
  radar.blips.forEach((blip) => {
    const element = document.createElement('span');
    element.className = `match-hud__radar-blip match-hud__radar-blip--${blip.kind}`;
    element.style.left = `${blip.point.x}%`;
    element.style.top = `${blip.point.y}%`;
    element.dataset.radarSlot = String(blip.slotIndex);
    hudRadar.append(element);
  });
};

const createKillfeedSpan = (className, text) => {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
};

const renderKillfeed = () => {
  if (!hudKillfeed) {
    return;
  }

  hudKillfeed.replaceChildren();
  killfeedEntries.slice(0, 4).forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'match-hud__killfeed-entry';
    item.append(
      createKillfeedSpan('match-hud__killfeed-killer', entry.killer),
      createKillfeedSpan('match-hud__killfeed-weapon', entry.weapon),
      createKillfeedSpan('match-hud__killfeed-arrow', '\u25B8'),
      createKillfeedSpan('match-hud__killfeed-victim', entry.victim),
    );
    hudKillfeed.append(item);
  });
  hudKillfeed.hidden = killfeedEntries.length === 0;
};

const updateKillfeed = (previousState, nextState) => {
  if (!previousState || !nextState) {
    return;
  }

  nextState.matchState.players.forEach((player, slotIndex) => {
    const previousPlayer = previousState.matchState.players[slotIndex];
    if (previousPlayer?.lifeState !== 'respawning' && player.lifeState === 'respawning' && player.killedBySlotIndex !== null && player.killedBySlotIndex !== undefined) {
      const killer = nextState.matchState.players[player.killedBySlotIndex];
      const weaponId = killer?.loadout?.activeWeaponId;
      const weaponName = weaponId ? (getWeaponById(weaponId)?.name ?? weaponId.toUpperCase()) : 'WEAPON';
      killfeedEntries = [{ killer: killer?.name ?? 'Player', victim: player.name, weapon: weaponName }, ...killfeedEntries].slice(0, 4);
    }
  });
};

const renderOfflineHud = () => {
  if (!offlineMatchState) {
    return;
  }

  const hud = deriveOfflineMatchHud(offlineMatchState);
  const reloadLabel = hud.localPlayer.ammo.isReloading ? ' · RELOADING' : '';
  setTextContent(hudWeapon, `${hud.localPlayer.activeWeapon.hud.label}${reloadLabel}`);
  hudWeapon.dataset.weaponId = hud.localPlayer.ammo.weaponId;
  hudWeapon.dataset.clip = String(hud.localPlayer.ammo.clip);
  hudWeapon.dataset.reserve = String(hud.localPlayer.ammo.reserve);
  hudWeapon.dataset.reloading = String(hud.localPlayer.ammo.isReloading);
  setTextContent(hudHealth, String(hud.localPlayer.health));
  setTextContent(hudArmor, String(hud.localPlayer.armor));
  setTextContent(hudPhase, offlineMatchState.matchState.mode ?? hud.sessionClock.phase);
  if (matchStageNotice) {
    const localPlayer = offlineMatchState.matchState.players[offlineMatchState.matchState.localSlotIndex];
    const isProtected = localPlayer.spawnProtectionUntilMs > offlineMatchState.nowMs;
    const isDead = localPlayer.lifeState !== 'alive';
    const killer = Number.isInteger(localPlayer.killedBySlotIndex)
      ? offlineMatchState.matchState.players[localPlayer.killedBySlotIndex]
      : null;
    const respawnSeconds = Number.isFinite(localPlayer.respawnAtMs)
      ? Math.max(0, Math.ceil((localPlayer.respawnAtMs - offlineMatchState.nowMs) / 1000))
      : 0;
    setTextContent(matchStageNotice, isDead ? 'RESPAWNING' : isProtected ? 'SPAWN PROTECTED' : 'FREE FOR ALL');
    matchStageNotice.classList.toggle('match-stage__notice--protected', isProtected);
    matchStageNotice.classList.toggle('match-stage__notice--danger', isDead);
    if (matchStageKillcam) {
      matchStageKillcam.hidden = !isDead;
      setTextContent(matchStageKillcam, isDead
        ? `ELIMINATED BY ${killer?.name ?? 'UNKNOWN'} · RESPAWN IN ${respawnSeconds}s`
        : '');
    }
  }
  if (matchStageHitmarker) {
    const localShotHit = Boolean(offlineMatchState.lastLocalShot?.hit);
    matchStageHitmarker.classList.toggle('match-stage__hitmarker--active', localShotHit);
  }
  renderRadar(hud.radar);
  renderKillfeed();
  renderPerfSummary();
  hudScoreboardBody.replaceChildren();

  const groupedRows = new Map(SCOREBOARD_FACTION_ORDER.map((faction) => [faction, []]));
  hud.scoreboard.forEach((row) => {
    const factionRows = groupedRows.get(row.faction) ?? groupedRows.get('terrorists');
    factionRows.push(row);
  });

  SCOREBOARD_FACTION_ORDER.forEach((faction) => {
    const factionRows = groupedRows.get(faction) ?? [];

    factionRows.forEach((row, index) => {
      const scoreRow = document.createElement('tr');
      scoreRow.dataset.scoreboardSlot = String(row.slotIndex);
      scoreRow.classList.add(`scoreboard__row--${faction}`);
      if (index === 0) {
        scoreRow.classList.add('scoreboard__row--team-start');
        scoreRow.dataset.teamLabel = SCOREBOARD_FACTION_LABELS[faction];
      }
      if (row.slotIndex === offlineMatchState.matchState.localSlotIndex) {
        scoreRow.classList.add('scoreboard__row--local');
      }

      [
        String(index + 1),
        row.name,
        `$${offlineMatchState.matchState.players[row.slotIndex]?.money ?? 16000} / ${row.activeWeapon.hud.label}`,
        String(row.score.kills),
        String(row.score.deaths),
        row.latency.ms === null ? 'BOT' : String(row.latency.ms),
      ].forEach((value, cellIndex) => {
        const cell = document.createElement('td');
        if (cellIndex === 0 && index === 0) {
          cell.dataset.teamLabel = SCOREBOARD_FACTION_LABELS[faction];
        }
        cell.textContent = value;
        scoreRow.append(cell);
      });

      hudScoreboardBody.append(scoreRow);
    });
  });
};

const setScoreboardOpen = (open) => {
  if (!scoreboardPanel || matchPanel.hidden) {
    return;
  }

  matchPanel.classList.toggle('match-panel--scoreboard-open', open);
  scoreboardPanel.setAttribute('aria-hidden', String(!open));
};

const handleOfflineAudioFeedback = (previousState, nextState, { localInput = null } = {}) => {
  if (!previousState || !nextState) {
    return;
  }

  const previousLocalPlayer = previousState.matchState.players[previousState.matchState.localSlotIndex];
  const nextLocalPlayer = nextState.matchState.players[nextState.matchState.localSlotIndex];

  if (localInput?.fire && nextState.lastLocalShot) {
    if (matchStageHitmarker && nextState.lastLocalShot.hit) {
      matchStageHitmarker.classList.remove('match-stage__hitmarker--active');
      void matchStageHitmarker.offsetWidth;
      matchStageHitmarker.classList.add('match-stage__hitmarker--active');
    }
    playAudioEvent(AudioEvent.FIRE, { unlock: true });
    if (nextState.lastLocalShot.hit) {
      playAudioEvent(AudioEvent.HIT);
    }
  }

  if (previousLocalPlayer.lifeState !== 'respawning' && nextLocalPlayer.lifeState === 'respawning') {
    playAudioEvent(AudioEvent.DEATH);
  }

  if (previousLocalPlayer.lifeState === 'respawning' && nextLocalPlayer.lifeState === 'alive') {
    playAudioEvent(AudioEvent.RESPAWN);
  }
};

const syncRendererState = () => {
  if (!rendererShell || !offlineMatchState) {
    return;
  }

  const localController = offlineMatchState.controllersBySlotIndex?.[offlineMatchState.matchState.localSlotIndex];
  if (localController) {
    gameCanvas.dataset.localX = String(localController.position.x);
    gameCanvas.dataset.localY = String(localController.position.y);
    gameCanvas.dataset.localZ = String(localController.position.z);
    gameCanvas.dataset.localYaw = String(localController.view.yaw);
    gameCanvas.dataset.localPitch = String(localController.view.pitch);
  }
  gameCanvas.dataset.lastLocalShot = lastLocalShotRegistered ? 'true' : 'false';
  rendererShell.updateMatchState?.(offlineMatchState);
};

const consumeQueuedJumpInput = (localInput) => {
  const input = localInput ?? {};
  const jumpPressed = Boolean(input.jumpPressed) || localJumpQueued;

  if (localJumpQueued) {
    localJumpQueued = false;
  }

  if (!localInput && !jumpPressed) {
    return null;
  }

  return Object.freeze({
    ...input,
    buttons: input.buttons ?? [...pressedMovementButtons],
    look: input.look ?? pendingLookDelta,
    fire: input.fire ?? false,
    reload: input.reload ?? false,
    jumpPressed,
  });
};

const advanceOfflineMatchWithFeedback = (options = {}) => {
  const previousState = offlineMatchState;
  const localInput = consumeQueuedJumpInput(options.localInput ?? null);
  const tickOptions = Object.freeze({ ...options, localInput });
  if (localInput?.fire) {
    lastLocalShotRegistered = false;
    gameCanvas.dataset.lastLocalShot = 'false';
  }
  offlineMatchState = advanceOfflineMatchTick(offlineMatchState, tickOptions);
  updateKillfeed(previousState, offlineMatchState);
  if (localInput?.fire && offlineMatchState.lastLocalShot) {
    lastLocalShotRegistered = true;
  }
  handleOfflineAudioFeedback(previousState, offlineMatchState, tickOptions);
  const localController = offlineMatchState.controllersBySlotIndex[LOCAL_PLAYER_SLOT_INDEX];
  if (localController?.movement.grounded && pressedMovementButtons.size > 0) {
    const speed = Math.hypot(localController.velocity.x, localController.velocity.z);
    if (speed > 0.1) {
      const stepInterval = localController.movement.crouching ? 420 : 260;
      const now = Date.now();
      if (now - lastFootstepAt > stepInterval) {
        lastFootstepAt = now;
        playAudioEvent(AudioEvent.FOOTSTEP, { unlock: true });
      }
    }
  }
  renderOfflineHud();
  syncRendererState();
};

const queueOneShotOfflineInput = ({ fire = false, reload = false, altFire = false } = {}) => {
  if (!offlineMatchState) {
    return false;
  }

  localFireQueued = localFireQueued || fire;
  localAltFireQueued = localAltFireQueued || altFire;
  localReloadQueued = localReloadQueued || reload;
  return true;
};

const stopOfflineLoop = () => {
  if (offlineMatchTimer !== null) {
    window.clearInterval(offlineMatchTimer);
    offlineMatchTimer = null;
  }
};

const startOfflineLoop = () => {
  stopOfflineLoop();
  offlineMatchTimer = window.setInterval(() => {
    const localInput = (pressedMovementButtons.size > 0 || pendingLookDelta.yawDelta !== 0 || pendingLookDelta.pitchDelta !== 0 || localFireQueued || localAltFireQueued || localJumpQueued || localReloadQueued)
      ? { buttons: [...pressedMovementButtons], look: pendingLookDelta, fire: localFireQueued, altFire: localAltFireQueued, reload: localReloadQueued }
      : null;
    pendingLookDelta = { yawDelta: 0, pitchDelta: 0 };
    localFireQueued = false;
    localAltFireQueued = false;
    localReloadQueued = false;
    try {
      advanceOfflineMatchWithFeedback({ localInput });
    } catch (error) {
      stopOfflineLoop();
      setTextContent(perfSummary, `SIM ERROR: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Offline deathmatch loop stopped', error);
    }
  }, 1000 / OFFLINE_TICK_RATE);
};

const switchLocalWeaponSlot = (slotId) => {
  if (!offlineMatchState) {
    return false;
  }

  const result = switchOfflineWeaponSlot(offlineMatchState, slotId);
  if (!result.ok) {
    return false;
  }

  offlineMatchState = result.state;
  selectedLoadout = offlineMatchState.matchState.players[offlineMatchState.matchState.localSlotIndex].loadout;
  lastLocalShotRegistered = false;
  gameCanvas.dataset.lastLocalShot = 'false';
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  renderOfflineHud();
  syncRendererState();
  return true;
};

const reloadLocalWeapon = () => {
  if (!offlineMatchState) {
    return false;
  }

  const result = reloadOfflineWeapon(offlineMatchState);
  offlineMatchState = result.state;
  renderOfflineHud();
  syncRendererState();
  return result.ok;
};

const fireLocalWeaponFromPointerEvent = (event) => {
  if (!offlineMatchState) {
    return false;
  }

  if (event.button === 0) {
    event.preventDefault();
    event.stopPropagation();
    return queueOneShotOfflineInput({ fire: true });
  }

  if (event.button === 2) {
    event.preventDefault();
    event.stopPropagation();
    return queueOneShotOfflineInput({ altFire: true });
  }

  return false;
};

const openSettings = () => {
  settingsReturnPanel = matchPanel.hidden ? 'menu' : 'match';
  syncSettingsPanel();
  if (settingsReturnPanel === 'match') {
    buyMenuController.close({ playFeedback: false, restorePointerLock: false });
    document.body.classList.remove('buy-menu-open');
    setScoreboardOpen(false);
    setInGameSettingsOpen(true);
    settingsPanel.focus({ preventScroll: true });
    return;
  }

  showPanel('settings');
};

const renderHostCode = async () => {
  const nameResult = getNormalizedName(playerNameInput.value);
  if (!nameResult.ok) {
    setInputValue(hostOfferCode, '');
    setNetworkStatus(NETWORK_STATES.ERROR, nameResult.errors[0]);
    return;
  }

  setNetworkStatus(NETWORK_STATES.CONNECTING, 'Creating local offer...');
  const offerCode = await hostNetworkAdapter.createOffer({ playerName: nameResult.value });
  setInputValue(hostOfferCode, offerCode);
  setNetworkStatus(hostNetworkAdapter.getState());
};

const renderJoinCode = async () => {
  const nameResult = getNormalizedName(playerNameInput.value);
  if (!nameResult.ok) {
    setInputValue(joinAnswerCode, '');
    setNetworkStatus(NETWORK_STATES.ERROR, nameResult.errors[0]);
    return;
  }

  setNetworkStatus(NETWORK_STATES.CONNECTING, 'Creating local answer...');
  const answerResult = await joinNetworkAdapter.createAnswer(joinOfferInput.value, { playerName: nameResult.value });
  if (!answerResult.ok) {
    createManualCodeFailureState(answerResult);
    setInputValue(joinAnswerCode, '');
    setNetworkStatus(NETWORK_STATES.ERROR, answerResult.errors[0]);
    return;
  }

  setInputValue(joinAnswerCode, answerResult.value);
  setNetworkStatus(joinNetworkAdapter.getState());
};

const acceptJoinAnswer = async () => {
  setNetworkStatus(NETWORK_STATES.CONNECTING, 'Accepting join answer...');
  const answerResult = await hostNetworkAdapter.acceptAnswer(hostAnswerInput.value);
  if (!answerResult.ok) {
    createManualCodeFailureState(answerResult);
    setNetworkStatus(NETWORK_STATES.ERROR, answerResult.errors[0]);
    return;
  }

  setNetworkStatus(answerResult.value);
};

const syncMatchOverlay = () => {
  const nameResult = getNormalizedName(matchPlayerNameInput.value);

  setFieldError(matchNameError, nameResult.ok ? '' : nameResult.errors[0]);

  if (!nameResult.ok) {
    return nameResult;
  }

  setInputValue(playerNameInput, nameResult.value);
  setInputValue(matchPlayerNameInput, nameResult.value);
  setFieldError(nameError, '');
  writeStoredPlayerName(undefined, nameResult.value);
  syncMainMenuState();

  return nameResult;
};

const syncSettingsName = () => {
  const nameResult = getNormalizedName(settingsPlayerNameInput.value);

  setFieldError(settingsNameError, nameResult.ok ? '' : nameResult.errors[0]);

  if (!nameResult.ok) {
    return nameResult;
  }

  setInputValue(playerNameInput, nameResult.value);
  setInputValue(matchPlayerNameInput, nameResult.value);
  setInputValue(settingsPlayerNameInput, nameResult.value);
  setFieldError(nameError, '');
  setFieldError(matchNameError, '');
  writeStoredPlayerName(undefined, nameResult.value);
  syncMainMenuState();

  return nameResult;
};

const openMenu = () => {
  stopOfflineLoop();
  offlineMatchState = null;

  if (pointerLockHelp) {
    pointerLockHelp.hidden = true;
  }

  buyMenuController.close({ playFeedback: false, restorePointerLock: false });
  document.body.classList.remove('buy-menu-open');
  setScoreboardOpen(false);
  activeBindingAction = null;
  showPanel('menu');
};

const closeSettings = () => {
  activeBindingAction = null;
  if (settingsReturnPanel === 'match') {
    setInGameSettingsOpen(false);
    matchPanel.focus({ preventScroll: true });
    return;
  }

  showPanel(settingsReturnPanel);
};

const openOfflineMatch = () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  const nameResult = syncMainMenuState();
  if (!nameResult.ok) {
    playerNameInput.focus();
    return;
  }

  setInputValue(matchPlayerNameInput, nameResult.value);
  gameCanvas.hidden = false;
  offlineMatchState = createOfflineMatch({ localPlayerName: nameResult.value, localLoadout: selectedLoadout });
  pressedMovementButtons = new Set();
  pendingLookDelta = { yawDelta: 0, pitchDelta: 0 };
  localFireQueued = false;
  localAltFireQueued = false;
  localJumpQueued = false;
  localReloadQueued = false;
  lastLocalShotRegistered = false;
  killfeedEntries = [];
  gameCanvas.dataset.lastLocalShot = 'false';
  renderOfflineHud();
  startOfflineLoop();
  showPanel('match');

  if (rendererShell === null) {
    rendererShell = createRendererShell({ mount: gameCanvas, pointerLockHelp, webglError });
  }

  rendererShell.resize();
  syncRendererState();
  rendererShell.requestPointerLock();
  matchPanel.focus({ preventScroll: true });
};

const openHostPanel = () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  const nameResult = syncMainMenuState();
  if (!nameResult.ok) {
    playerNameInput.focus();
    return;
  }

  setInputValue(matchPlayerNameInput, nameResult.value);
  hostNetworkAdapter = createBrowserManualWebRtcAdapter();
  setInputValue(hostOfferCode, '');
  setInputValue(hostAnswerInput, '');
  setNetworkStatus(NETWORK_STATES.IDLE);
  void renderHostCode();
  showPanel('host');
};

const openJoinPanel = () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  const nameResult = syncMainMenuState();
  if (!nameResult.ok) {
    playerNameInput.focus();
    return;
  }

  setInputValue(matchPlayerNameInput, nameResult.value);
  joinNetworkAdapter = createBrowserManualWebRtcAdapter();
  setInputValue(joinAnswerCode, '');
  setNetworkStatus(NETWORK_STATES.IDLE);
  showPanel('join');
};

const openBuyMenu = () => {
  if (matchPanel.hidden) {
    return;
  }

  document.exitPointerLock?.();
  document.body.classList.add('buy-menu-open');
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  buyMenuController.open();
};

const toggleBuyMenu = () => {
  if (matchPanel.hidden) {
    return;
  }

  if (buyMenu.hidden) {
    openBuyMenu();
    return;
  }

  buyMenuController.close();
};

const storedNameResult = readStoredPlayerName();
if (storedNameResult.value) {
  setInputValue(playerNameInput, storedNameResult.value);
  setInputValue(matchPlayerNameInput, storedNameResult.value);
  setInputValue(settingsPlayerNameInput, storedNameResult.value);
}

const storedKeybindingsResult = readStoredKeybindings();
currentBindings = storedKeybindingsResult.value;

const storedMouseSettingsResult = readStoredMouseSettings();
currentMouseSettings = storedMouseSettingsResult.value;

playerNameInput.addEventListener('input', syncMainMenuState);
matchPlayerNameInput.addEventListener('input', syncMatchOverlay);
settingsPlayerNameInput.addEventListener('input', syncSettingsName);

offlineStartButton.addEventListener('click', openOfflineMatch);
hostGameButton.addEventListener('click', openHostPanel);
joinGameButton.addEventListener('click', openJoinPanel);
openSettingsButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  openSettings();
});

hostCreateOfferButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  hostNetworkAdapter = createBrowserManualWebRtcAdapter();
  void renderHostCode();
});
hostBackButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  openMenu();
});
hostAcceptAnswerButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  void acceptJoinAnswer();
});

joinCreateAnswerButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  void renderJoinCode();
});
joinBackButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  openMenu();
});

matchApplyNameButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  syncMatchOverlay();
});
matchBackButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  openMenu();
});
matchOpenSettingsButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  openSettings();
});
openBuyMenuButton.addEventListener('click', openBuyMenu);

settingsCloseButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  closeSettings();
});
settingsResetDefaultsButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  currentBindings = createDefaultBindingMap();
  currentMouseSettings = { ...DEFAULT_MOUSE_SETTINGS };
  activeBindingAction = null;
  renderBindingRows();
  syncMouseSettingsControls();
  syncBindingWarning();
  writeStoredKeybindings(undefined, currentBindings);
  writeStoredMouseSettings(undefined, currentMouseSettings);
});
settingsApplyNameButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  syncSettingsName();
});

mouseSensitivity.addEventListener('input', () => {
  applyMouseSettings({ ...currentMouseSettings, sensitivity: mouseSensitivity.value });
});

mouseInvertY.addEventListener('change', () => {
  applyMouseSettings({ ...currentMouseSettings, invertY: mouseInvertY.checked });
});

audioMuteToggle.addEventListener('click', () => {
  audioController.unlock();
  const state = audioController.getState();
  audioController.setMuted(!state.muted);
  playAudioEvent(AudioEvent.MENU_ACTION);
  syncAudioControls();
});

matchAudioToggle.addEventListener('click', () => {
  audioController.unlock();
  const state = audioController.getState();
  audioController.setMuted(!state.muted);
  playAudioEvent(AudioEvent.MENU_ACTION);
  syncAudioControls();
});

audioVolume.addEventListener('input', () => {
  audioController.unlock();
  audioController.setVolume(audioVolume.value);
  syncAudioControls();
});

bindingList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-bind-action]');

  if (!button) {
    return;
  }

  beginRebind(button.dataset.bindAction);
});

joinOfferInput.addEventListener('input', () => {
  setInputValue(joinAnswerCode, '');
  setNetworkStatus(NETWORK_STATES.IDLE);
});
document.addEventListener('keydown', (event) => {
  if (isTextEntryElement(event.target) && !activeBindingAction) {
    return;
  }

  if (activeBindingAction) {
    event.preventDefault();
    finishRebind(getEventCode(event));
    return;
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Buy).includes(event.code)) {
    event.preventDefault();
    playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
    toggleBuyMenu();
    return;
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Scoreboard).includes(event.code)) {
    event.preventDefault();
    setScoreboardOpen(true);
    return;
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Fire).includes(event.code) && offlineMatchState) {
    event.preventDefault();
    if (!event.repeat) {
      queueOneShotOfflineInput({ fire: true });
    }
    return;
  }

  const digitSlotId = offlineMatchState ? getDigitSlotIdForEvent(event) : null;
  if (digitSlotId) {
    event.preventDefault();
    switchLocalWeaponSlot(digitSlotId);
    return;
  }

  if (offlineMatchState && isReloadEvent(event)) {
    event.preventDefault();
    if (!event.repeat) {
      queueOneShotOfflineInput({ reload: true });
    }
    return;
  }

  const movementButton = getMovementButtonForEvent(event);
  if (offlineMatchState && movementButton) {
    event.preventDefault();
    if (movementButton === INPUT_BUTTONS.JUMP && !event.repeat) {
      localJumpQueued = true;
    }
    pressedMovementButtons = new Set([...pressedMovementButtons, movementButton]);
    return;
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Settings).includes(event.code)) {
    event.preventDefault();
    playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
    if (settingsPanel.hidden) {
      openSettings();
    } else {
      closeSettings();
    }
  }
});

document.addEventListener('keyup', (event) => {
  if (isTextEntryElement(event.target) && !activeBindingAction) {
    return;
  }

  const movementButton = getMovementButtonForEvent(event);
  if (movementButton) {
    pressedMovementButtons = new Set([...pressedMovementButtons].filter((button) => button !== movementButton));
    event.preventDefault();
    return;
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Scoreboard).includes(event.code)) {
    event.preventDefault();
    setScoreboardOpen(false);
  }
});

gameCanvas.addEventListener('mousedown', (event) => {
  suppressNextCanvasClick = fireLocalWeaponFromPointerEvent(event);
});

gameCanvas.addEventListener('click', (event) => {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }

  fireLocalWeaponFromPointerEvent(event);
});

gameCanvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

gameCanvas.addEventListener('mousemove', (event) => {
  if (!offlineMatchState || !document.pointerLockElement || !gameCanvas.contains(document.pointerLockElement)) {
    return;
  }

  const configuredDelta = getConfiguredMouseLookDelta({ yawDelta: event.movementX, pitchDelta: event.movementY }, currentMouseSettings);
  pendingLookDelta = {
    yawDelta: pendingLookDelta.yawDelta + configuredDelta.yawDelta,
    pitchDelta: pendingLookDelta.pitchDelta + configuredDelta.pitchDelta,
  };
});

syncMainMenuState();
syncBindingWarning();
syncMouseSettingsControls();
syncAudioControls();
renderBindingRows();
openMenu();
