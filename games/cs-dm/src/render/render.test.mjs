import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRendererFallbackState, getSafeViewportSize, hasUsableWebGL } from './state.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceRoot = path.resolve(here, '..', '..', '..', '..', '.sisyphus', 'evidence');

const writeEvidence = (fileName, lines) => {
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(path.join(evidenceRoot, fileName), `${lines.join('\n')}\n`, 'utf8');
};

const tests = [
  ['detects unavailable WebGL without hiding the specific fallback state', () => {
    const unsupportedEnvironment = {
      WebGLRenderingContext: null,
      document: {
        createElement() {
          return { getContext: () => null };
        },
      },
    };
    const mount = { clientWidth: 0, clientHeight: 0 };
    const fallback = createRendererFallbackState({ mount });

    assert.equal(hasUsableWebGL(unsupportedEnvironment), false);
    assert.equal(fallback.ok, false);
    assert.equal(fallback.reason, 'webgl-unavailable');
    assert.equal(fallback.recoverable, true);
    assert.deepEqual(fallback.viewport, { width: 1, height: 1 });
  }],

  ['normalizes resize dimensions for zero hidden and fullscreen-like mounts', () => {
    const hidden = getSafeViewportSize({ clientWidth: 0, clientHeight: 0 });
    const panel = getSafeViewportSize({ clientWidth: 960.8, clientHeight: 540.2 });
    const fullscreen = getSafeViewportSize({ clientWidth: 1920, clientHeight: 1080 });

    assert.deepEqual(hidden, { width: 1, height: 1 });
    assert.deepEqual(panel, { width: 960, height: 540 });
    assert.deepEqual(fullscreen, { width: 1920, height: 1080 });

    writeEvidence('task-29-resize.txt', [
      'T29 resize/WebGL fallback evidence',
      `hiddenViewport=${hidden.width}x${hidden.height}`,
      `panelViewport=${panel.width}x${panel.height}`,
      `fullscreenViewport=${fullscreen.width}x${fullscreen.height}`,
      'Resize path clamps hidden/background-tab dimensions to at least 1x1 and preserves fullscreen-sized canvas math.',
      'WebGL fallback state remains specific to #webgl-error through createRendererShell and does not query generic .match-stage__label.',
    ]);
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS render hardening - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL render hardening - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
