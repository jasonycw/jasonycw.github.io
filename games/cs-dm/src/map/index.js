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

export const MAP_ID = 'de_dust2-clean-room';
export const MAP_NAME = 'Dust II';

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
  tone: 'clean-room Dust II-inspired three-lane desert combat map with Long A, Short A/Catwalk, Mid Doors, B Tunnels, and paired bombsite courtyards',
  provenance: 'Original generated homage descriptors only; no copied Counter-Strike layout, textures, screenshots, meshes, or remote images.',
  materialRoles: Object.freeze({
    crates: Object.freeze({ material: MAP_MATERIALS.WOOD.id, readableStyle: 'warm battered crate wood with high-contrast bevel tint' }),
    doors: Object.freeze({ material: MAP_MATERIALS.METAL.id, readableStyle: 'cool painted metal panels for mid-door silhouettes' }),
    ramps: Object.freeze({ material: MAP_MATERIALS.CONCRETE.id, readableStyle: 'sun-washed ramp faces and raised catwalk ledges with sandy edge wear' }),
    tunnels: Object.freeze({ material: MAP_MATERIALS.SANDSTONE.id, readableStyle: 'darker sandy tunnel plaster to separate enclosed routes' }),
    siteMarkings: Object.freeze({ material: MAP_MATERIALS.SITE_PAINT.id, readableStyle: 'chalky yellow site letters and boundary strokes on the floor' }),
    arches: Object.freeze({ material: MAP_MATERIALS.SANDSTONE.id, readableStyle: 'stacked sandstone arch blocks framing lane transitions without copying exact shapes' }),
    ledges: Object.freeze({ material: MAP_MATERIALS.CONCRETE.id, readableStyle: 'raised ledges and balcony lips that make elevation changes readable' }),
  }),
});

export const MAP_LANDMARKS = Object.freeze({
  T_SPAWN: Object.freeze({ id: 't-spawn', name: 'T Spawn', callout: 'T Spawn', position: freezePoint(20, 0, 88) }),
  CT_SPAWN: Object.freeze({ id: 'ct-spawn', name: 'CT Spawn', callout: 'CT Spawn', position: freezePoint(86, 0, 14) }),
  MID: Object.freeze({ id: 'mid', name: 'Middle', callout: 'Middle', position: freezePoint(50, 0, 50), visualRole: 'doors', debugTourId: 'tour-mid' }),
  MID_DOORS: Object.freeze({ id: 'mid-doors', name: 'Mid Doors', callout: 'Mid Doors', position: freezePoint(56, 0, 50) }),
  XBOX: Object.freeze({ id: 'xbox', name: 'Xbox', callout: 'Xbox', position: freezePoint(54, 0, 58), visualRole: 'crates' }),
  LONG_A: Object.freeze({ id: 'long-a', name: 'Long A', callout: 'Long A', position: freezePoint(78, 0, 78), visualRole: 'ramps', debugTourId: 'tour-long-a' }),
  LONG_A_DOORS: Object.freeze({ id: 'long-a-doors', name: 'Long Doors', callout: 'Long Doors', position: freezePoint(58, 0, 82) }),
  SHORT_A: Object.freeze({ id: 'short-a', name: 'Short A / Catwalk', callout: 'Short A / Catwalk', position: freezePoint(68, 0, 62) }),
  UPPER_TUNNELS: Object.freeze({ id: 'upper-tunnels', name: 'Upper Tunnels', callout: 'Upper Tunnels', position: freezePoint(26, 0, 68), visualRole: 'tunnels', debugTourId: 'tour-tunnels' }),
  LOWER_TUNNELS: Object.freeze({ id: 'lower-tunnels', name: 'Lower Tunnels', callout: 'Lower Tunnels', position: freezePoint(34, 0, 56) }),
  B_TUNNELS: Object.freeze({ id: 'b-tunnels', name: 'B Tunnels', callout: 'B Tunnels', position: freezePoint(20, 0, 40), visualRole: 'tunnels' }),
  B_SITE: Object.freeze({ id: 'b-site', name: 'B Site', callout: 'B Site', position: freezePoint(22, 0, 18), visualRole: 'siteMarkings', debugTourId: 'tour-b-site' }),
  B_DOORS: Object.freeze({ id: 'b-doors', name: 'B Doors', callout: 'B Doors', position: freezePoint(36, 0, 22), visualRole: 'doors' }),
  WINDOW: Object.freeze({ id: 'window', name: 'Window', callout: 'Window', position: freezePoint(46, 0, 26) }),
  A_SITE: Object.freeze({ id: 'a-site', name: 'A Site', callout: 'A Site', position: freezePoint(86, 0, 82), visualRole: 'siteMarkings', debugTourId: 'tour-a-site' }),
  A_SITE_BOXES: Object.freeze({ id: 'a-site-boxes', name: 'A Site Boxes', callout: 'A Site Boxes', position: freezePoint(86, 0, 82) }),
});

export const MAP_DEBUG_TOUR_TARGETS = Object.freeze([
  Object.freeze({ id: 'tour-mid', landmarkId: MAP_LANDMARKS.MID.id, name: 'Middle', screenshotTarget: 'market-mid-debug-tour', materialRole: 'doors', camera: freezeCamera(48, 7, 40, 0, -12) }),
  Object.freeze({ id: 'tour-long-a', landmarkId: MAP_LANDMARKS.LONG_A.id, name: 'Long A', screenshotTarget: 'sunwalk-long-debug-tour', materialRole: 'ramps', camera: freezeCamera(68, 7, 72, 36, -10) }),
  Object.freeze({ id: 'tour-tunnels', landmarkId: MAP_LANDMARKS.UPPER_TUNNELS.id, name: 'Upper Tunnels', screenshotTarget: 'cistern-tunnels-debug-tour', materialRole: 'tunnels', camera: freezeCamera(24, 6, 72, -26, -8) }),
  Object.freeze({ id: 'tour-a-site', landmarkId: MAP_LANDMARKS.A_SITE.id, name: 'A Site', screenshotTarget: 'sun-court-debug-tour', materialRole: 'siteMarkings', camera: freezeCamera(78, 8, 74, 48, -14) }),
  Object.freeze({ id: 'tour-b-site', landmarkId: MAP_LANDMARKS.B_SITE.id, name: 'B Site', screenshotTarget: 'cistern-court-debug-tour', materialRole: 'siteMarkings', camera: freezeCamera(28, 7, 28, -135, -12) }),
]);

const freezeStructure = (id, x, y, z, width, height, depth, material, visualRole, kind = 'wall') => {
  const resolvedHeight = ['wall', 'doorframe'].includes(kind) ? 9 : height;
  const resolvedY = ['wall', 'doorframe'].includes(kind) ? resolvedHeight / 2 : y;
  return Object.freeze({
    id,
    kind,
    material,
    visualRole,
    footprint: freezeBox(x, resolvedY, z, width, resolvedHeight, depth),
  });
};

/* Clean-room Dust II blockout: long central Middle, elevated Catwalk/Short,
 * enclosed Upper/Lower Tunnels, broad Long A, and compact A/B courtyards. */
const MAP_STRUCTURE_PRIMITIVES = Object.freeze([
  freezeStructure('north-boundary', 50, 4, 96, 92, 8, 2, MAP_MATERIALS.SANDSTONE.id, 'boundaries'),
  freezeStructure('south-boundary', 50, 4, 4, 92, 8, 2, MAP_MATERIALS.SANDSTONE.id, 'boundaries'),
  freezeStructure('west-boundary', 4, 4, 50, 2, 8, 92, MAP_MATERIALS.SANDSTONE.id, 'boundaries'),
  freezeStructure('east-boundary', 96, 4, 50, 2, 8, 92, MAP_MATERIALS.SANDSTONE.id, 'boundaries'),
  freezeStructure('mid-west-wall', 42, 4, 52, 2, 8, 64, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('mid-east-wall', 66, 4, 52, 2, 8, 64, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('mid-doors-left', 48, 4, 52, 2, 8, 9, MAP_MATERIALS.SANDSTONE.id, 'arches', 'doorframe'),
  freezeStructure('mid-doors-right', 60, 4, 52, 2, 8, 9, MAP_MATERIALS.SANDSTONE.id, 'arches', 'doorframe'),
  freezeStructure('mid-door-arch-top', 54, 7.2, 52, 14, 1.6, 2, MAP_MATERIALS.SANDSTONE.id, 'arches', 'arch'),
  freezeStructure('long-west-wall', 68, 4, 74, 2, 8, 38, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('long-east-wall', 92, 4, 74, 2, 8, 38, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('long-doors-left', 68, 4, 56, 2, 8, 8, MAP_MATERIALS.SANDSTONE.id, 'arches', 'doorframe'),
  freezeStructure('long-doors-right', 92, 4, 56, 2, 8, 8, MAP_MATERIALS.SANDSTONE.id, 'arches', 'doorframe'),
  freezeStructure('long-doors-top', 80, 7.2, 56, 26, 1.6, 2, MAP_MATERIALS.SANDSTONE.id, 'arches', 'arch'),
  freezeStructure('a-site-west-wall', 76, 4, 84, 2, 8, 18, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('a-site-east-wall', 94, 4, 84, 2, 8, 18, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('a-site-back-wall', 85, 4, 94, 20, 8, 2, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('short-west-wall', 62, 3, 38, 2, 6, 16, MAP_MATERIALS.CONCRETE.id, 'ledges'),
  freezeStructure('short-east-wall', 76, 3, 38, 2, 6, 16, MAP_MATERIALS.CONCRETE.id, 'ledges'),
  freezeStructure('short-catwalk-rail', 69, 5.2, 27, 16, 1.8, 1, MAP_MATERIALS.CONCRETE.id, 'ledges'),
  freezeStructure('tunnel-west-wall', 12.5, 4, 58, 2, 8, 48, MAP_MATERIALS.SANDSTONE.id, 'tunnels'),
  freezeStructure('tunnel-east-wall', 37.5, 4, 58, 2, 8, 48, MAP_MATERIALS.SANDSTONE.id, 'tunnels'),
  freezeStructure('tunnel-roof', 25, 14, 58, 24, 1.5, 48, MAP_MATERIALS.SANDSTONE.id, 'tunnels', 'roof'),
  freezeStructure('t-spawn-gate-left-return', 12.5, 7, 86, 2, 14, 10, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('t-spawn-gate-right-return', 37.5, 7, 86, 2, 14, 10, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('t-spawn-gate-left', 20, 7, 82, 2, 14, 2, MAP_MATERIALS.SANDSTONE.id, 'arches', 'doorframe'),
  freezeStructure('t-spawn-gate-right', 30, 7, 82, 2, 14, 2, MAP_MATERIALS.SANDSTONE.id, 'arches', 'doorframe'),
  freezeStructure('t-spawn-gate-top', 25, 13, 82, 12, 2, 2, MAP_MATERIALS.SANDSTONE.id, 'arches', 'arch'),
  freezeStructure('b-tunnel-mouth-left', 14, 4, 30, 2, 8, 16, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('b-tunnel-mouth-right', 36, 4, 30, 2, 8, 16, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('b-tunnel-mouth-top', 25, 7.2, 30, 24, 1.6, 2, MAP_MATERIALS.SANDSTONE.id, 'arches', 'arch'),
  freezeStructure('b-site-west-wall', 10, 4, 20, 2, 8, 26, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('b-site-south-wall', 25, 4, 8, 28, 8, 2, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('b-site-east-wall', 40, 4, 20, 2, 8, 26, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('b-window-frame', 48, 4, 22, 2, 8, 10, MAP_MATERIALS.SANDSTONE.id, 'arches'),
  freezeStructure('b-site-roof-beam', 25, 8, 8, 28, 1.2, 2, MAP_MATERIALS.SANDSTONE.id, 'ledges'),
]);

export const MAP_COLLISION_VOLUMES = Object.freeze([
  ...MAP_STRUCTURE_PRIMITIVES.filter((primitive) => primitive.id.endsWith('boundary')).map((primitive) => primitive.footprint),
  freezeBox(56, 20, 50, 4, 6, 14),
  ...MAP_STRUCTURE_PRIMITIVES.filter((primitive) => primitive.kind === 'wall' && !primitive.id.endsWith('boundary')).map((primitive) => primitive.footprint),
  freezeBox(54, 4, 65, 6, 5, 8),
  freezeBox(80, 4, 76, 8, 5, 10),
  freezeBox(69, 3, 38, 8, 5, 8),
  freezeBox(25, 4, 58, 8, 5, 8),
  freezeBox(22, 4, 20, 8, 4, 10),
  freezeBox(18, 4, 18, 5, 4, 6),
  freezeBox(85, 4, 84, 10, 4, 10),
]);

export const MAP_GEOMETRY_PRIMITIVES = Object.freeze([
  ...MAP_STRUCTURE_PRIMITIVES,
  Object.freeze({ id: 'long-a-open-lane', kind: 'corridor', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'ramps', footprint: freezeBox(80, 0, 74, 24, 1, 34) }),
  Object.freeze({ id: 'mid-approach-doors', kind: 'doorway', material: MAP_MATERIALS.METAL.id, visualRole: 'doors', footprint: freezeBox(25, 0, 72, 10, 5, 2) }),
  Object.freeze({ id: 'mid-approach-arch', kind: 'arch', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'arches', footprint: freezeBox(25, 0, 72, 14, 5, 2) }),
  Object.freeze({ id: 'long-a-doors', kind: 'doorway', material: MAP_MATERIALS.METAL.id, visualRole: 'doors', footprint: freezeBox(80, 0, 56, 8, 5, 10) }),
  Object.freeze({ id: 'short-a-bridge', kind: 'bridge', material: MAP_MATERIALS.CONCRETE.id, visualRole: 'ramps', footprint: freezeBox(69, 3, 38, 14, 2, 24) }),
  Object.freeze({ id: 'mid-doors', kind: 'doorway', material: MAP_MATERIALS.METAL.id, visualRole: 'doors', footprint: freezeBox(56, 0, 50, 4, 5, 14) }),
  Object.freeze({ id: 'mid-market-stairs', kind: 'ramp', material: MAP_MATERIALS.CONCRETE.id, visualRole: 'ramps', footprint: freezeBox(54, 0.5, 64, 8, 1, 8) }),
  Object.freeze({ id: 'xbox-split-cover', kind: 'cover', material: MAP_MATERIALS.WOOD.id, visualRole: 'crates', footprint: freezeBox(54, 0, 65, 6, 2, 8) }),
  Object.freeze({ id: 'upper-tunnels', kind: 'corridor', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'tunnels', footprint: freezeBox(25, 0, 58, 20, 1, 48) }),
  Object.freeze({ id: 'upper-tunnel-arch', kind: 'arch', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'arches', footprint: freezeBox(25, 0, 42, 12, 5, 2) }),
  Object.freeze({ id: 'lower-tunnel-ramp', kind: 'ramp', material: MAP_MATERIALS.CONCRETE.id, visualRole: 'ramps', footprint: freezeBox(25, 0.5, 34, 10, 1, 8) }),
  Object.freeze({ id: 'b-tunnel-portal', kind: 'arch', material: MAP_MATERIALS.SANDSTONE.id, visualRole: 'arches', footprint: freezeBox(25, 0, 30, 12, 5, 2) }),
  Object.freeze({ id: 'b-site-box-cluster', kind: 'cover', material: MAP_MATERIALS.WOOD.id, visualRole: 'crates', footprint: freezeBox(22, 0, 20, 8, 3, 10) }),
  Object.freeze({ id: 'b-site-back-crates', kind: 'cover', material: MAP_MATERIALS.WOOD.id, visualRole: 'crates', footprint: freezeBox(18, 0, 18, 5, 2.2, 6) }),
  Object.freeze({ id: 'b-site-marking', kind: 'site-marking', material: MAP_MATERIALS.SITE_PAINT.id, visualRole: 'siteMarkings', footprint: freezeBox(22, 0.02, 20, 8, 0.04, 10) }),
  Object.freeze({ id: 'b-doors-pressure', kind: 'doorway', material: MAP_MATERIALS.METAL.id, visualRole: 'doors', footprint: freezeBox(45, 0, 22, 6, 5, 10) }),
  Object.freeze({ id: 'window-ledge', kind: 'window', material: MAP_MATERIALS.GLASS.id, visualRole: 'doors', footprint: freezeBox(48, 0, 22, 6, 2, 8) }),
  Object.freeze({ id: 'a-site-boxes', kind: 'cover', material: MAP_MATERIALS.WOOD.id, visualRole: 'crates', footprint: freezeBox(85, 0, 84, 12, 3, 12) }),
  Object.freeze({ id: 'a-site-triple-stack', kind: 'cover', material: MAP_MATERIALS.WOOD.id, visualRole: 'crates', footprint: freezeBox(89, 0, 78, 6, 2.4, 5) }),
  Object.freeze({ id: 'a-site-marking', kind: 'site-marking', material: MAP_MATERIALS.SITE_PAINT.id, visualRole: 'siteMarkings', footprint: freezeBox(85, 0.02, 84, 10, 0.04, 10) }),
  Object.freeze({ id: 'short-catwalk-ledge', kind: 'ledge', material: MAP_MATERIALS.CONCRETE.id, visualRole: 'ledges', footprint: freezeBox(69, 5.2, 38, 16, 1.2, 1.2) }),
]);

export const MAP_SPAWN_POINTS = Object.freeze(SPAWN_REFERENCES.map((spawnReference, index) => {
  const positions = [
    { x: 20, y: 0, z: 88 },
    { x: 30, y: 0, z: 90 },
    { x: 26, y: 0, z: 88 },
    { x: 32, y: 0, z: 82 },
    { x: 72, y: 0, z: 86 },
    { x: 62, y: 0, z: 70 },
    { x: 50, y: 0, z: 64 },
    { x: 18, y: 0, z: 58 },
    { x: 88, y: 0, z: 14 },
    { x: 82, y: 0, z: 18 },
    { x: 86, y: 0, z: 30 },
    { x: 76, y: 0, z: 24 },
    { x: 58, y: 0, z: 42 },
    { x: 28, y: 0, z: 28 },
    { x: 52, y: 0, z: 18 },
    { x: 72, y: 0, z: 90 },
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
  { id: 'wp-t-spawn', calloutId: MAP_LANDMARKS.T_SPAWN.id, position: MAP_LANDMARKS.T_SPAWN.position, links: ['wp-long-a-doors', 'wp-upper-tunnels', 'wp-lower-tunnels', 'wp-mid'] },
  { id: 'wp-long-a-doors', calloutId: MAP_LANDMARKS.LONG_A_DOORS.id, position: freezePoint(52, 0, 82), links: ['wp-t-spawn', 'wp-long-a', 'wp-mid-doors'] },
  { id: 'wp-long-a', calloutId: MAP_LANDMARKS.LONG_A.id, position: freezePoint(72, 0, 84), links: ['wp-long-a-doors', 'wp-a-site-boxes'] },
  { id: 'wp-upper-tunnels', calloutId: MAP_LANDMARKS.UPPER_TUNNELS.id, position: freezePoint(20, 0, 68), links: ['wp-t-spawn', 'wp-b-tunnels', 'wp-lower-tunnels'] },
  { id: 'wp-lower-tunnels', calloutId: MAP_LANDMARKS.LOWER_TUNNELS.id, position: freezePoint(40, 0, 56), links: ['wp-t-spawn', 'wp-upper-tunnels', 'wp-mid'] },
  { id: 'wp-b-tunnels', calloutId: MAP_LANDMARKS.B_TUNNELS.id, position: freezePoint(26, 0, 40), links: ['wp-upper-tunnels', 'wp-b-site'] },
  { id: 'wp-mid', calloutId: MAP_LANDMARKS.MID.id, position: MAP_LANDMARKS.MID.position, links: ['wp-mid-doors', 'wp-xbox', 'wp-lower-tunnels'] },
  { id: 'wp-mid-doors', calloutId: MAP_LANDMARKS.MID_DOORS.id, position: freezePoint(61, 0, 50), links: ['wp-mid', 'wp-long-a-doors', 'wp-window'] },
  { id: 'wp-xbox', calloutId: MAP_LANDMARKS.XBOX.id, position: freezePoint(48, 0, 58), links: ['wp-mid', 'wp-short-a'] },
  { id: 'wp-short-a', calloutId: MAP_LANDMARKS.SHORT_A.id, position: freezePoint(62, 0, 62), links: ['wp-xbox', 'wp-a-site-boxes'] },
  { id: 'wp-b-site', calloutId: MAP_LANDMARKS.B_SITE.id, position: freezePoint(28, 0, 18), links: ['wp-b-tunnels', 'wp-b-doors', 'wp-window'] },
  { id: 'wp-b-doors', calloutId: MAP_LANDMARKS.B_DOORS.id, position: freezePoint(42, 0, 16), links: ['wp-b-site', 'wp-ct-spawn'] },
  { id: 'wp-window', calloutId: MAP_LANDMARKS.WINDOW.id, position: freezePoint(52, 0, 26), links: ['wp-mid-doors', 'wp-b-site', 'wp-ct-spawn'] },
  { id: 'wp-ct-spawn', calloutId: MAP_LANDMARKS.CT_SPAWN.id, position: MAP_LANDMARKS.CT_SPAWN.position, links: ['wp-b-doors', 'wp-window', 'wp-a-site-boxes'] },
  { id: 'wp-a-site-boxes', calloutId: MAP_LANDMARKS.A_SITE_BOXES.id, position: freezePoint(78, 0, 82), links: ['wp-long-a', 'wp-short-a', 'wp-ct-spawn'] },
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
