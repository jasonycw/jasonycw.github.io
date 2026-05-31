import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAP_CALLOUTS,
  MAP_COLLISION_VOLUMES,
  MAP_DEBUG_TOUR_TARGETS,
  MAP_DEBUG_FLAGS,
  MAP_DEBUG_OVERLAY,
  MAP_GEOMETRY_PRIMITIVES,
  MAP_LANDMARKS,
  MAP_MATERIALS,
  MAP_NAME,
  MAP_ROUTE_GRAPH,
  MAP_SPAWN_POINTS,
  MAP_VISUAL_STYLE,
  MAP_WAYPOINTS,
  getSpawnCollisionOverlaps,
} from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');
const evidenceDir = path.join(repoRoot, '.sisyphus', 'evidence');

const requiredCallouts = [
  'T Spawn',
  'CT Spawn',
  'Mid',
  'Mid Doors',
  'Long A',
  'Catwalk/Short A',
  'Upper Tunnels',
  'Lower Tunnels',
  'A Site',
  'B Site',
  'Window',
  'A Site boxes',
];

const requiredTourNames = ['Mid', 'Long A', 'Tunnels', 'A Site', 'B Site'];

const requiredVisualRoles = ['crates', 'doors', 'ramps', 'tunnels', 'siteMarkings'];

const tests = [
  ['exports Dust2 blockout map data', () => {
    assert.equal(MAP_NAME, 'Dust2 Blockout');
    assert.equal(MAP_CALLOUTS.length >= requiredCallouts.length, true);
    assert.equal(MAP_COLLISION_VOLUMES.length >= 10, true);
    assert.equal(MAP_GEOMETRY_PRIMITIVES.length >= 8, true);
    assert.equal(MAP_WAYPOINTS.length >= 10, true);
    assert.equal(MAP_DEBUG_FLAGS.showCollisionVolumes, false);
    assert.equal(MAP_DEBUG_OVERLAY.enabled, false);
  }],

  ['includes the required Dust2-style callouts', () => {
    const calloutNames = new Set(MAP_CALLOUTS.map((callout) => callout.callout));
    for (const requiredCallout of requiredCallouts) {
      assert.equal(calloutNames.has(requiredCallout), true, `${requiredCallout} should exist`);
    }
    assert.equal(MAP_LANDMARKS.A_SITE_BOXES.callout, 'A Site boxes');
  }],

  ['keeps 16 spawn points clear of collision volumes', () => {
    assert.equal(MAP_SPAWN_POINTS.length, 16);
    const overlaps = getSpawnCollisionOverlaps();
    assert.deepEqual(overlaps, []);
  }],

  ['links route anchors through Dust2-style lanes', () => {
    assert.equal(MAP_ROUTE_GRAPH.anchors.length, MAP_WAYPOINTS.length);
    assert.equal(MAP_ROUTE_GRAPH.debugTourTargets, MAP_DEBUG_TOUR_TARGETS);
    const midDoors = MAP_WAYPOINTS.find((waypoint) => waypoint.id === 'wp-mid-doors');
    assert.equal(midDoors.links.includes('wp-long-a'), true);
    assert.equal(midDoors.links.includes('wp-window'), true);
  }],

  ['describes original visual style materials for readable landmarks', () => {
    assert.match(MAP_VISUAL_STYLE.provenance, /Generated placeholder descriptors only/);
    assert.equal(MAP_MATERIALS.SITE_PAINT.texture.startsWith('./assets/textures/'), true);

    for (const role of requiredVisualRoles) {
      const roleMetadata = MAP_VISUAL_STYLE.materialRoles[role];
      assert.equal(Boolean(roleMetadata), true, `${role} style metadata should exist`);
      assert.equal(Object.values(MAP_MATERIALS).some((material) => material.id === roleMetadata.material), true, `${role} material should resolve`);
      assert.equal(typeof roleMetadata.readableStyle, 'string');
    }

    const primitiveRoles = new Set(MAP_GEOMETRY_PRIMITIVES.map((primitive) => primitive.visualRole));
    for (const role of requiredVisualRoles) {
      assert.equal(primitiveRoles.has(role), true, `${role} should be used by map geometry`);
    }
  }],

  ['registers visual landmark debug tour targets', () => {
    const tourNames = new Set(MAP_DEBUG_TOUR_TARGETS.map((target) => target.name));
    for (const requiredTourName of requiredTourNames) {
      assert.equal(tourNames.has(requiredTourName), true, `${requiredTourName} tour target should exist`);
    }

    for (const target of MAP_DEBUG_TOUR_TARGETS) {
      const landmark = Object.values(MAP_LANDMARKS).find((entry) => entry.id === target.landmarkId);
      assert.equal(Boolean(landmark), true, `${target.id} should reference a landmark`);
      assert.equal(landmark.debugTourId, target.id, `${target.name} landmark should point back to its tour target`);
      assert.equal(Boolean(MAP_VISUAL_STYLE.materialRoles[target.materialRole]), true, `${target.name} should use a known visual role`);
      assert.equal(target.screenshotTarget.endsWith('-debug-tour'), true, `${target.name} should name a screenshot target`);
    }

    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(path.join(evidenceDir, 'task-15-landmark-tour.txt'), [
      'T15 landmark debug tour evidence',
      'Screenshot capture: not captured in this static verification run; debug camera/tour targets are deterministic metadata targets only.',
      ...MAP_DEBUG_TOUR_TARGETS.map((target) => `${target.name}: ${target.id} -> ${target.screenshotTarget} @ ${target.camera.position.x},${target.camera.position.y},${target.camera.position.z}`),
    ].join('\n'));
  }],
];

let failures = 0;

for (const [name, runTest] of tests) {
  try {
    runTest();
    console.log(`PASS map blockout - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL map blockout - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
