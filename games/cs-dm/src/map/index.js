import { FACTIONS, SPAWN_REFERENCES } from '../config/index.js';

const freezePoint = (x, y, z) => Object.freeze({ x, y, z });

const freezeCamera = (x, y, z, yaw, pitch) => Object.freeze({
  position: freezePoint(x, y, z),
  yaw,
  pitch,
});

const freezeBox = (x, y, z, width, height, depth) => Object.freeze({
  kind: 'box',
  center: freezePoint(x, y, z),
  size: Object.freeze({ width, height, depth }),
});

const freezeWaypoints = (entries) => Object.freeze(entries.map((entry) => Object.freeze({
  id: entry.id,
  calloutId: entry.calloutId,
  position: freezePoint(entry.position.x, entry.position.y, entry.position.z),
  links: Object.freeze([...entry.links]),
})));

export const MAP_ID = 'dust2-blockout';
export const MAP_NAME = 'Dust2 Blockout';

export const MAP_DEBUG_FLAGS = Object.freeze({
  showCallouts: false,
  showCollisionVolumes: false,
  showRouteGraph: false,
  showSpawnPoints: false,
  showWaypointAnchors: false,
});

export const MAP_DEBUG_OVERLAY = Object.freeze({
  enabled: false,
  calloutColor: '#f4d03f',
  collisionColor: '#d35400',
  routeColor: '#3498db',
  spawnColor: '#2ecc71',
  waypointColor: '#9b59b6',
});

export const MAP_MATERIALS = Object.freeze({
  CONCRETE: Object.freeze({ id: 'concrete', label: 'weathered concrete', tint: '#7f8c8d', texture: './assets/textures/generated-concrete-plaster.md' }),
  SANDSTONE: Object.freeze({ id: 'sandstone', label: 'dusty sandstone', tint: '#c8a25d', texture: './assets/textures/generated-sandstone-plaster.md' }),
  METAL: Object.freeze({ id: 'metal', label: 'painted metal', tint: '#95a5a6', texture: './assets/textures/generated-painted-metal.md' }),
  WOOD: Object.freeze({ id: 'wood', label: 'battered wood', tint: '#8e5a2b', texture: './assets/textures/generated-crate-wood.md' }),
  GLASS: Object.freeze({ id: 'glass', label: 'sun-faded glass', tint: '#a9d6e5', texture: './assets/textures/generated-sun-faded-glass.md' }),
  SITE_PAINT: Object.freeze({ id: 'site-paint', label: 'chalky bombsite paint', tint: '#f1c75b', texture: './assets/textures/generated-site-markings.md' }),
});

export const MAP_VISUAL_STYLE = Object.freeze({
  palette: Object.freeze({
    sand: '#c8a25d',
    sunBleachedStone: '#d8bd84',
    militaryOlive: '#6f7350',
    oxidizedMetal: '#7f8c8d',
    siteMarking: '#f1c75b',
  }),
  tone: 'original sandy desert military blockout with high-readability lane colors',
  provenance: 'Generated placeholder descriptors only; no copied Counter-Strike textures, screenshots, meshes, or remote images.',
  materialRoles: Object.freeze({
    crates: Object.freeze({ material: MAP_MATERIALS.WOOD.id, readableStyle: 'warm battered crate wood with high-contrast bevel tint' }),
    doors: Object.freeze({ material: MAP_MATERIALS.METAL.id, readableStyle: 'cool painted metal panels for mid-door silhouettes' }),
    ramps: Object.freeze({ material: MAP_MATERIALS.CONCRETE.id, readableStyle: 'sun-washed concrete ramp faces with sandy edge wear' }),
    tunnels: Object.freeze({ material: MAP_MATERIALS.SANDSTONE.id, readableStyle: 'darker sandy tunnel plaster to separate enclosed routes' }),
    siteMarkings: Object.freeze({ material: MAP_MATERIALS.SITE_PAINT.id, readableStyle: 'chalky yellow site letters and boundary strokes on the floor' }),
  }),
});

export const MAP_LANDMARKS = Object.freeze({
  T_SPAWN: Object.freeze({ id: 't-spawn', name: 'T Spawn', callout: 'T Spawn', position: freezePoint(12, 0, 88) }),
  CT_SPAWN: Object.freeze({ id: 'ct-spawn', name: 'CT Spawn', callout: 'CT Spawn', position: freezePoint(88, 0, 12) }),
  MID: Object.freeze({ id: 'mid', name: 'Mid', callout: 'Mid', position: freezePoint(50, 0, 50), visualRole: 'doors', debugTourId: 'tour-mid' }),
  MID_DOORS: Object.freeze({ id: 'mid-doors', name: 'Mid Doors', callout: 'Mid Doors', position: freezePoint(58, 0, 50) }),
  LONG_A: Object.freeze({ id: 'long-a', name: 'Long A', callout: 'Long A', position: freezePoint(78, 0, 72), visualRole: 'ramps', debugTourId: 'tour-long-a' }),
  SHORT_A: Object.freeze({ id: 'short-a', name: 'Catwalk/Short A', callout: 'Catwalk/Short A', position: freezePoint(66, 0, 62) }),
  UPPER_TUNNELS: Object.freeze({ id: 'upper-tunnels', name: 'Upper Tunnels', callout: 'Upper Tunnels', position: freezePoint(26, 0, 74), visualRole: 'tunnels', debugTourId: 'tour-tunnels' }),
  LOWER_TUNNELS: Object.freeze({ id: 'lower-tunnels', name: 'Lower Tunnels', callout: 'Lower Tunnels', position: freezePoint(20, 0, 82) }),
  B_SITE: Object.freeze({ id: 'b-site', name: 'B Site', callout: 'B Site', position: freezePoint(20, 0, 18), visualRole: 'siteMarkings', debugTourId: 'tour-b-site' }),
  WINDOW: Object.freeze({ id: 'window', name: 'Window', callout: 'Window', position: freezePoint(48, 0, 26) }),
  A_SITE: Object.freeze({ id: 'a-site', name: 'A Site', callout: 'A Site', position: freezePoint(86, 0, 82), visualRole: 'siteMarkings', debugTourId: 'tour-a-site' }),
  A_SITE_BOXES: Object.freeze({ id: 'a-site-boxes', name: 'A Site Boxes', callout: 'A Site boxes', position: freezePoint(86, 0, 82) }),
});

export const MAP_DEBUG_TOUR_TARGETS = Object.freeze([
  Object.freeze({ id: 'tour-mid', landmarkId: MAP_LANDMARKS.MID.id, name: 'Mid', screenshotTarget: 'mid-debug-tour', materialRole: 'doors', camera: freezeCamera(48, 7, 40, 0, -12) }),
  Object.freeze({ id: 'tour-long-a', landmarkId: MAP_LANDMARKS.LONG_A.id, name: 'Long A', screenshotTarget: 'long-a-debug-tour', materialRole: 'ramps', camera: freezeCamera(68, 7, 68, 36, -10) }),
  Object.freeze({ id: 'tour-tunnels', landmarkId: MAP_LANDMARKS.UPPER_TUNNELS.id, name: 'Tunnels', screenshotTarget: 'tunnels-debug-tour', materialRole: 'tunnels', camera: freezeCamera(24, 6, 86, -26, -8) }),
  Object.freeze({ id: 'tour-a-site', landmarkId: MAP_LANDMARKS.A_SITE.id, name: 'A Site', screenshotTarget: 'a-site-debug-tour', materialRole: 'siteMarkings', camera: freezeCamera(78, 8, 74, 48, -14) }),
  Object.freeze({ id: 'tour-b-site', landmarkId: MAP_LANDMARKS.B_SITE.id, name: 'B Site', screenshotTarget: 'b-site-debug-tour', materialRole: 'siteMarkings', camera: freezeCamera(28, 7, 28, -135, -12) }),
]);

export const MAP_COLLISION_VOLUMES = Object.freeze([
  freezeBox(50, 20, 5, 100, 10, 10),
  freezeBox(50, 20, 95, 100, 10, 10),
  freezeBox(5, 20, 50, 10, 10, 100),
  freezeBox(95, 20, 50, 10, 10, 100),
  freezeBox(58, 20, 50, 6, 6, 14),
  freezeBox(74, 20, 72, 8, 6, 12),
  freezeBox(66, 20, 62, 8, 6, 12),
  freezeBox(26, 20, 74, 8, 6, 12),
  freezeBox(20, 20, 82, 10, 6, 12),
  freezeBox(20, 20, 18, 10, 6, 12),
  freezeBox(48, 20, 26, 10, 6, 10),
  freezeBox(86, 20, 82, 12, 6, 12),
]);

export const MAP_GEOMETRY_PRIMITIVES = Object.freeze([
  Object.freeze({ id: 't-yard', kind: 'ground-plane', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'tunnels', footprint: freezeBox(12, 0, 88, 18, 1, 18) }),
  Object.freeze({ id: 'long-a-run', kind: 'corridor', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'ramps', footprint: freezeBox(74, 0, 76, 26, 1, 12) }),
  Object.freeze({ id: 'short-a-bridge', kind: 'bridge', material: MAP_MATERIALS.CONCRETE.id, visualRole: 'ramps', footprint: freezeBox(64, 1, 58, 16, 2, 8) }),
  Object.freeze({ id: 'mid-doors', kind: 'doorway', material: MAP_MATERIALS.METAL.id, visualRole: 'doors', footprint: freezeBox(58, 0, 50, 6, 4, 12) }),
  Object.freeze({ id: 'upper-tunnels', kind: 'corridor', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'tunnels', footprint: freezeBox(28, 0, 74, 18, 1, 10) }),
  Object.freeze({ id: 'lower-tunnels', kind: 'corridor', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'tunnels', footprint: freezeBox(18, 0, 82, 14, 1, 10) }),
  Object.freeze({ id: 'b-site-box-cluster', kind: 'cover', material: MAP_MATERIALS.WOOD.id, visualRole: 'crates', footprint: freezeBox(20, 0, 18, 10, 2, 10) }),
  Object.freeze({ id: 'b-site-marking', kind: 'site-marking', material: MAP_MATERIALS.SITE_PAINT.id, visualRole: 'siteMarkings', footprint: freezeBox(20, 0.02, 18, 8, 0.04, 8) }),
  Object.freeze({ id: 'window-ledge', kind: 'window', material: MAP_MATERIALS.GLASS.id, visualRole: 'doors', footprint: freezeBox(48, 0, 26, 10, 2, 8) }),
  Object.freeze({ id: 'a-site-boxes', kind: 'cover', material: MAP_MATERIALS.WOOD.id, visualRole: 'crates', footprint: freezeBox(86, 0, 82, 12, 3, 12) }),
  Object.freeze({ id: 'a-site-marking', kind: 'site-marking', material: MAP_MATERIALS.SITE_PAINT.id, visualRole: 'siteMarkings', footprint: freezeBox(86, 0.02, 82, 10, 0.04, 10) }),
]);

export const MAP_SPAWN_POINTS = Object.freeze(SPAWN_REFERENCES.map((spawnReference, index) => {
  const positions = [
    { x: 12, y: 0, z: 88 },
    { x: 14, y: 0, z: 78 },
    { x: 26, y: 0, z: 88 },
    { x: 32, y: 0, z: 82 },
    { x: 72, y: 0, z: 80 },
    { x: 62, y: 0, z: 70 },
    { x: 50, y: 0, z: 56 },
    { x: 18, y: 0, z: 70 },
    { x: 88, y: 0, z: 14 },
    { x: 84, y: 0, z: 18 },
    { x: 86, y: 0, z: 30 },
    { x: 76, y: 0, z: 24 },
    { x: 58, y: 0, z: 42 },
    { x: 26, y: 0, z: 24 },
    { x: 46, y: 0, z: 18 },
    { x: 78, y: 0, z: 84 },
  ];

  return Object.freeze({
    id: spawnReference.id,
    faction: spawnReference.faction,
    callout: spawnReference.callout,
    position: freezePoint(positions[index].x, positions[index].y, positions[index].z),
    radius: 1.25,
  });
}));

export const MAP_WAYPOINTS = freezeWaypoints([
  { id: 'wp-t-spawn', calloutId: MAP_LANDMARKS.T_SPAWN.id, position: MAP_LANDMARKS.T_SPAWN.position, links: ['wp-upper-tunnels', 'wp-lower-tunnels'] },
  { id: 'wp-upper-tunnels', calloutId: MAP_LANDMARKS.UPPER_TUNNELS.id, position: MAP_LANDMARKS.UPPER_TUNNELS.position, links: ['wp-mid', 'wp-b-site'] },
  { id: 'wp-lower-tunnels', calloutId: MAP_LANDMARKS.LOWER_TUNNELS.id, position: MAP_LANDMARKS.LOWER_TUNNELS.position, links: ['wp-b-site', 'wp-mid'] },
  { id: 'wp-mid', calloutId: MAP_LANDMARKS.MID.id, position: MAP_LANDMARKS.MID.position, links: ['wp-mid-doors', 'wp-window', 'wp-short-a'] },
  { id: 'wp-mid-doors', calloutId: MAP_LANDMARKS.MID_DOORS.id, position: MAP_LANDMARKS.MID_DOORS.position, links: ['wp-long-a', 'wp-window'] },
  { id: 'wp-long-a', calloutId: MAP_LANDMARKS.LONG_A.id, position: MAP_LANDMARKS.LONG_A.position, links: ['wp-a-site-boxes', 'wp-short-a'] },
  { id: 'wp-short-a', calloutId: MAP_LANDMARKS.SHORT_A.id, position: MAP_LANDMARKS.SHORT_A.position, links: ['wp-a-site-boxes', 'wp-mid'] },
  { id: 'wp-b-site', calloutId: MAP_LANDMARKS.B_SITE.id, position: MAP_LANDMARKS.B_SITE.position, links: ['wp-lower-tunnels', 'wp-window'] },
  { id: 'wp-window', calloutId: MAP_LANDMARKS.WINDOW.id, position: MAP_LANDMARKS.WINDOW.position, links: ['wp-mid', 'wp-mid-doors'] },
  { id: 'wp-a-site-boxes', calloutId: MAP_LANDMARKS.A_SITE_BOXES.id, position: MAP_LANDMARKS.A_SITE_BOXES.position, links: ['wp-long-a', 'wp-short-a'] },
]);

export const MAP_ROUTE_GRAPH = Object.freeze({
  anchors: MAP_WAYPOINTS,
  landmarks: MAP_LANDMARKS,
  debugTourTargets: MAP_DEBUG_TOUR_TARGETS,
});

export const MAP_CALLOUTS = Object.freeze(Object.values(MAP_LANDMARKS));

export const SPAWN_CLEARANCE_RADIUS = 1.25;

const isPointInsideBox = (point, box) => {
  const halfWidth = box.size.width / 2;
  const halfHeight = box.size.height / 2;
  const halfDepth = box.size.depth / 2;

  return Math.abs(point.x - box.center.x) <= halfWidth + SPAWN_CLEARANCE_RADIUS
    && Math.abs(point.y - box.center.y) <= halfHeight + SPAWN_CLEARANCE_RADIUS
    && Math.abs(point.z - box.center.z) <= halfDepth + SPAWN_CLEARANCE_RADIUS;
};

export function getSpawnCollisionOverlaps(spawnPoints = MAP_SPAWN_POINTS, collisionVolumes = MAP_COLLISION_VOLUMES) {
  const overlaps = [];

  for (const spawnPoint of spawnPoints) {
    for (const collisionVolume of collisionVolumes) {
      if (isPointInsideBox(spawnPoint.position, collisionVolume)) {
        overlaps.push(Object.freeze({ spawnId: spawnPoint.id, collisionKind: collisionVolume.kind, collisionCenter: collisionVolume.center }));
      }
    }
  }

  return Object.freeze(overlaps);
}

export function getMapValidationSnapshot() {
  return Object.freeze({
    id: MAP_ID,
    name: MAP_NAME,
    callouts: MAP_CALLOUTS,
    collisionVolumes: MAP_COLLISION_VOLUMES,
    geometryPrimitives: MAP_GEOMETRY_PRIMITIVES,
    materials: MAP_MATERIALS,
    visualStyle: MAP_VISUAL_STYLE,
    debugTourTargets: MAP_DEBUG_TOUR_TARGETS,
    spawnPoints: MAP_SPAWN_POINTS,
    waypoints: MAP_WAYPOINTS,
    debugFlags: MAP_DEBUG_FLAGS,
    debugOverlay: MAP_DEBUG_OVERLAY,
  });
}

export { FACTIONS };
