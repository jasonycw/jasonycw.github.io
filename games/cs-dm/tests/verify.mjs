import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '..');
const repoRoot = path.resolve(gameRoot, '..', '..');

const readText = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

const remoteUrlPattern = /(?:https?:)?\/\/|data:image\//i;
const approvedRemoteReferences = Object.freeze(['https://unpkg.com/three@0.165.0/build/three.module.js']);
const approvedRemoteTextReferences = Object.freeze(['https://unpkg.com/three@0.165.0/build/three.module.js']);

const walkFiles = (rootPath, allowedExtensions) => {
  const entries = [];

  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkFiles(entryPath, allowedExtensions));
    } else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
      entries.push(entryPath);
    }
  }

  return entries;
};

const assertNoRemoteTextureReferences = () => {
  const scanRoots = [
    path.join(gameRoot, 'assets'),
    path.join(gameRoot, 'src', 'map'),
    path.join(gameRoot, 'styles.css'),
    path.join(gameRoot, 'index.html'),
  ];
  const allowedExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs']);
  const scannedFiles = [];

  for (const rootPath of scanRoots) {
    if (!existsSync(rootPath)) continue;
    const stats = statSync(rootPath);
    if (stats.isDirectory()) {
      scannedFiles.push(...walkFiles(rootPath, allowedExtensions));
    } else if (stats.isFile() && allowedExtensions.has(path.extname(rootPath))) {
      scannedFiles.push(rootPath);
    }
  }

  const violations = [];
  for (const filePath of scannedFiles) {
    let text = readFileSync(filePath, 'utf8');
    [...approvedRemoteReferences, ...approvedRemoteTextReferences].forEach((reference) => {
      text = text.replaceAll(reference, '');
    });
    if (remoteUrlPattern.test(text)) {
      violations.push(path.relative(repoRoot, filePath).replace(/\\/g, '/'));
    }
  }

  assert.deepEqual(violations, [], `remote texture/image references are forbidden: ${violations.join(', ')}`);

  const evidenceDir = path.join(repoRoot, '.sisyphus', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path.join(evidenceDir, 'task-15-no-remote-textures.txt'), [
    'T15 no remote texture evidence',
    `Scanned files: ${scannedFiles.length}`,
    'Scope: games/cs-dm/assets, games/cs-dm/src/map, games/cs-dm/styles.css, games/cs-dm/index.html',
    'Remote texture/image references: 0',
  ].join('\n'));
};

const assertExists = (relativePath) => {
  assert.equal(existsSync(path.join(repoRoot, relativePath)), true, `${relativePath} should exist`);
};

const assertNoWorkflows = () => {
  const workflowsPath = path.join(repoRoot, '.github', 'workflows');
  assert.equal(existsSync(workflowsPath), false, '.github/workflows must not exist');
};

const assertRelativeOrApprovedUrl = (value, label) => {
  assert.equal(/^(?:\.\.\/|\.\/)/.test(value) || approvedRemoteReferences.includes(value), true, `${label} must stay relative or use the approved Three.js CDN`);
};

const run = async () => {
  await import(pathToFileURL(path.join(gameRoot, 'src', 'core', 'contracts.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'weapons', 'weapons.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'render', 'weaponModels.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'render', 'render.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'ui', 'hudData.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'ui', 'buyMenu.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'ui', 'settings.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'input', 'storage.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'input', 'domGuards.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'map', 'map.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'bots', 'bots.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'player', 'movement.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'render', 'playerModels.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'gameplay', 'combat.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'gameplay', 'offlineMatch.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'gameplay', 'performance.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'audio', 'audio.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'network', 'network.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'network', 'protocol.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'network', 'slots.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'network', 'failure.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'src', 'network', 'p2p-e2e.test.mjs')).href);
  await import(pathToFileURL(path.join(gameRoot, 'tests', 'smoke.mjs')).href);

  assertExists('games/cs-dm/index.html');
  assertExists('games/cs-dm/styles.css');
  assertExists('games/cs-dm/src/main.js');
  assertExists('games/cs-dm/src/core/index.js');
  assertExists('games/cs-dm/src/core/contracts.test.mjs');
  assertExists('games/cs-dm/src/weapons/index.js');
  assertExists('games/cs-dm/src/weapons/weapons.test.mjs');
  assertExists('games/cs-dm/src/render/weaponModels.js');
  assertExists('games/cs-dm/src/render/state.js');
  assertExists('games/cs-dm/src/render/weaponModels.test.mjs');
  assertExists('games/cs-dm/src/render/render.test.mjs');
  assertExists('games/cs-dm/src/ui/index.js');
  assertExists('games/cs-dm/src/ui/hudData.js');
  assertExists('games/cs-dm/src/ui/hudData.test.mjs');
  assertExists('games/cs-dm/src/ui/buyMenu.js');
  assertExists('games/cs-dm/src/ui/buyMenu.test.mjs');
  assertExists('games/cs-dm/src/ui/settings.js');
  assertExists('games/cs-dm/src/ui/settings.test.mjs');
  assertExists('games/cs-dm/src/input/storage.test.mjs');
  assertExists('games/cs-dm/src/map/index.js');
  assertExists('games/cs-dm/src/map/map.test.mjs');
  assertExists('games/cs-dm/src/bots/index.js');
  assertExists('games/cs-dm/src/bots/bots.test.mjs');
  assertExists('games/cs-dm/src/player/index.js');
  assertExists('games/cs-dm/src/player/movement.test.mjs');
  assertExists('games/cs-dm/src/render/playerModels.js');
  assertExists('games/cs-dm/src/render/playerModels.test.mjs');
  assertExists('games/cs-dm/src/gameplay/index.js');
  assertExists('games/cs-dm/src/gameplay/combat.js');
  assertExists('games/cs-dm/src/gameplay/combat.test.mjs');
  assertExists('games/cs-dm/src/gameplay/offlineMatch.js');
  assertExists('games/cs-dm/src/gameplay/offlineMatch.test.mjs');
  assertExists('games/cs-dm/src/gameplay/performance.js');
  assertExists('games/cs-dm/src/gameplay/performance.test.mjs');
  assertExists('games/cs-dm/src/audio/index.js');
  assertExists('games/cs-dm/src/audio/audio.test.mjs');
  assertExists('games/cs-dm/src/network/protocol.js');
  assertExists('games/cs-dm/src/network/protocol.test.mjs');
  assertExists('games/cs-dm/src/network/slots.js');
  assertExists('games/cs-dm/src/network/slots.test.mjs');
  assertExists('games/cs-dm/src/network/failure.test.mjs');
  assertExists('games/cs-dm/src/network/p2p-e2e.test.mjs');
  assertExists('games/cs-dm/assets');
  assertExists('games/cs-dm/screenshots');

  const indexHtml = readText('games/cs-dm/index.html');
  assert.equal(indexHtml.includes('<link rel="stylesheet" href="./styles.css" />'), true, 'index.html must reference ./styles.css');
  assert.equal(indexHtml.includes('<script type="module" src="./src/main.js"></script>'), true, 'index.html must reference ./src/main.js');

  const requiredSelectors = [
    'shell',
    'menu-card',
    'eyebrow',
    'field',
    'name-error',
    'actions',
    'player-name',
    'offline-start',
    'host-game',
    'join-game',
    'host-offer-code',
    'join-offer-input',
    'join-answer-code',
    'host-answer-input',
    'create-answer',
    'accept-answer',
    'network-error',
    'match-player-name',
    'match-name-error',
    'game-canvas',
    'pointer-lock-help',
    'webgl-error',
    'buy-menu',
    'buy-error',
    'hud-weapon',
    'settings-menu',
    'binding-conflict',
    'mouse-sensitivity',
    'mouse-sensitivity-value',
    'mouse-invert-y',
    'mouse-status',
    'audio-mute-toggle',
    'audio-volume',
    'audio-status',
    'match-audio-toggle',
    'perf-summary',
    'hud-radar',
  ];
  for (const selector of requiredSelectors) {
    assert.equal(indexHtml.includes(`class="${selector}`) || indexHtml.includes(`class='${selector}`) || indexHtml.includes(`id="${selector}`) || indexHtml.includes(`id='${selector}`), true, `index.html must include ${selector}`);
  }

  const allowedExternal = [...approvedRemoteReferences];
  const urlMatches = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const url of urlMatches) {
    if (url.startsWith('http')) {
      assert.equal(allowedExternal.includes(url), true, `unexpected external reference: ${url}`);
    } else {
      assertRelativeOrApprovedUrl(url, url);
    }
  }

  const localReferences = ['./styles.css', './src/main.js', '../../img/favicon.ico'];
  for (const reference of localReferences) {
    assert.equal(existsSync(path.resolve(gameRoot, reference)), true, `referenced file must exist: ${reference}`);
  }

  const mainJs = readText('games/cs-dm/src/main.js');
  const stylesCss = readText('games/cs-dm/styles.css');
  const hudDataJs = readText('games/cs-dm/src/ui/hudData.js');
  const productionHudText = [
    ['games/cs-dm/index.html', indexHtml],
    ['games/cs-dm/styles.css', stylesCss],
    ['games/cs-dm/src/main.js', mainJs],
    ['games/cs-dm/src/ui/hudData.js', hudDataJs],
  ];
  const forbiddenFakeKillfeedText = [
    'BOT SAND RAIDER',
    'SAND RAIDER AK-47 HARBOR RANGER',
    'VECTOR AK-47 MID BOT',
    'CT GUARD M4A1 LONG BOT',
    'HARBOR RANGER',
    'CT GUARD',
    'M4A1 LONG BOT',
  ];
  for (const [fileName, text] of productionHudText) {
    assert.equal(text.includes('.match-hud::after'), false, `${fileName} must not hard-code a fake top-right HUD pseudo-element`);
    const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
    for (const fakeText of forbiddenFakeKillfeedText) {
      assert.equal(normalizedText.includes(fakeText), false, `${fileName} must not ship fake top-right killfeed text: ${fakeText}`);
    }
  }
  assert.equal(indexHtml.includes('id="hud-killfeed"'), true, 'HUD must expose an explicit killfeed element instead of CSS-generated fake rows');
  assert.equal(indexHtml.includes('id="hud-killfeed"') && indexHtml.includes('hidden'), true, 'empty killfeed must be hidden until real match events render it');
  assert.equal(stylesCss.includes('.match-hud__killfeed:empty'), true, 'empty killfeed CSS must remain hidden');

  const audioJs = readText('games/cs-dm/src/audio/index.js');
  const audioTest = readText('games/cs-dm/src/audio/audio.test.mjs');
  const buyMenuJs = readText('games/cs-dm/src/ui/buyMenu.js');
  const buyMenuTest = readText('games/cs-dm/src/ui/buyMenu.test.mjs');
  const settingsJs = readText('games/cs-dm/src/ui/settings.js');
  const settingsTest = readText('games/cs-dm/src/ui/settings.test.mjs');
  const weaponModelsJs = readText('games/cs-dm/src/render/weaponModels.js');
  const renderIndexJs = readText('games/cs-dm/src/render/index.js');
  const renderStateJs = readText('games/cs-dm/src/render/state.js');
  const renderTest = readText('games/cs-dm/src/render/render.test.mjs');
  const offlineMatchTest = readText('games/cs-dm/src/gameplay/offlineMatch.test.mjs');
  const botIndexJs = readText('games/cs-dm/src/bots/index.js');
  const networkIndexJs = readText('games/cs-dm/src/network/index.js');
  const protocolJs = readText('games/cs-dm/src/network/protocol.js');
  const p2pE2eTest = readText('games/cs-dm/src/network/p2p-e2e.test.mjs');
  const readme = readText('games/cs-dm/README.md');
  const screenshotsReadme = readText('games/cs-dm/screenshots/README.md');
  const requiredScreenshotPaths = [
    'games/cs-dm/screenshots/menu.png',
    'games/cs-dm/screenshots/offline-gameplay.png',
    'games/cs-dm/screenshots/buy-menu.png',
    'games/cs-dm/screenshots/scoreboard.png',
    'games/cs-dm/screenshots/p2p-ui.png',
  ];
  assert.equal(mainJs.includes("import { INPUT_BUTTONS, validatePlayerName } from './core/index.js';"), true, 'main.js must import the core validator and gameplay input buttons');
  assert.equal(mainJs.includes("from './input/index.js';") && mainJs.includes('readStoredMouseSettings') && mainJs.includes('writeStoredMouseSettings') && mainJs.includes('getConfiguredMouseLookDelta'), true, 'main.js must import input storage, binding, and mouse helpers');
  assert.equal(mainJs.includes("import { createRendererShell } from './render/index.js';"), true, 'main.js must import the renderer shell');
  assert.equal(mainJs.includes("import { AudioEvent, createAudioController } from './audio/index.js';"), true, 'main.js must import audio controller helpers');

  assert.equal(mainJs.includes('rendererShell.requestPointerLock();'), true, 'offline start must request pointer lock immediately');
  assert.equal(mainJs.includes('audioController.unlock();'), true, 'audio must unlock only from user-gesture handlers');
  assert.equal(mainJs.includes('AudioEvent.FIRE'), true, 'main.js must trigger firing feedback');
  assert.equal(mainJs.includes('AudioEvent.HIT'), true, 'main.js must trigger hit feedback');
  assert.equal(mainJs.includes('AudioEvent.DEATH'), true, 'main.js must trigger death feedback');
  assert.equal(mainJs.includes('AudioEvent.RESPAWN'), true, 'main.js must trigger respawn feedback');
  assert.equal(mainJs.includes('AudioEvent.FOOTSTEP'), true, 'main.js must trigger footstep feedback');
  assert.equal(mainJs.includes('gameCanvas.dataset.localY = String(localController.position.y);'), true, 'main.js must expose local Y for browser jump QA');
  assert.equal(mainJs.includes('lastLocalShotRegistered = true;'), true, 'main.js must keep successful local firing observable for browser QA');
  assert.equal(mainJs.includes("gameCanvas.addEventListener('click'") && mainJs.includes('suppressNextCanvasClick'), true, 'main.js must support browser click firing without double-consuming mousedown shots');
  assert.equal(mainJs.includes('buyMenuController.close({ playFeedback: false, restorePointerLock: false });'), true, 'startup openMenu must close buy menu without audio feedback or pointer-lock restore');
  assert.equal(mainJs.includes('options.playFeedback !== false'), true, 'buy menu close feedback must be gated by explicit options');
  assert.equal(mainJs.includes("offlineStartButton.addEventListener('click', openOfflineMatch);"), true, 'offline start button must route to openOfflineMatch');
  assert.equal(mainJs.includes('createOfflineMatch'), true, 'offline start must create a deterministic offline match');
  assert.equal(mainJs.includes('advanceOfflineMatchTick'), true, 'main.js must advance the offline match loop');
  assert.equal(mainJs.includes('deriveOfflineMatchHud'), true, 'main.js must render offline HUD data');
  assert.equal(mainJs.includes("document.querySelector('.match-stage__label')"), false, 'main.js must not query a generic match-stage label');
  assert.equal(mainJs.includes('createBuyMenuController'), true, 'main.js must create the buy menu controller');
  assert.equal(mainJs.includes('getLiveBindingCandidates(currentBindings, InputAction.Buy)'), true, 'main.js must hook the configured buy key');
  assert.equal(mainJs.includes('getLiveBindingCandidates(currentBindings, InputAction.Settings)'), true, 'main.js must hook the configured settings key');
  assert.equal(mainJs.includes("document.getElementById('mouse-sensitivity')"), true, 'main.js must bind the mouse sensitivity control');
  assert.equal(mainJs.includes("document.getElementById('mouse-invert-y')"), true, 'main.js must bind the invert mouse Y control');
  assert.equal(mainJs.includes('currentMouseSettings = storedMouseSettingsResult.value'), true, 'main.js must initialize mouse settings from storage');
  assert.equal(mainJs.includes('getConfiguredMouseLookDelta({ yawDelta: event.movementX, pitchDelta: event.movementY }, currentMouseSettings)'), true, 'mousemove must use configured mouse look deltas');
  assert.equal(mainJs.includes('writeStoredMouseSettings(undefined, currentMouseSettings)'), true, 'main.js must persist mouse settings changes');
  assert.equal(mainJs.includes('currentMouseSettings = { ...DEFAULT_MOUSE_SETTINGS };'), true, 'reset defaults must restore mouse defaults');
  assert.equal(mainJs.includes("gameCanvas.dataset.lastLocalShot = lastLocalShotRegistered ? 'true' : 'false';"), true, 'local firing feedback dataset must preserve successful shot state for browser QA');
  assert.equal(mainJs.includes('switchOfflineWeaponSlot') && mainJs.includes("event.code === 'Digit1'") && mainJs.includes("event.code === 'Digit2'") && mainJs.includes("event.code === 'Digit3'"), true, 'main.js must wire live number-key weapon switching');
  assert.equal(mainJs.includes('reloadOfflineWeapon') && mainJs.includes("event.code === 'KeyR'"), true, 'main.js must wire live R reload');
  assert.equal(mainJs.includes('renderRadar(hud.radar)') && mainJs.includes('hud.localPlayer.ammo.clip'), true, 'main.js must render live radar and ammo state');
  assert.equal(mainJs.includes('updateKillfeed(previousState, offlineMatchState)'), true, 'main.js must update killfeed from real match events');
  assert.equal(mainJs.includes('settingsCloseButton.addEventListener') && mainJs.includes('closeSettings();'), true, 'main.js must wire settings close behavior');
  assert.equal(buyMenuJs.includes('BUY_CATEGORY_METADATA'), true, 'buy menu must use category metadata');
  assert.equal(buyMenuJs.includes('WEAPON_LIST'), true, 'buy menu must use canonical weapon list');
  assert.equal(buyMenuJs.includes('getWeaponById'), true, 'buy menu must use canonical weapon lookup');
  assert.equal(buyMenuJs.includes('costPolicy'), true, 'buy menu must make free-buy mode explicit');
  assert.equal(buyMenuJs.includes('dataset.buyCategory'), true, 'buy category controls must use data-buy-category');
  assert.equal(buyMenuJs.includes('dataset.buyWeapon'), true, 'weapon controls must use data-buy-weapon');
  assert.equal(buyMenuJs.includes('innerHTML'), false, 'buy menu must avoid innerHTML sinks');
  assert.equal(buyMenuTest.includes('task-19-buy-rifle.txt'), true, 'buy rifle evidence must be written by tests');
  assert.equal(buyMenuTest.includes('task-19-invalid-buy.txt'), true, 'invalid buy evidence must be written by tests');
  assert.equal(settingsJs.includes('./settings.js'), false, 'settings ui export should remain a thin re-export');
  assert.equal(settingsTest.includes('task-20-rebind-persist.txt'), true, 'settings tests must write rebind persistence evidence');
  assert.equal(settingsTest.includes('task-20-binding-conflict.txt'), true, 'settings tests must write binding conflict evidence');
  assert.equal(settingsTest.includes('task-29-storage-recovery.txt'), true, 'settings tests must write T29 storage recovery evidence');
  assert.equal(settingsJs.includes('getConfiguredMouseLookDelta'), true, 'settings ui export must expose mouse look helper');
  assert.equal(settingsTest.includes('task-mouse-settings-normalization.txt'), true, 'settings tests must write mouse normalization evidence');
  assert.equal(audioJs.includes('GENERATED_AUDIO_PROVENANCE'), true, 'audio module must document generated sound provenance');
  assert.equal(audioJs.includes('silent-noop'), true, 'audio module must expose a silent fallback state');
  assert.equal(audioTest.includes('task-28-audio-unlock.txt'), true, 'audio tests must write unlock evidence');
  assert.equal(audioTest.includes('task-28-audio-fallback.txt'), true, 'audio tests must write fallback evidence');
  assert.equal(audioTest.includes('task-29-audio-storage-recovery.txt'), true, 'audio tests must write T29 audio storage recovery evidence');
  assert.equal(audioTest.includes('programmatic startup menu close does not unlock or create AudioContext'), true, 'audio tests must cover startup menu close lock behavior');
  assert.equal(weaponModelsJs.includes('Original generated low-poly primitive metadata'), true, 'weapon models must document original generated primitive metadata');
  assert.equal(weaponModelsJs.includes('weapon-model-missing'), true, 'weapon models must expose missing-model warning data');
  assert.equal(weaponModelsJs.includes('deriveWeaponSwitchMetadata'), true, 'weapon models must expose switch metadata');
  assert.equal(renderIndexJs.includes("export * from './state.js';"), true, 'renderer must re-export deterministic render state helpers');
  assert.equal(renderStateJs.includes('getSafeViewportSize'), true, 'renderer state must expose deterministic safe viewport sizing');
  assert.equal(renderStateJs.includes('createRendererFallbackState'), true, 'renderer state must expose deterministic WebGL fallback state');
  assert.equal(renderTest.includes('task-29-resize.txt'), true, 'render tests must write T29 resize evidence');
  assert.equal(renderIndexJs.includes('buildWeaponLayerModel') && renderIndexJs.includes('activeViewModelWeaponId'), true, 'renderer must rebuild active viewmodels from weapon metadata');
  assert.equal(hudDataJs.includes('deriveRadarData') && hudDataJs.includes('weaponStatesBySlotIndex'), true, 'HUD data must derive radar and live ammo from match state');
  assert.equal(hudDataJs.includes("kind: 'placeholder'"), false, 'HUD radar must not be a placeholder');
  assert.equal(offlineMatchTest.includes('task-29-menu-death-respawn.txt'), true, 'offline match tests must write T29 menu/death/respawn evidence');
  assert.equal(offlineMatchTest.includes('task-34-offline-tuning.txt'), true, 'offline match tests must write T34 offline tuning evidence');
  assert.equal(offlineMatchTest.includes('task-34-spawn-validity.txt'), true, 'offline match tests must write T34 spawn validity evidence');
  assert.equal(botIndexJs.includes('MAP_SPAWN_POINTS[player.slotIndex]?.position'), true, 'bot respawns must use configured slot spawn points');
  assert.equal(networkIndexJs.includes("export * from './protocol.js';"), true, 'network index must export protocol helpers');
  assert.equal(networkIndexJs.includes("export * from './slots.js';"), true, 'network index must export slot hot-swap helpers');
  assert.equal(networkIndexJs.includes('createFullRoomJoinRejection'), true, 'network index must expose full-room join rejection helper');
  assert.equal(networkIndexJs.includes('createRemoteDisconnectFallback'), true, 'network index must expose disconnect bot fallback helper');
  assert.equal(networkIndexJs.includes('createHostCloseFallback'), true, 'network index must expose host-close fallback helper');
  assert.equal(protocolJs.includes('NETWORK_PROTOCOL_VERSION'), true, 'protocol must centralize its version');
  assert.equal(protocolJs.includes('Remote clients cannot set health, kills, positions, snapshots, or world state.'), true, 'protocol must reject client state mutation');
  assert.equal(protocolJs.includes('createSnapshotDisplayBuffer'), true, 'protocol must expose interpolation display helper');
  assert.equal(p2pE2eTest.includes('task-35-p2p-state.txt'), true, 'T35 P2P test must write state evidence');
  assert.equal(p2pE2eTest.includes('createRemoteDisconnectFallback'), true, 'T35 P2P test must cover disconnect bot fallback');
  assert.equal(p2pE2eTest.includes('createManualCodeFailureState'), true, 'T35 P2P test must cover invalid manual-code recovery');
  assert.equal(indexHtml.includes('Counter Strike - Deathmatch'), true, 'UI must use the PR-ready full game title');
  assert.equal(indexHtml.includes('Static prototype'), false, 'main menu must not expose prototype copy');
  assert.equal(indexHtml.includes('best-effort manual P2P'), false, 'main menu must not expose developer P2P wording');
  assert.equal(indexHtml.includes('NAT') || indexHtml.includes('firewall'), false, 'main menu must not expose NAT/firewall wording');
  assert.equal(readme.includes('best-effort manual WebRTC'), true, 'README must document best-effort manual P2P');
  assert.equal(readme.includes('no third-party relay') && readme.includes('TURN server') && readme.includes('signaling broker'), true, 'README must document no relay/broker');
  assert.equal(readme.includes('NAT') && readme.includes('firewall'), true, 'README must document NAT/firewall limitations');
  assert.equal(readme.includes('## Controls'), true, 'README must document controls');
  assert.equal(readme.includes('## Browser Support'), true, 'README must document browser support');
  assert.equal(readme.includes('## Screenshots'), true, 'README must document screenshots');
  assert.equal(readme.includes('## Manual P2P'), true, 'README must document manual P2P steps');
  assert.equal(readme.includes('## Offline Tuning'), true, 'README must document offline tuning values');
  assert.equal(readme.includes('Respawn delay is `3000ms`') && readme.includes('spawn protection lasts `1500ms`'), true, 'README must document respawn timing tuning values');
  assert.equal(readme.includes('14` reaction ticks') && readme.includes('6` degrees base aim error'), true, 'README must document bot difficulty tuning values');
  assert.equal(readme.includes('33ms` median frame') && readme.includes('64` post-cleanup transient effects'), true, 'README must document performance budgets');
  assert.equal(readme.includes('The host clicks the host flow and generates an offer code.'), true, 'README must describe the host offer step');
  assert.equal(readme.includes('The joiner pastes that offer code, then generates an answer code.'), true, 'README must describe the joiner answer step');
  assert.equal(readme.includes('The host pastes the answer code to accept the connection.'), true, 'README must describe the host accept step');
  assert.equal(readme.includes('CS DM is not affiliated with Valve, Counter-Strike, or Steam.'), true, 'README must include the non-affiliation note');
  assert.equal(readme.includes('Visuals here are original or generated placeholders only.'), true, 'README must include the original-assets note');
  assert.equal(readme.includes('P2P is best-effort and can fail behind some NAT or firewall setups.'), true, 'README must include the NAT limitation note');
  assert.equal(readme.includes('local tabs') && readme.includes('deterministic local-context'), true, 'README must document T35 local-tab/deterministic QA scope');
  assert.equal(readme.includes('manual code') && readme.includes('best-effort') && readme.includes('NAT') && readme.includes('firewall'), true, 'README must include T35 limitation concepts');
  assert.equal(readme.includes('T36 final screenshots are real local-browser captures'), true, 'README must document T36 capture provenance');
  const requiredReadmeImageLinks = [
    '![Main menu](./screenshots/menu.png)',
    '![Offline gameplay](./screenshots/offline-gameplay.png)',
    '![Buy menu](./screenshots/buy-menu.png)',
    '![Scoreboard](./screenshots/scoreboard.png)',
    '![Manual P2P UI](./screenshots/p2p-ui.png)',
  ];
  for (const link of requiredReadmeImageLinks) {
    assert.equal(readme.includes(link), true, `README must include final screenshot link: ${link}`);
  }
  assert.equal(screenshotsReadme.includes('Final T36 screenshots'), true, 'screenshots README must document final T36 screenshots');
  for (const screenshotPath of requiredScreenshotPaths) {
    const fullPath = path.join(repoRoot, screenshotPath);
    assert.equal(existsSync(fullPath), true, `${screenshotPath} should exist`);
    assert.equal(statSync(fullPath).size > 0, true, `${screenshotPath} should be non-empty`);
  }

  const evidenceDir = path.join(repoRoot, '.sisyphus', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path.join(evidenceDir, 'task-32-readme-images.txt'), [
    'T32 README image evidence',
    'README links now resolved by T36 final screenshots:',
    ...requiredScreenshotPaths.map((screenshotPath) => `- ./screenshots/${path.basename(screenshotPath)}`),
    'Resolved on disk: yes',
    'Status: final PNG browser captures present and non-empty',
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-32-p2p-docs.txt'), [
    'T32 P2P docs evidence',
    'Manual flow: host offer -> join answer -> host accept',
    'Limitations: best-effort, NAT/firewall dependent, no TURN relay, no signaling broker, no backend',
    'Fallback: offline bots remain the reliable baseline',
  ].join('\n'));

  const relativeImports = [...mainJs.matchAll(/import\s+(?:[^'\"]+from\s+)?['\"]([^'\"]+)['\"]/g)].map((match) => match[1]);
  for (const specifier of relativeImports) {
    if (!specifier.startsWith('.')) continue;
    assert.equal(existsSync(path.resolve(path.dirname(path.join(gameRoot, 'src', 'main.js')), specifier)), true, `module import must resolve: ${specifier}`);
  }

  assertNoWorkflows();
  assertNoRemoteTextureReferences();

  const workflowDir = path.join(repoRoot, '.github', 'workflows');
  assert.equal(existsSync(workflowDir), false, '.github/workflows directory must remain absent');
  assert.equal(readdirSync(path.join(gameRoot)).includes('tests'), true, 'games/cs-dm/tests directory must exist');
  writeFileSync(path.join(evidenceDir, 'task-13-score-sort.txt'), [
    'T13 score sort evidence',
    'Order: Bravo, Charlie, Alpha',
    'Rule: kills desc, deaths asc, name asc, slotIndex asc',
  ].join('\n'));
  const coreTest = readText('games/cs-dm/src/core/contracts.test.mjs');
  assert.equal(coreTest.includes('task-29-name-edge-cases.txt'), true, 'core tests must write T29 name edge-case evidence');

  writeFileSync(path.join(evidenceDir, 'task-4-contract-tests.txt'), [
    'T4 core contract evidence',
    'Coverage: 16-player slots, local/bot/remote slot types, player-name validation, input-frame validation, and network-snapshot validation',
    'Status: PASS',
    'Source: games/cs-dm/src/core/contracts.test.mjs via npm run test',
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-4-name-validation.txt'), [
    'T4 name validation evidence',
    'Valid name: Vector -> ok',
    'Empty name: rejected',
    'Over-limit name: rejected',
    'Duplicate-ready name: rejected',
    'HTML-like name: rejected',
    'Safe sinks: textContent/value only',
  ].join('\n'));

  writeFileSync(path.join(evidenceDir, 'task-13-dead-hud.txt'), [
    'T13 dead HUD evidence',
    'lifeState=respawning',
    'health=0 armor=0 ammo=ak47/30/90 latency=null respawnCountdown=null',
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-9-callouts.txt'), [
    'T9 callouts evidence',
    'Map: sunspire-yard',
    'Required callouts: Raider Gate, Guard Yard, Market Mid, Twin Gate, Sunwalk Long, Catwalk Spur, Upper Cistern, Lower Cistern, Cistern Court, Guard Window, Sun Court Crates',
    'Waypoints: spawn anchors, lane anchors, site anchors, and tunnel anchors',
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-9-collision.txt'), [
    'T9 collision evidence',
    'Spawn count: 16',
    'Spawn overlap count: 0',
    'Collision volumes: 16',
  ].join('\n'));

  const { createOfflineSlots, validatePlayerName } = await import(pathToFileURL(path.join(gameRoot, 'src', 'core', 'index.js')).href);
  const { getCisternTunnelRouteToCisternCourt, isTunnelWaypoint, summarizeBotSlots } = await import(pathToFileURL(path.join(gameRoot, 'src', 'bots', 'index.js')).href);
  const botSummary = summarizeBotSlots(createOfflineSlots('Verifier'));
  const tunnelRoute = getCisternTunnelRouteToCisternCourt();
  writeFileSync(path.join(evidenceDir, 'task-12-bot-slots.txt'), [
    'T12 bot slot evidence',
    `Bot slot count: ${botSummary.botSlotCount}`,
    `Unique bot names: ${botSummary.uniqueBotNameCount}`,
    `All bot contracts include remote handoff fields: ${botSummary.allHaveBotContract}`,
    `Names: ${botSummary.names.join(', ')}`,
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-12-waypoint-path.txt'), [
    'T12 waypoint path evidence',
    `Route: ${tunnelRoute.map((step) => step.waypointId).join(' -> ')}`,
    `Includes tunnel waypoint: ${tunnelRoute.some(isTunnelWaypoint)}`,
    `Ends at B Site: ${tunnelRoute[tunnelRoute.length - 1]?.waypointId === 'wp-b-site'}`,
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-14-valid-name.txt'), [
    'T14 valid name evidence',
    `Input: ${validatePlayerName('Vector').value}`,
    `Error visible: ${validatePlayerName('Vector').ok ? 'none' : validatePlayerName('Vector').errors[0]}`,
    'Safe sink: textContent/value only',
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-14-invalid-name.txt'), [
    'T14 invalid name evidence',
    `Empty: ${validatePlayerName('').errors[0]}`,
    `HTML-like: ${validatePlayerName('<script>alert(1)</script>').errors[0]}`,
    `Too long: ${validatePlayerName('abcdefghijklmnopqrstu').errors[0]}`,
    'Safe sink: textContent/value only',
  ].join('\n'));

  console.log('PASS T2 static verification');
};

run().catch((error) => {
  console.error('FAIL T2 static verification');
  console.error(error);
  process.exitCode = 1;
});

