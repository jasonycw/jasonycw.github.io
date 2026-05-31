import { validatePlayerName } from './core/index.js';
import { AudioEvent, createAudioController } from './audio/index.js';
import { advanceOfflineMatchTick, buyOfflineWeapon, createOfflineMatch, deriveOfflineMatchHud, summarizeOfflinePerformance } from './gameplay/index.js';
import { InputAction, createDefaultBindingMap, getLiveBindingCandidates, readStoredKeybindings, readStoredPlayerName, writeStoredKeybindings, writeStoredPlayerName } from './input/index.js';
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
const hudScoreboardBody = document.getElementById('scoreboard-body');
const openBuyMenuButton = document.getElementById('open-buy-menu');
const buyCloseButton = document.getElementById('buy-close');
const perfSummary = document.getElementById('perf-summary');
const audioMuteToggle = document.getElementById('audio-mute-toggle');
const audioVolume = document.getElementById('audio-volume');
const audioStatus = document.getElementById('audio-status');
const matchAudioToggle = document.getElementById('match-audio-toggle');

const mainButtons = [offlineStartButton, hostGameButton, joinGameButton];
const panelMap = {
  menu: menuPanel,
  settings: settingsPanel,
  host: hostPanel,
  join: joinPanel,
  match: matchPanel,
};

let rendererShell = null;
let selectedLoadout = null;
let offlineMatchState = null;
let offlineMatchTimer = null;
let currentBindings = createDefaultBindingMap();
let activeBindingAction = null;
let settingsReturnPanel = 'menu';
let hostNetworkAdapter = createBrowserManualWebRtcAdapter();
let joinNetworkAdapter = createBrowserManualWebRtcAdapter();
let lastFootstepAt = 0;

const audioController = createAudioController();

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
  onLoadoutChange(loadout) {
    playAudioEvent(AudioEvent.BUY_SUCCESS, { unlock: true });
    selectedLoadout = loadout;
    if (offlineMatchState) {
      offlineMatchState = buyOfflineWeapon(offlineMatchState, loadout.activeWeaponId).state;
      renderOfflineHud();
    }
  },
  onPurchaseFailure() {
    playAudioEvent(AudioEvent.BUY_FAILURE, { unlock: true });
  },
  onClose(loadout, options = Object.freeze({ playFeedback: true })) {
    if (options.playFeedback !== false) {
      playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
    }
    matchPanel.focus({ preventScroll: true });
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
  setPanelVisibility(panelMap, panelName);
  networkPanel.hidden = panelName !== 'host' && panelName !== 'join';
  networkPanel.setAttribute('aria-hidden', String(networkPanel.hidden));
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

const renderOfflineHud = () => {
  if (!offlineMatchState) {
    return;
  }

  const hud = deriveOfflineMatchHud(offlineMatchState);
  setTextContent(hudWeapon, hud.localPlayer.activeWeapon.hud.label);
  setTextContent(hudHealth, String(hud.localPlayer.health));
  setTextContent(hudArmor, String(hud.localPlayer.armor));
  setTextContent(hudPhase, offlineMatchState.matchState.mode ?? hud.sessionClock.phase);
  renderPerfSummary();
  hudScoreboardBody.replaceChildren();

  hud.scoreboard.forEach((row, index) => {
    const scoreRow = document.createElement('tr');
    scoreRow.dataset.scoreboardSlot = String(row.slotIndex);
    if (row.slotIndex === offlineMatchState.matchState.localSlotIndex) {
      scoreRow.classList.add('scoreboard__row--local');
    }

    [
      String(index + 1),
      row.name,
      row.slotType,
      row.lifeState,
      String(row.score.kills),
      String(row.score.deaths),
    ].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      scoreRow.append(cell);
    });

    hudScoreboardBody.append(scoreRow);
  });
};

const handleOfflineAudioFeedback = (previousState, nextState, { localInput = null } = {}) => {
  if (!previousState || !nextState) {
    return;
  }

  const previousLocalPlayer = previousState.matchState.players[previousState.matchState.localSlotIndex];
  const nextLocalPlayer = nextState.matchState.players[nextState.matchState.localSlotIndex];

  if (localInput?.fire && nextState.lastLocalShot) {
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

const advanceOfflineMatchWithFeedback = (options = {}) => {
  const previousState = offlineMatchState;
  offlineMatchState = advanceOfflineMatchTick(offlineMatchState, options);
  handleOfflineAudioFeedback(previousState, offlineMatchState, options);
  renderOfflineHud();
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
    advanceOfflineMatchWithFeedback();
  }, 1000 / 30);
};

const openSettings = () => {
  settingsReturnPanel = matchPanel.hidden ? 'menu' : 'match';
  syncSettingsPanel();
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

  buyMenuController.close({ playFeedback: false });
  activeBindingAction = null;
  showPanel('menu');
};

const closeSettings = () => {
  activeBindingAction = null;
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
  renderOfflineHud();
  startOfflineLoop();

  if (rendererShell === null) {
    rendererShell = createRendererShell({ mount: gameCanvas, pointerLockHelp, webglError });
  }

  rendererShell.requestPointerLock();

  showPanel('match');
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

  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  buyMenuController.open();
};

const toggleBuyMenu = () => {
  if (matchPanel.hidden) {
    return;
  }

  buyMenuController.toggle();
};

const storedNameResult = readStoredPlayerName();
if (storedNameResult.value) {
  setInputValue(playerNameInput, storedNameResult.value);
  setInputValue(matchPlayerNameInput, storedNameResult.value);
  setInputValue(settingsPlayerNameInput, storedNameResult.value);
}

const storedKeybindingsResult = readStoredKeybindings();
currentBindings = storedKeybindingsResult.value;

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
  activeBindingAction = null;
  renderBindingRows();
  syncBindingWarning();
  writeStoredKeybindings(undefined, currentBindings);
});
settingsApplyNameButton.addEventListener('click', () => {
  playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
  syncSettingsName();
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
  if (activeBindingAction) {
    event.preventDefault();
    finishRebind(event.code);
    return;
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Buy).includes(event.code)) {
    event.preventDefault();
    playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
    toggleBuyMenu();
    return;
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Fire).includes(event.code) && offlineMatchState) {
    event.preventDefault();
    advanceOfflineMatchWithFeedback({ localInput: { fire: true } });
    return;
  }

  const movementActions = [InputAction.MoveForward, InputAction.MoveBack, InputAction.MoveLeft, InputAction.MoveRight];
  if (offlineMatchState && movementActions.some((action) => getLiveBindingCandidates(currentBindings, action).includes(event.code))) {
    const now = Date.now();
    if (now - lastFootstepAt > 260) {
      lastFootstepAt = now;
      playAudioEvent(AudioEvent.FOOTSTEP, { unlock: true });
    }
  }

  if (getLiveBindingCandidates(currentBindings, InputAction.Settings).includes(event.code)) {
    event.preventDefault();
    playAudioEvent(AudioEvent.MENU_ACTION, { unlock: true });
    openSettings();
  }
});

gameCanvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || !offlineMatchState) {
    return;
  }

  advanceOfflineMatchWithFeedback({ localInput: { fire: true } });
});

syncMainMenuState();
syncBindingWarning();
syncAudioControls();
renderBindingRows();
openMenu();

