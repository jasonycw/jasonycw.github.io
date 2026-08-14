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
import { buildMapRenderGeometry } from '../render/mapGeometry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');
const evidenceDir = path.join(repoRoot, '.sisyphus', 'evidence');

const requiredCallouts = [
  'T Spawn',
  'CT Spawn',
  'Middle',
  'Mid Doors',
  'Xbox',
  'Long A',
  'Long Doors',
  'Short A / Catwalk',
  'Upper Tunnels',
  'Lower Tunnels',
  'B Tunnels',
  'A Site',
  'B Site',
  'B Doors',
  'Window',
  'A Site Boxes',
];

const requiredTourNames = ['Middle', 'Long A', 'Upper Tunnels', 'A Site', 'B Site'];

const waypointById = (id) => MAP_WAYPOINTS.find((waypoint) => waypoint.id === id);

const requiredVisualRoles = ['crates', 'doors', 'ramps', 'tunnels', 'siteMarkings', 'arches', 'ledges'];

const tests = [
  ['exports original three-lane desert tactical map data', () => {
    assert.equal(MAP_NAME, 'Dust II');
    assert.equal(MAP_CALLOUTS.length >= requiredCallouts.length, true);
    assert.equal(MAP_COLLISION_VOLUMES.length >= 10, true);
    assert.equal(MAP_GEOMETRY_PRIMITIVES.length >= 30, true);
    assert.equal(MAP_WAYPOINTS.length >= 10, true);
    assert.equal(MAP_DEBUG_FLAGS.showCollisionVolumes, false);
    assert.equal(MAP_DEBUG_OVERLAY.enabled, false);
  }],

  ['includes the required Dust II clean-room callouts', () => {
    const calloutNames = new Set(MAP_CALLOUTS.map((callout) => callout.callout));
    for (const requiredCallout of requiredCallouts) {
      assert.equal(calloutNames.has(requiredCallout), true, `${requiredCallout} should exist`);
    }
    assert.equal(MAP_LANDMARKS.A_SITE_BOXES.callout, 'A Site Boxes');
    assert.equal(calloutNames.has('Xbox'), true);
    assert.equal(MAP_NAME, 'Dust II');
    assert.equal(MAP_VISUAL_STYLE.tone.includes('three-lane desert combat map'), true);
  }],

  ['keeps 16 spawn points clear of collision volumes', () => {
    assert.equal(MAP_SPAWN_POINTS.length, 16);
    const overlaps = getSpawnCollisionOverlaps();
    assert.deepEqual(overlaps, []);
  }],

  ['links route anchors through long mid catwalk and tunnel tactical lanes', () => {
    assert.equal(MAP_ROUTE_GRAPH.anchors.length, MAP_WAYPOINTS.length);
    assert.equal(MAP_ROUTE_GRAPH.debugTourTargets, MAP_DEBUG_TOUR_TARGETS);
    const midDoors = waypointById('wp-mid-doors');
    const xbox = waypointById('wp-xbox');
    const upperTunnels = waypointById('wp-upper-tunnels');
    const bSite = waypointById('wp-b-site');
    const ctSpawn = waypointById('wp-ct-spawn');

    assert.equal(midDoors.links.includes('wp-long-a-doors'), true);
    assert.equal(midDoors.links.includes('wp-window'), true);
    assert.equal(xbox.links.includes('wp-short-a'), true);
    assert.equal(upperTunnels.links.includes('wp-b-tunnels'), true);
    assert.equal(bSite.links.includes('wp-b-doors'), true);
    assert.equal(ctSpawn.links.includes('wp-a-site-boxes'), true);
  }],

  ['describes original visual style materials for readable landmarks', () => {
    assert.match(MAP_VISUAL_STYLE.provenance, /Original generated homage descriptors only/);
    assert.equal(MAP_VISUAL_STYLE.provenance.includes('copied Counter-Strike'), true);
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
    const primitiveKinds = new Set(MAP_GEOMETRY_PRIMITIVES.map((primitive) => primitive.kind));
    for (const kind of ['doorway', 'doorframe', 'arch', 'ramp', 'cover', 'ledge', 'site-marking']) {
      assert.equal(primitiveKinds.has(kind), true, `${kind} geometry should be present`);
    }
  }],

  ['keeps non-boundary collision volumes represented by visible render blockers', () => {
    const renderGeometry = buildMapRenderGeometry({ collisionVolumes: MAP_COLLISION_VOLUMES, geometryPrimitives: MAP_GEOMETRY_PRIMITIVES });
    const missingVisibleBlockers = MAP_COLLISION_VOLUMES
      .slice(4)
      .filter((volume) => !renderGeometry.blockers.some((blocker) => blocker.collisionVolume === volume && blocker.mapCenter === volume.center));

    assert.deepEqual(missingVisibleBlockers, []);
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
