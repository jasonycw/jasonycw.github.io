import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAP_COLLISION_VOLUMES, MAP_GEOMETRY_PRIMITIVES } from '../map/index.js';
import { MAP_SCENE_SCALE, buildMapRenderGeometry, mapToScenePosition } from './mapGeometry.js';
import { createRendererFallbackState, getSafeViewportSize, hasUsableWebGL } from './state.js';

const rendererSource = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('./index.js', import.meta.url), 'utf8'));

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

  ['exposes live match state update hooks for browser gameplay', () => {
    assert.equal(rendererSource.includes('updateMatchState'), true);
    assert.equal(rendererSource.includes('controllersBySlotIndex'), true);
    assert.equal(rendererSource.includes('muzzleFlash'), true);
    assert.equal(rendererSource.includes('buildWeaponLayerModel'), true);
    assert.equal(rendererSource.includes('buildWorldWeaponGroup'), true);
    assert.equal(rendererSource.includes('WEAPON_MODEL_LAYERS.WORLD'), true);
    assert.equal(rendererSource.includes("source: 'WEAPON_MODEL_LAYERS.WORLD'"), true);
    assert.equal(rendererSource.includes('buildViewModelGroup'), true);
    assert.equal(rendererSource.includes('activeViewModelWeaponId'), true);
    assert.equal(rendererSource.includes('viewModelRenderer'), true);
    assert.equal(rendererSource.includes('match-stage__viewmodel-canvas'), true);
    assert.equal(rendererSource.includes('new THREE.PerspectiveCamera(VIEWMODEL_CAMERA_ALIGNMENT.camera.fovDegrees'), true);
    assert.equal(rendererSource.includes('viewModelCamera.lookAt(0, 0, -1)'), true);
    assert.equal(rendererSource.includes('viewModelCamera.aspect = width / height'), true);
    assert.equal(rendererSource.includes('viewModelRenderer.render(viewModelScene, viewModelCamera)'), true);
    assert.equal(rendererSource.includes('VIEWMODEL_CAMERA_ALIGNMENT'), true);
    assert.equal(rendererSource.includes('cameraAlignment: VIEWMODEL_CAMERA_ALIGNMENT'), true);
    assert.equal(rendererSource.includes('child.material.depthTest = false'), true);
    assert.equal(rendererSource.includes('child.material.depthWrite = false'), true);
    assert.equal(rendererSource.includes('player.visible = slot.lifeState === \'alive\''), true);
    assert.equal(rendererSource.includes("new THREE.MeshStandardMaterial({ color: '#141514'"), false, 'world player guns must not be hard-coded placeholder bars');
  }],

  ['builds visible map blockers from collision volumes with the shared scene transform', () => {
    const geometry = buildMapRenderGeometry();
    const midDoorCollision = MAP_COLLISION_VOLUMES[4];
    const midDoorBlocker = geometry.blockers.find((blocker) => blocker.collisionVolume === midDoorCollision);
    const mappedMidDoor = mapToScenePosition(midDoorCollision.center);

    assert.equal(geometry.blockers.length, MAP_COLLISION_VOLUMES.length);
    assert.equal(geometry.primitives.length > MAP_GEOMETRY_PRIMITIVES.length, true, 'arch and doorframe primitives should expand into richer render descriptors');
    assert.equal(Boolean(midDoorBlocker), true, 'mid doors collision volume should have a visible blocker');
    assert.equal(midDoorBlocker.position.x, mappedMidDoor.x);
    assert.equal(midDoorBlocker.position.z, mappedMidDoor.z);
    assert.equal(midDoorBlocker.size.x, Number((midDoorCollision.size.width / MAP_SCENE_SCALE).toFixed(6)));
    assert.equal(midDoorBlocker.size.z, Number((midDoorCollision.size.depth / MAP_SCENE_SCALE).toFixed(6)));
    assert.equal(midDoorBlocker.kind, 'blocking-box');
    assert.equal(midDoorBlocker.visualRole, 'doors');
    assert.equal(geometry.primitives.some((primitive) => primitive.id === 'mid-door-arch-top-cap' && primitive.visualRole === 'arches'), true);
    assert.equal(geometry.primitives.some((primitive) => primitive.kind === 'ledge' && primitive.visualRole === 'ledges'), true);

    writeEvidence('task-map-render-geometry.txt', [
      'CS DM map/render geometry evidence',
      `collisionBlockers=${geometry.blockers.length}`,
      `geometryPrimitives=${geometry.primitives.length}`,
      `scale=${geometry.scale}`,
      `midDoorMap=${midDoorCollision.center.x},${midDoorCollision.center.z}`,
      `midDoorScene=${midDoorBlocker.position.x},${midDoorBlocker.position.z}`,
    ]);
  }],

  ['renderer source uses shared map data instead of detached decorative fake walls', () => {
    assert.equal(rendererSource.includes('MAP_COLLISION_VOLUMES'), true);
    assert.equal(rendererSource.includes('MAP_GEOMETRY_PRIMITIVES'), true);
    assert.equal(rendererSource.includes('buildMapRenderGeometry'), true);
    assert.equal(rendererSource.includes('mapSource: descriptor.kind === \'blocking-box\' ? \'MAP_COLLISION_VOLUMES\' : \'MAP_GEOMETRY_PRIMITIVES\''), true);
    assert.equal(rendererSource.includes('const leftWall'), false);
    assert.equal(rendererSource.includes('const rightWall'), false);
    assert.equal(rendererSource.includes('const farCrate'), false);
    assert.equal(rendererSource.includes('const archTop'), false);
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
