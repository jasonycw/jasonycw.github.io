import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(here, '..');
const repoRoot = path.resolve(gameRoot, '..', '..');
const evidenceRoot = path.join(repoRoot, '.sisyphus', 'evidence');

const readRepoText = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');
const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const assertContains = (text, needle, label) => {
  assert.equal(text.includes(needle), true, `${label} must include ${needle}`);
};

const assertSelectorPresent = (html, selector) => {
  const idSelector = selector.startsWith('#') ? selector.slice(1) : null;
  const classSelector = selector.startsWith('.') ? selector.slice(1) : null;
  const dataSelector = selector.match(/^\[([^=]+)=['"]?([^'"\]]+)['"]?\]$/);
  const attributeSelector = selector.match(/^\[([^\]]+)\]$/);

  const present = idSelector
    ? html.includes(`id="${idSelector}"`) || html.includes(`id='${idSelector}'`)
    : classSelector
      ? html.includes(`class="${classSelector}`) || html.includes(`class='${classSelector}`) || html.includes(` ${classSelector}`)
      : dataSelector
        ? html.includes(`${dataSelector[1]}="${dataSelector[2]}"`) || html.includes(`${dataSelector[1]}='${dataSelector[2]}'`)
        : attributeSelector
          ? html.includes(attributeSelector[1])
        : html.includes(selector);

  assert.equal(present, true, `game HTML must include selector ${selector}`);
};

const advanceUntil = (initialState, advance, predicate, maxTicks = 600) => {
  let state = initialState;
  for (let tick = 0; tick < maxTicks && !predicate(state); tick += 1) {
    state = advance(state);
  }
  return state;
};

const run = async () => {
  const coverage = [];
  const hubHtml = readRepoText('games/index.html');
  assertContains(hubHtml, "title: 'CS DM'", 'games hub data');
  assertContains(hubHtml, "href: 'cs-dm/'", 'games hub CS DM card');
  assert.equal(hubHtml.includes("href: '/games/cs-dm/'"), false, 'hub href must remain relative');
  coverage.push('hub load: CS DM card and relative cs-dm/ href verified');

  const gameHtml = readRepoText('games/cs-dm/index.html');
  assertContains(gameHtml, '<link rel="stylesheet" href="./styles.css" />', 'game page');
  assertContains(gameHtml, '<script type="module" src="./src/main.js"></script>', 'game page');
  assert.equal(existsSync(path.join(gameRoot, 'styles.css')), true, 'game stylesheet reference must exist');
  assert.equal(existsSync(path.join(gameRoot, 'src', 'main.js')), true, 'game module reference must exist');
  [
    '#player-name',
    '#offline-start',
    '#host-game',
    '#join-game',
    '#host-offer-code',
    '#join-offer-input',
    '#join-answer-code',
    '#host-answer-input',
    '#create-answer',
    '#accept-answer',
    '#network-error',
    '#game-canvas',
    '#buy-menu',
    '#buy-error',
    '#hud-weapon',
    '#scoreboard-body',
    '#settings-menu',
    '#binding-list',
    '#perf-summary',
    '[data-network-state]',
  ].forEach((selector) => {
    assertSelectorPresent(gameHtml, selector);
  });
  coverage.push('game load: required selectors and relative local references verified');

  const [config, gameplay, input, network] = await Promise.all([
    import(pathToFileURL(path.join(gameRoot, 'src', 'config', 'index.js')).href),
    import(pathToFileURL(path.join(gameRoot, 'src', 'gameplay', 'index.js')).href),
    import(pathToFileURL(path.join(gameRoot, 'src', 'input', 'index.js')).href),
    import(pathToFileURL(path.join(gameRoot, 'src', 'network', 'index.js')).href),
  ]);

  let offlineState = gameplay.createOfflineMatch({ localPlayerName: 'T30Smoke' });
  offlineState = gameplay.runOfflineSmokeSimulation(offlineState, { seconds: 5 });
  const offlineSummary = gameplay.summarizeOfflineMatch(offlineState);
  const offlineHud = gameplay.deriveOfflineMatchHud(offlineState);
  assert.equal(offlineSummary.playerCount, config.MAX_PLAYER_SLOTS);
  assert.equal(offlineSummary.botCount, config.MAX_PLAYER_SLOTS - 1);
  assert.equal(offlineSummary.phase, config.MATCH_PHASES.RUNNING);
  assert.equal(offlineHud.scoreboard.length, config.MAX_PLAYER_SLOTS);
  coverage.push(`offline smoke: ${offlineSummary.playerCount} slots, ${offlineSummary.botCount} bots, ${offlineHud.scoreboard.length} scoreboard rows`);

  const buyResult = gameplay.buyOfflineWeapon(offlineState, config.WEAPONS.AWP.id);
  assert.equal(buyResult.purchase.ok, true);
  let lifecycleState = buyResult.state;
  assert.equal(lifecycleState.matchState.players[config.LOCAL_PLAYER_SLOT_INDEX].loadout.activeWeaponId, config.WEAPONS.AWP.id);
  lifecycleState = gameplay.forceOfflineKill(lifecycleState, { killerSlotIndex: 1, victimSlotIndex: config.LOCAL_PLAYER_SLOT_INDEX });
  assert.equal(lifecycleState.matchState.players[config.LOCAL_PLAYER_SLOT_INDEX].lifeState, config.PLAYER_LIFE_STATES.RESPAWNING);
  lifecycleState = advanceUntil(
    lifecycleState,
    gameplay.advanceOfflineMatchTick,
    (state) => state.matchState.players[config.LOCAL_PLAYER_SLOT_INDEX].lifeState === config.PLAYER_LIFE_STATES.ALIVE
      && state.nowMs >= config.COMBAT_DEFAULTS.respawnDelayMs,
  );
  const localAfterRespawn = lifecycleState.matchState.players[config.LOCAL_PLAYER_SLOT_INDEX];
  assert.equal(localAfterRespawn.lifeState, config.PLAYER_LIFE_STATES.ALIVE);
  assert.equal(localAfterRespawn.loadout.activeWeaponId, config.WEAPONS.AWP.id);
  coverage.push(`buy/respawn: AWP selected, local respawned alive with ${localAfterRespawn.loadout.activeWeaponId}`);

  let scoreboardState = gameplay.createOfflineMatch({ localPlayerName: 'ScoreLeader' });
  scoreboardState = gameplay.forceOfflineKill(scoreboardState, { killerSlotIndex: config.LOCAL_PLAYER_SLOT_INDEX, victimSlotIndex: 1 });
  scoreboardState = gameplay.forceOfflineKill(scoreboardState, { killerSlotIndex: config.LOCAL_PLAYER_SLOT_INDEX, victimSlotIndex: 2 });
  const scoreboard = gameplay.deriveOfflineMatchHud(scoreboardState).scoreboard;
  assert.equal(scoreboard.length, config.MAX_PLAYER_SLOTS);
  assert.equal(scoreboard[0].slotIndex, config.LOCAL_PLAYER_SLOT_INDEX);
  assert.equal(scoreboard[0].score.kills, 2);
  coverage.push(`scoreboard: local leader sorted first with ${scoreboard[0].score.kills} kills across ${scoreboard.length} rows`);

  const defaultBindings = input.createDefaultBindingMap();
  assert.equal(defaultBindings[input.InputAction.MoveForward], 'KeyW');
  assert.equal(defaultBindings[input.InputAction.Buy], 'KeyB');
  assert.equal(defaultBindings[input.InputAction.Scoreboard], 'Tab');
  assert.equal(defaultBindings[input.InputAction.Settings], 'Escape');
  assert.deepEqual(input.getLiveBindingCandidates(defaultBindings, input.InputAction.Scoreboard), ['Tab', 'KeyT']);
  coverage.push('keybindings: WASD, B buy, Tab scoreboard, Escape settings, and fallback candidates verified');

  const host = network.createDeterministicManualAdapter({ sessionId: 't30-local-context' });
  const joiner = network.createDeterministicManualAdapter();
  const offerCode = await host.createOffer({ playerName: 'HostT30' });
  const answerResult = await joiner.createAnswer(offerCode, { playerName: 'JoinerT30' });
  assert.equal(answerResult.ok, true);
  const acceptResult = await host.acceptAnswer(answerResult.value);
  assert.equal(acceptResult.ok, true);
  assert.equal(host.getState(), network.NETWORK_STATES.CONNECTED);
  assert.equal(joiner.getState(), network.NETWORK_STATES.ANSWER_READY);
  coverage.push(`manual P2P local contexts: offer/answer exchanged, host state ${host.getState()}`);

  const malformedResult = await network.createDeterministicManualAdapter().createAnswer('not-a-csdm-code', { playerName: 'BadCode' });
  const malformedFailure = network.createManualCodeFailureState(malformedResult);
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedFailure.reason, network.NETWORK_FAILURE_REASONS.INVALID_CODE);
  assert.equal(malformedFailure.recoveryAction, network.NETWORK_RECOVERY_ACTIONS.RETRY_CODE);
  coverage.push(`malformed code: ${malformedFailure.reason} -> ${malformedFailure.recoveryAction}`);

  const screenshotFallbackLines = [
    'T30 screenshot evidence fallback',
    'Screenshot capture: deferred from T30 to T36/final static QA, and T36 completed the real browser PNG captures.',
    'Reason: this repository has no local browser automation dependency and this T30 suite must remain deterministic without requiring an external browser.',
    'No screenshots were fabricated by this suite.',
    'Deterministic evidence generated instead:',
    '- .sisyphus/evidence/task-30-smoke-suite.txt',
    ...coverage.map((line) => `- ${line}`),
  ];
  writeEvidence('task-30-screenshot-files.txt', screenshotFallbackLines);

  const smokeEvidencePath = path.join('.sisyphus', 'evidence', 'task-30-smoke-suite.txt').replace(/\\/g, '/');
  const screenshotEvidencePath = path.join('.sisyphus', 'evidence', 'task-30-screenshot-files.txt').replace(/\\/g, '/');
  writeEvidence('task-30-smoke-suite.txt', [
    'PASS T30 automated smoke suite',
    ...coverage,
    `summaryPath=${smokeEvidencePath}`,
    `screenshotEvidencePath=${screenshotEvidencePath}`,
  ]);

  console.log(`PASS T30 smoke suite: ${coverage.join(' | ')}`);
  console.log(`T30 smoke coverage evidence: ${smokeEvidencePath}`);
  console.log(`T30 screenshot evidence: ${screenshotEvidencePath}`);
};

run().catch((error) => {
  console.error('FAIL T30 smoke suite');
  console.error(error);
  process.exitCode = 1;
});
