import {
  MAP_COLLISION_VOLUMES,
  MAP_GEOMETRY_PRIMITIVES,
  MAP_MATERIALS,
} from '../map/index.js';

export const MAP_SCENE_CENTER = 50;
export const MAP_SCENE_SCALE = 4.5;

const round = (value) => Number(value.toFixed(6));

const freezePoint = (x, y, z) => Object.freeze({ x: round(x), y: round(y), z: round(z) });
const freezeSize = (x, y, z) => Object.freeze({ x: round(x), y: round(y), z: round(z) });

export const mapToScenePosition = (position = Object.freeze({ x: 12, y: 0, z: 88 })) => freezePoint(
  ((position?.x ?? 12) - MAP_SCENE_CENTER) / MAP_SCENE_SCALE,
  position?.y ?? 0,
  ((position?.z ?? 88) - MAP_SCENE_CENTER) / MAP_SCENE_SCALE,
);

const mapSizeToSceneSize = (size, height) => freezeSize(
  size.width / MAP_SCENE_SCALE,
  height,
  size.depth / MAP_SCENE_SCALE,
);

const getMaterialIdForRole = (visualRole) => {
  const roleMaterial = {
    crates: MAP_MATERIALS.WOOD.id,
    doors: MAP_MATERIALS.METAL.id,
    ramps: MAP_MATERIALS.CONCRETE.id,
    tunnels: MAP_MATERIALS.SANDSTONE.id,
    siteMarkings: MAP_MATERIALS.SITE_PAINT.id,
    boundaries: MAP_MATERIALS.SANDSTONE.id,
  };

  return roleMaterial[visualRole] ?? MAP_MATERIALS.CONCRETE.id;
};

const centersMatch2d = (first, second) => Math.abs(first.x - second.x) < 0.001 && Math.abs(first.z - second.z) < 0.001;

const findPrimitiveForCollision = (collisionVolume, geometryPrimitives) => geometryPrimitives.find((primitive) => centersMatch2d(collisionVolume.center, primitive.footprint.center));

const createBlockingDescriptor = (collisionVolume, index, geometryPrimitives) => {
  const primitive = findPrimitiveForCollision(collisionVolume, geometryPrimitives);
  const visualRole = primitive?.visualRole ?? 'boundaries';
  const height = Math.max(1.6, collisionVolume.size.height / MAP_SCENE_SCALE);
  const basePosition = mapToScenePosition(collisionVolume.center);

  return Object.freeze({
    id: primitive ? `${primitive.id}-collision` : `boundary-collision-${index}`,
    kind: 'blocking-box',
    visualRole,
    materialId: primitive?.material ?? getMaterialIdForRole(visualRole),
    mapCenter: collisionVolume.center,
    position: freezePoint(basePosition.x, height / 2, basePosition.z),
    size: mapSizeToSceneSize(collisionVolume.size, height),
    collisionVolume,
  });
};

const createPrimitiveDescriptor = (primitive) => {
  const isSiteMarking = primitive.kind === 'site-marking';
  const height = isSiteMarking ? 0.035 : Math.max(0.08, primitive.footprint.size.height / MAP_SCENE_SCALE);
  const basePosition = mapToScenePosition(primitive.footprint.center);

  return Object.freeze({
    id: primitive.id,
    kind: primitive.kind,
    visualRole: primitive.visualRole,
    materialId: primitive.material,
    mapCenter: primitive.footprint.center,
    position: freezePoint(basePosition.x, isSiteMarking ? 0.04 : height / 2, basePosition.z),
    size: mapSizeToSceneSize(primitive.footprint.size, height),
    primitive,
  });
};

export function buildMapRenderGeometry({
  collisionVolumes = MAP_COLLISION_VOLUMES,
  geometryPrimitives = MAP_GEOMETRY_PRIMITIVES,
} = {}) {
  return Object.freeze({
    scale: MAP_SCENE_SCALE,
    origin: Object.freeze({ mapCenter: MAP_SCENE_CENTER }),
    floor: Object.freeze({
      id: 'map-floor',
      kind: 'ground-plane',
      materialId: MAP_MATERIALS.SANDSTONE.id,
      position: freezePoint(0, -0.015, 0),
      size: freezeSize(100 / MAP_SCENE_SCALE, 0.03, 100 / MAP_SCENE_SCALE),
    }),
    blockers: Object.freeze(collisionVolumes.map((collisionVolume, index) => createBlockingDescriptor(collisionVolume, index, geometryPrimitives))),
    primitives: Object.freeze(geometryPrimitives.map(createPrimitiveDescriptor)),
  });
}
