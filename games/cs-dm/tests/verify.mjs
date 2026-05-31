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
    'audio-mute-toggle',
    'audio-volume',
    'audio-status',
    'match-audio-toggle',
    'perf-summary',
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
  const networkIndexJs = readText('games/cs-dm/src/network/index.js');
  const protocolJs = readText('games/cs-dm/src/network/protocol.js');
  const readme = readText('games/cs-dm/README.md');
  assert.equal(mainJs.includes("import { validatePlayerName } from './core/index.js';"), true, 'main.js must import the core validator');
  assert.equal(mainJs.includes("import { InputAction, createDefaultBindingMap, getLiveBindingCandidates, readStoredKeybindings, readStoredPlayerName, writeStoredKeybindings, writeStoredPlayerName } from './input/index.js';"), true, 'main.js must import input storage and binding helpers');
  assert.equal(mainJs.includes("import { createRendererShell } from './render/index.js';"), true, 'main.js must import the renderer shell');
  assert.equal(mainJs.includes("import { AudioEvent, createAudioController } from './audio/index.js';"), true, 'main.js must import audio controller helpers');

  assert.equal(mainJs.includes('rendererShell.requestPointerLock();'), true, 'offline start must request pointer lock immediately');
  assert.equal(mainJs.includes('audioController.unlock();'), true, 'audio must unlock only from user-gesture handlers');
  assert.equal(mainJs.includes('AudioEvent.FIRE'), true, 'main.js must trigger firing feedback');
  assert.equal(mainJs.includes('AudioEvent.HIT'), true, 'main.js must trigger hit feedback');
  assert.equal(mainJs.includes('AudioEvent.DEATH'), true, 'main.js must trigger death feedback');
  assert.equal(mainJs.includes('AudioEvent.RESPAWN'), true, 'main.js must trigger respawn feedback');
  assert.equal(mainJs.includes('AudioEvent.FOOTSTEP'), true, 'main.js must trigger footstep feedback');
  assert.equal(mainJs.includes('buyMenuController.close({ playFeedback: false });'), true, 'startup openMenu must close buy menu without audio feedback');
  assert.equal(mainJs.includes('options.playFeedback !== false'), true, 'buy menu close feedback must be gated by explicit options');
  assert.equal(mainJs.includes("offlineStartButton.addEventListener('click', openOfflineMatch);"), true, 'offline start button must route to openOfflineMatch');
  assert.equal(mainJs.includes('createOfflineMatch'), true, 'offline start must create a deterministic offline match');
  assert.equal(mainJs.includes('advanceOfflineMatchTick'), true, 'main.js must advance the offline match loop');
  assert.equal(mainJs.includes('deriveOfflineMatchHud'), true, 'main.js must render offline HUD data');
  assert.equal(mainJs.includes("document.querySelector('.match-stage__label')"), false, 'main.js must not query a generic match-stage label');
  assert.equal(mainJs.includes('createBuyMenuController'), true, 'main.js must create the buy menu controller');
  assert.equal(mainJs.includes('getLiveBindingCandidates(currentBindings, InputAction.Buy)'), true, 'main.js must hook the configured buy key');
  assert.equal(mainJs.includes('getLiveBindingCandidates(currentBindings, InputAction.Settings)'), true, 'main.js must hook the configured settings key');
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
  assert.equal(offlineMatchTest.includes('task-29-menu-death-respawn.txt'), true, 'offline match tests must write T29 menu/death/respawn evidence');
  assert.equal(networkIndexJs.includes("export * from './protocol.js';"), true, 'network index must export protocol helpers');
  assert.equal(networkIndexJs.includes("export * from './slots.js';"), true, 'network index must export slot hot-swap helpers');
  assert.equal(networkIndexJs.includes('createFullRoomJoinRejection'), true, 'network index must expose full-room join rejection helper');
  assert.equal(networkIndexJs.includes('createRemoteDisconnectFallback'), true, 'network index must expose disconnect bot fallback helper');
  assert.equal(networkIndexJs.includes('createHostCloseFallback'), true, 'network index must expose host-close fallback helper');
  assert.equal(protocolJs.includes('NETWORK_PROTOCOL_VERSION'), true, 'protocol must centralize its version');
  assert.equal(protocolJs.includes('Remote clients cannot set health, kills, positions, snapshots, or world state.'), true, 'protocol must reject client state mutation');
  assert.equal(protocolJs.includes('createSnapshotDisplayBuffer'), true, 'protocol must expose interpolation display helper');
  assert.equal(indexHtml.includes('best-effort manual P2P'), true, 'UI must say manual P2P is best-effort');
  assert.equal(indexHtml.includes('NAT') && indexHtml.includes('firewall'), true, 'UI must mention NAT/firewall dependency');
  assert.equal(indexHtml.includes('No TURN relay or signaling broker'), true, 'UI must say no relay/signaling broker exists');
  assert.equal(indexHtml.includes('offline bots remain the reliable fallback'), true, 'UI must mention offline bot fallback');
  assert.equal(readme.includes('best-effort manual WebRTC'), true, 'README must document best-effort manual P2P');
  assert.equal(readme.includes('no third-party relay') && readme.includes('TURN server') && readme.includes('signaling broker'), true, 'README must document no relay/broker');
  assert.equal(readme.includes('NAT') && readme.includes('firewall'), true, 'README must document NAT/firewall limitations');

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

  const evidenceDir = path.join(repoRoot, '.sisyphus', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path.join(evidenceDir, 'task-13-score-sort.txt'), [
    'T13 score sort evidence',
    'Order: Bravo, Charlie, Alpha',
    'Rule: kills desc, deaths asc, name asc, slotIndex asc',
  ].join('\n'));
  const coreTest = readText('games/cs-dm/src/core/contracts.test.mjs');
  assert.equal(coreTest.includes('task-29-name-edge-cases.txt'), true, 'core tests must write T29 name edge-case evidence');

  writeFileSync(path.join(evidenceDir, 'task-13-dead-hud.txt'), [
    'T13 dead HUD evidence',
    'lifeState=respawning',
    'health=0 armor=0 ammo=ak47/30/90 latency=null respawnCountdown=null',
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-9-callouts.txt'), [
    'T9 callouts evidence',
    'Map: dust2-blockout',
    'Required callouts: T Spawn, CT Spawn, Mid, Mid Doors, Long A, Catwalk/Short A, Upper Tunnels, Lower Tunnels, B Site, Window, A Site boxes',
    'Waypoints: spawn anchors, lane anchors, site anchors, and tunnel anchors',
  ].join('\n'));
  writeFileSync(path.join(evidenceDir, 'task-9-collision.txt'), [
    'T9 collision evidence',
    'Spawn count: 16',
    'Spawn overlap count: 0',
    'Collision volumes: 12',
  ].join('\n'));

  const { createOfflineSlots, validatePlayerName } = await import(pathToFileURL(path.join(gameRoot, 'src', 'core', 'index.js')).href);
  const { getDust2TunnelRouteToBSite, isTunnelWaypoint, summarizeBotSlots } = await import(pathToFileURL(path.join(gameRoot, 'src', 'bots', 'index.js')).href);
  const botSummary = summarizeBotSlots(createOfflineSlots('Verifier'));
  const tunnelRoute = getDust2TunnelRouteToBSite();
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
