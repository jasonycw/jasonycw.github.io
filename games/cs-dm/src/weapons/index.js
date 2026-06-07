export const WEAPON_CATEGORIES = Object.freeze({
  PISTOL: 'pistol',
  SHOTGUN: 'shotgun',
  SMG: 'smg',
  RIFLE: 'rifle',
  SNIPER: 'sniper',
  MACHINE_GUN: 'machine-gun',
  EQUIPMENT: 'equipment',
});

export const BUY_CATEGORY_METADATA = Object.freeze({
  [WEAPON_CATEGORIES.PISTOL]: Object.freeze({ id: WEAPON_CATEGORIES.PISTOL, label: 'Pistols', order: 10, slot: 'secondary' }),
  [WEAPON_CATEGORIES.SHOTGUN]: Object.freeze({ id: WEAPON_CATEGORIES.SHOTGUN, label: 'Shotguns', order: 20, slot: 'primary' }),
  [WEAPON_CATEGORIES.SMG]: Object.freeze({ id: WEAPON_CATEGORIES.SMG, label: 'SMGs', order: 30, slot: 'primary' }),
  [WEAPON_CATEGORIES.RIFLE]: Object.freeze({ id: WEAPON_CATEGORIES.RIFLE, label: 'Rifles', order: 40, slot: 'primary' }),
  [WEAPON_CATEGORIES.SNIPER]: Object.freeze({ id: WEAPON_CATEGORIES.SNIPER, label: 'Sniper Rifles', order: 50, slot: 'primary' }),
  [WEAPON_CATEGORIES.MACHINE_GUN]: Object.freeze({ id: WEAPON_CATEGORIES.MACHINE_GUN, label: 'Machine Guns', order: 60, slot: 'primary' }),
  [WEAPON_CATEGORIES.EQUIPMENT]: Object.freeze({ id: WEAPON_CATEGORIES.EQUIPMENT, label: 'Equipment', order: 70, slot: 'equipment' }),
});

export const GRENADE_SCOPE_NOTE = 'Grenades are intentionally omitted from T10 ballistics; HE/flash/smoke are reserved for bounded original effects in a later task.';

const freezeWeapon = (weapon) => Object.freeze({
  ...weapon,
  ammo: Object.freeze(weapon.ammo),
  damage: Object.freeze(weapon.damage),
  recoil: Object.freeze(weapon.recoil),
  spread: Object.freeze(weapon.spread),
  range: Object.freeze(weapon.range),
});

const weapon = ({
  id,
  name,
  category,
  cost,
  equipmentSlot,
  ammoType,
  magazine,
  reserveMax,
  fireRate,
  reloadMs,
  damageClose,
  damageFar,
  rangeMax,
  falloffStart,
  speedModifier,
  recoilPitch,
  recoilYaw,
  spreadBase,
  spreadMove,
  pellets = 1,
  isMelee = false,
  altDamageClose = null,
  altDamageFar = null,
  altFireRate = null,
  altRangeMax = null,
}) => freezeWeapon({
  id,
  name,
  category,
  buyCategory: category,
  cost,
  equipmentSlot,
  ammo: { type: ammoType, magazine, reserveMax },
  fireRate,
  reloadMs,
  damage: { close: damageClose, far: damageFar, pellets },
  range: { max: rangeMax, falloffStart },
  speedModifier,
  recoil: { pitch: recoilPitch, yaw: recoilYaw },
  spread: { base: spreadBase, moving: spreadMove },
  isMelee,
  altDamage: altDamageClose !== null ? { close: altDamageClose, far: altDamageFar } : null,
  altFireRate: altFireRate ?? null,
  altRangeMax: altRangeMax ?? null,
});

export const WEAPONS = Object.freeze({
  KNIFE: weapon({ id: 'knife', name: 'Knife', category: WEAPON_CATEGORIES.EQUIPMENT, cost: 0, equipmentSlot: 'melee', ammoType: 'none', magazine: 0, reserveMax: 0, fireRate: 1.6, reloadMs: 0, damageClose: 20, damageFar: 17, rangeMax: 65, falloffStart: 65, speedModifier: 1, recoilPitch: 0, recoilYaw: 0, spreadBase: 0, spreadMove: 0, isMelee: true, altDamageClose: 65, altDamageFar: 55, altFireRate: 1.0, altRangeMax: 80 }),
  KEVLAR: weapon({ id: 'kevlar', name: 'Kevlar Vest', category: WEAPON_CATEGORIES.EQUIPMENT, cost: 650, equipmentSlot: 'armor', ammoType: 'none', magazine: 0, reserveMax: 0, fireRate: 0, reloadMs: 0, damageClose: 0, damageFar: 0, rangeMax: 0, falloffStart: 0, speedModifier: 1, recoilPitch: 0, recoilYaw: 0, spreadBase: 0, spreadMove: 0 }),
  KEVLAR_HELMET: weapon({ id: 'kevlar-helmet', name: 'Kevlar + Helmet', category: WEAPON_CATEGORIES.EQUIPMENT, cost: 1000, equipmentSlot: 'armor', ammoType: 'none', magazine: 0, reserveMax: 0, fireRate: 0, reloadMs: 0, damageClose: 0, damageFar: 0, rangeMax: 0, falloffStart: 0, speedModifier: 1, recoilPitch: 0, recoilYaw: 0, spreadBase: 0, spreadMove: 0 }),
  DEFUSER: weapon({ id: 'defuser', name: 'Defuse Kit', category: WEAPON_CATEGORIES.EQUIPMENT, cost: 200, equipmentSlot: 'kit', ammoType: 'none', magazine: 0, reserveMax: 0, fireRate: 0, reloadMs: 0, damageClose: 0, damageFar: 0, rangeMax: 0, falloffStart: 0, speedModifier: 1, recoilPitch: 0, recoilYaw: 0, spreadBase: 0, spreadMove: 0 }),
  GLOCK18: weapon({ id: 'glock18', name: 'Glock 18', category: WEAPON_CATEGORIES.PISTOL, cost: 400, equipmentSlot: 'secondary', ammoType: '9mm', magazine: 20, reserveMax: 120, fireRate: 6.4, reloadMs: 2200, damageClose: 25, damageFar: 13, rangeMax: 55, falloffStart: 18, speedModifier: 0.98, recoilPitch: 0.9, recoilYaw: 0.35, spreadBase: 0.012, spreadMove: 0.032 }),
  USP: weapon({ id: 'usp', name: 'USP', category: WEAPON_CATEGORIES.PISTOL, cost: 500, equipmentSlot: 'secondary', ammoType: '45acp', magazine: 12, reserveMax: 100, fireRate: 5.8, reloadMs: 2300, damageClose: 34, damageFar: 18, rangeMax: 65, falloffStart: 22, speedModifier: 0.98, recoilPitch: 1.05, recoilYaw: 0.38, spreadBase: 0.01, spreadMove: 0.028 }),
  P228: weapon({ id: 'p228', name: 'P228', category: WEAPON_CATEGORIES.PISTOL, cost: 600, equipmentSlot: 'secondary', ammoType: '357sig', magazine: 13, reserveMax: 52, fireRate: 5.6, reloadMs: 2700, damageClose: 37, damageFar: 20, rangeMax: 68, falloffStart: 24, speedModifier: 0.98, recoilPitch: 1.12, recoilYaw: 0.4, spreadBase: 0.011, spreadMove: 0.03 }),
  DEAGLE: weapon({ id: 'deagle', name: 'Desert Eagle', category: WEAPON_CATEGORIES.PISTOL, cost: 650, equipmentSlot: 'secondary', ammoType: '50ae', magazine: 7, reserveMax: 35, fireRate: 3.6, reloadMs: 2200, damageClose: 54, damageFar: 30, rangeMax: 85, falloffStart: 30, speedModifier: 0.97, recoilPitch: 1.9, recoilYaw: 0.7, spreadBase: 0.016, spreadMove: 0.04 }),
  ELITE: weapon({ id: 'elite', name: 'Dual Berettas', category: WEAPON_CATEGORIES.PISTOL, cost: 800, equipmentSlot: 'secondary', ammoType: '9mm', magazine: 30, reserveMax: 120, fireRate: 7.0, reloadMs: 4500, damageClose: 28, damageFar: 15, rangeMax: 55, falloffStart: 18, speedModifier: 0.96, recoilPitch: 0.95, recoilYaw: 0.52, spreadBase: 0.017, spreadMove: 0.038 }),
  FIVESEVEN: weapon({ id: 'fiveseven', name: 'Five-SeveN', category: WEAPON_CATEGORIES.PISTOL, cost: 750, equipmentSlot: 'secondary', ammoType: '57mm', magazine: 20, reserveMax: 100, fireRate: 6.2, reloadMs: 2400, damageClose: 26, damageFar: 16, rangeMax: 70, falloffStart: 24, speedModifier: 0.98, recoilPitch: 0.82, recoilYaw: 0.32, spreadBase: 0.009, spreadMove: 0.026 }),
  M3: weapon({ id: 'm3', name: 'M3', category: WEAPON_CATEGORIES.SHOTGUN, cost: 1700, equipmentSlot: 'primary', ammoType: 'buckshot', magazine: 8, reserveMax: 32, fireRate: 1.1, reloadMs: 3700, damageClose: 12, damageFar: 4, rangeMax: 35, falloffStart: 8, speedModifier: 0.91, recoilPitch: 2.4, recoilYaw: 1.1, spreadBase: 0.065, spreadMove: 0.095, pellets: 9 }),
  XM1014: weapon({ id: 'xm1014', name: 'XM1014', category: WEAPON_CATEGORIES.SHOTGUN, cost: 3000, equipmentSlot: 'primary', ammoType: 'buckshot', magazine: 7, reserveMax: 32, fireRate: 2.4, reloadMs: 2800, damageClose: 10, damageFar: 4, rangeMax: 32, falloffStart: 8, speedModifier: 0.88, recoilPitch: 2.1, recoilYaw: 1.0, spreadBase: 0.072, spreadMove: 0.105, pellets: 7 }),
  TMP: weapon({ id: 'tmp', name: 'TMP', category: WEAPON_CATEGORIES.SMG, cost: 1250, equipmentSlot: 'primary', ammoType: '9mm', magazine: 30, reserveMax: 120, fireRate: 13.5, reloadMs: 2100, damageClose: 20, damageFar: 10, rangeMax: 55, falloffStart: 18, speedModifier: 0.96, recoilPitch: 0.58, recoilYaw: 0.38, spreadBase: 0.02, spreadMove: 0.052 }),
  MAC10: weapon({ id: 'mac10', name: 'MAC-10', category: WEAPON_CATEGORIES.SMG, cost: 1400, equipmentSlot: 'primary', ammoType: '45acp', magazine: 30, reserveMax: 100, fireRate: 12.8, reloadMs: 2600, damageClose: 22, damageFar: 11, rangeMax: 52, falloffStart: 16, speedModifier: 0.95, recoilPitch: 0.72, recoilYaw: 0.48, spreadBase: 0.024, spreadMove: 0.058 }),
  MP5: weapon({ id: 'mp5', name: 'MP5 Navy', category: WEAPON_CATEGORIES.SMG, cost: 1500, equipmentSlot: 'primary', ammoType: '9mm', magazine: 30, reserveMax: 120, fireRate: 11.2, reloadMs: 2600, damageClose: 26, damageFar: 13, rangeMax: 62, falloffStart: 20, speedModifier: 0.94, recoilPitch: 0.78, recoilYaw: 0.42, spreadBase: 0.018, spreadMove: 0.048 }),
  UMP45: weapon({ id: 'ump45', name: 'UMP45', category: WEAPON_CATEGORIES.SMG, cost: 1700, equipmentSlot: 'primary', ammoType: '45acp', magazine: 25, reserveMax: 100, fireRate: 9.0, reloadMs: 3200, damageClose: 30, damageFar: 17, rangeMax: 68, falloffStart: 23, speedModifier: 0.93, recoilPitch: 0.95, recoilYaw: 0.48, spreadBase: 0.017, spreadMove: 0.044 }),
  P90: weapon({ id: 'p90', name: 'P90', category: WEAPON_CATEGORIES.SMG, cost: 2350, equipmentSlot: 'primary', ammoType: '57mm', magazine: 50, reserveMax: 100, fireRate: 14.0, reloadMs: 3300, damageClose: 24, damageFar: 12, rangeMax: 65, falloffStart: 20, speedModifier: 0.92, recoilPitch: 0.65, recoilYaw: 0.5, spreadBase: 0.022, spreadMove: 0.055 }),
  GALIL: weapon({ id: 'galil', name: 'Galil', category: WEAPON_CATEGORIES.RIFLE, cost: 2000, equipmentSlot: 'primary', ammoType: '556', magazine: 35, reserveMax: 90, fireRate: 10.8, reloadMs: 2900, damageClose: 30, damageFar: 20, rangeMax: 95, falloffStart: 35, speedModifier: 0.89, recoilPitch: 1.05, recoilYaw: 0.54, spreadBase: 0.015, spreadMove: 0.04 }),
  FAMAS: weapon({ id: 'famas', name: 'FAMAS', category: WEAPON_CATEGORIES.RIFLE, cost: 2250, equipmentSlot: 'primary', ammoType: '556', magazine: 25, reserveMax: 90, fireRate: 10.6, reloadMs: 3100, damageClose: 30, damageFar: 20, rangeMax: 95, falloffStart: 35, speedModifier: 0.89, recoilPitch: 1.0, recoilYaw: 0.48, spreadBase: 0.014, spreadMove: 0.038 }),
  AK47: weapon({ id: 'ak47', name: 'AK-47', category: WEAPON_CATEGORIES.RIFLE, cost: 2500, equipmentSlot: 'primary', ammoType: '762', magazine: 30, reserveMax: 90, fireRate: 10.0, reloadMs: 2500, damageClose: 36, damageFar: 24, rangeMax: 110, falloffStart: 40, speedModifier: 0.88, recoilPitch: 1.32, recoilYaw: 0.58, spreadBase: 0.016, spreadMove: 0.042 }),
  M4A1: weapon({ id: 'm4a1', name: 'M4A1', category: WEAPON_CATEGORIES.RIFLE, cost: 3100, equipmentSlot: 'primary', ammoType: '556', magazine: 30, reserveMax: 90, fireRate: 10.5, reloadMs: 3100, damageClose: 33, damageFar: 23, rangeMax: 108, falloffStart: 40, speedModifier: 0.88, recoilPitch: 1.12, recoilYaw: 0.5, spreadBase: 0.014, spreadMove: 0.038 }),
  SG552: weapon({ id: 'sg552', name: 'SG-552', category: WEAPON_CATEGORIES.RIFLE, cost: 3500, equipmentSlot: 'primary', ammoType: '556', magazine: 30, reserveMax: 90, fireRate: 10.2, reloadMs: 3000, damageClose: 33, damageFar: 22, rangeMax: 112, falloffStart: 42, speedModifier: 0.86, recoilPitch: 1.15, recoilYaw: 0.52, spreadBase: 0.013, spreadMove: 0.037 }),
  AUG: weapon({ id: 'aug', name: 'AUG', category: WEAPON_CATEGORIES.RIFLE, cost: 3500, equipmentSlot: 'primary', ammoType: '556', magazine: 30, reserveMax: 90, fireRate: 10.1, reloadMs: 3300, damageClose: 32, damageFar: 22, rangeMax: 112, falloffStart: 42, speedModifier: 0.86, recoilPitch: 1.08, recoilYaw: 0.5, spreadBase: 0.013, spreadMove: 0.036 }),
  SCOUT: weapon({ id: 'scout', name: 'Scout', category: WEAPON_CATEGORIES.SNIPER, cost: 2750, equipmentSlot: 'primary', ammoType: '762', magazine: 10, reserveMax: 90, fireRate: 1.2, reloadMs: 3000, damageClose: 75, damageFar: 54, rangeMax: 180, falloffStart: 75, speedModifier: 0.92, recoilPitch: 2.0, recoilYaw: 0.7, spreadBase: 0.006, spreadMove: 0.04 }),
  AWP: weapon({ id: 'awp', name: 'AWP', category: WEAPON_CATEGORIES.SNIPER, cost: 4750, equipmentSlot: 'primary', ammoType: '338mag', magazine: 10, reserveMax: 30, fireRate: 0.9, reloadMs: 3700, damageClose: 115, damageFar: 90, rangeMax: 220, falloffStart: 90, speedModifier: 0.78, recoilPitch: 3.2, recoilYaw: 0.9, spreadBase: 0.004, spreadMove: 0.055 }),
  G3SG1: weapon({ id: 'g3sg1', name: 'G3SG1', category: WEAPON_CATEGORIES.SNIPER, cost: 5000, equipmentSlot: 'primary', ammoType: '762', magazine: 20, reserveMax: 90, fireRate: 4.0, reloadMs: 4700, damageClose: 80, damageFar: 58, rangeMax: 190, falloffStart: 80, speedModifier: 0.80, recoilPitch: 2.1, recoilYaw: 0.85, spreadBase: 0.011, spreadMove: 0.05 }),
  SG550: weapon({ id: 'sg550', name: 'SG-550', category: WEAPON_CATEGORIES.SNIPER, cost: 4200, equipmentSlot: 'primary', ammoType: '556', magazine: 30, reserveMax: 90, fireRate: 4.3, reloadMs: 3800, damageClose: 70, damageFar: 50, rangeMax: 180, falloffStart: 75, speedModifier: 0.81, recoilPitch: 1.9, recoilYaw: 0.78, spreadBase: 0.011, spreadMove: 0.048 }),
  M249: weapon({ id: 'm249', name: 'M249', category: WEAPON_CATEGORIES.MACHINE_GUN, cost: 5750, equipmentSlot: 'primary', ammoType: '556belt', magazine: 100, reserveMax: 200, fireRate: 10.8, reloadMs: 5700, damageClose: 32, damageFar: 20, rangeMax: 100, falloffStart: 32, speedModifier: 0.74, recoilPitch: 1.4, recoilYaw: 0.9, spreadBase: 0.024, spreadMove: 0.06 }),
});

export const WEAPON_LIST = Object.freeze(Object.values(WEAPONS));

export const WEAPONS_BY_ID = Object.freeze(Object.fromEntries(WEAPON_LIST.map((entry) => [entry.id, entry])));

export const getWeaponById = (weaponId) => WEAPONS_BY_ID[weaponId] ?? null;

export const createWeaponState = (weaponId) => {
  const selectedWeapon = getWeaponById(weaponId);

  if (!selectedWeapon) {
    throw new Error(`Unknown weapon id: ${weaponId}`);
  }

  return Object.freeze({
    weaponId: selectedWeapon.id,
    ammoInMagazine: selectedWeapon.ammo.magazine,
    reserveAmmo: selectedWeapon.ammo.reserveMax,
    nextFireAtMs: 0,
    isReloading: false,
    reloadCompleteAtMs: 0,
    shotsFired: 0,
  });
};

export const createSeededRandom = (seed) => {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

export const computeDamageAtDistance = (selectedWeapon, distance) => {
  if (selectedWeapon.damage.close <= 0 || selectedWeapon.range.max <= 0 || distance > selectedWeapon.range.max) {
    return 0;
  }

  if (distance <= selectedWeapon.range.falloffStart) {
    return selectedWeapon.damage.close;
  }

  const falloffDistance = selectedWeapon.range.max - selectedWeapon.range.falloffStart;
  const falloffProgress = Math.min(1, (distance - selectedWeapon.range.falloffStart) / falloffDistance);
  return Math.round(selectedWeapon.damage.close + (selectedWeapon.damage.far - selectedWeapon.damage.close) * falloffProgress);
};

export const computeSpreadOffset = (selectedWeapon, { seed = 1, shotIndex = 0, moving = false } = {}) => {
  const random = createSeededRandom((seed + Math.imul(shotIndex + 1, 2654435761)) >>> 0);
  const spreadRadius = selectedWeapon.spread.base + (moving ? selectedWeapon.spread.moving : 0) + shotIndex * 0.0015;
  const recoilYaw = selectedWeapon.recoil.yaw * (shotIndex + 1) * 0.01;
  const recoilPitch = selectedWeapon.recoil.pitch * (shotIndex + 1) * 0.01;

  return Object.freeze({
    yaw: Number(((random() * 2 - 1) * spreadRadius + recoilYaw).toFixed(6)),
    pitch: Number(((random() * 2 - 1) * spreadRadius + recoilPitch).toFixed(6)),
  });
};

export const normalizeDirection = (direction) => {
  const length = Math.hypot(direction.x, direction.y, direction.z);

  if (length === 0) {
    return Object.freeze({ x: 0, y: 0, z: 1 });
  }

  return Object.freeze({ x: direction.x / length, y: direction.y / length, z: direction.z / length });
};

export const applySpreadToDirection = (direction, spreadOffset) => normalizeDirection({
  x: direction.x + spreadOffset.yaw,
  y: direction.y + spreadOffset.pitch,
  z: direction.z,
});

export const traceHitscan = ({ origin, direction, maxRange, targets = [] }) => {
  const rayDirection = normalizeDirection(direction);
  let closestHit = null;

  targets.forEach((target) => {
    const radius = target.radius ?? 0.5;
    const toTarget = {
      x: target.position.x - origin.x,
      y: target.position.y - origin.y,
      z: target.position.z - origin.z,
    };
    const distanceAlongRay = toTarget.x * rayDirection.x + toTarget.y * rayDirection.y + toTarget.z * rayDirection.z;

    if (distanceAlongRay < 0 || distanceAlongRay > maxRange) {
      return;
    }

    const closestPoint = {
      x: origin.x + rayDirection.x * distanceAlongRay,
      y: origin.y + rayDirection.y * distanceAlongRay,
      z: origin.z + rayDirection.z * distanceAlongRay,
    };
    const missDistance = Math.hypot(
      target.position.x - closestPoint.x,
      target.position.y - closestPoint.y,
      target.position.z - closestPoint.z,
    );

    if (missDistance <= radius && (closestHit === null || distanceAlongRay < closestHit.distance)) {
      closestHit = Object.freeze({ targetId: target.id, distance: Number(distanceAlongRay.toFixed(3)) });
    }
  });

  return closestHit;
};

export const fireWeapon = (weaponState, { nowMs = 0, seed = 1, moving = false, origin = { x: 0, y: 0, z: 0 }, direction = { x: 0, y: 0, z: 1 }, targets = [], altFire = false } = {}) => {
  const selectedWeapon = getWeaponById(weaponState.weaponId);

  if (!selectedWeapon) {
    throw new Error(`Unknown weapon id: ${weaponState.weaponId}`);
  }

  // Melee weapons bypass magazine/ammo/reload checks
  if (!selectedWeapon.isMelee) {
    if (selectedWeapon.ammo.magazine === 0) {
      return Object.freeze({ ok: false, reason: 'not-fireable', state: weaponState, shot: null });
    }

    if (weaponState.isReloading && nowMs < weaponState.reloadCompleteAtMs) {
      return Object.freeze({ ok: false, reason: 'reloading', state: weaponState, shot: null });
    }

    if (weaponState.ammoInMagazine <= 0) {
      return Object.freeze({ ok: false, reason: 'reload-required', state: weaponState, shot: null });
    }
  }

  if (nowMs < weaponState.nextFireAtMs) {
    return Object.freeze({ ok: false, reason: 'cooldown', state: weaponState, shot: null });
  }

  // Choose alt-fire values for melee weapons
  const useAlt = altFire && selectedWeapon.isMelee && selectedWeapon.altDamage;
  const effectiveRangeMax = useAlt && selectedWeapon.altRangeMax ? selectedWeapon.altRangeMax : selectedWeapon.range.max;
  const effectiveFireRate = useAlt && selectedWeapon.altFireRate ? selectedWeapon.altFireRate : selectedWeapon.fireRate;

  const shotIndex = weaponState.shotsFired;
  const spreadOffset = computeSpreadOffset(selectedWeapon, { seed, shotIndex, moving });
  const shotDirection = applySpreadToDirection(normalizeDirection(direction), spreadOffset);
  const hit = traceHitscan({ origin, direction: shotDirection, maxRange: effectiveRangeMax, targets });

  // Compute damage: alt-fire melee uses alt damage values (flat, no falloff)
  let damage = 0;
  if (hit) {
    if (useAlt) {
      damage = selectedWeapon.altDamage.close * selectedWeapon.damage.pellets;
    } else {
      damage = computeDamageAtDistance(selectedWeapon, hit.distance) * selectedWeapon.damage.pellets;
    }
  }

  // Melee weapons don't consume ammo
  const nextState = Object.freeze({
    ...weaponState,
    ammoInMagazine: selectedWeapon.isMelee ? weaponState.ammoInMagazine : weaponState.ammoInMagazine - 1,
    nextFireAtMs: nowMs + Math.ceil(1000 / effectiveFireRate),
    isReloading: false,
    reloadCompleteAtMs: 0,
    shotsFired: weaponState.shotsFired + 1,
  });

  return Object.freeze({
    ok: true,
    reason: 'fired',
    state: nextState,
    shot: Object.freeze({
      weaponId: selectedWeapon.id,
      direction: shotDirection,
      spreadOffset,
      hit,
      damage,
    }),
  });
};

export const startReload = (weaponState, nowMs = 0) => {
  const selectedWeapon = getWeaponById(weaponState.weaponId);

  if (!selectedWeapon || selectedWeapon.ammo.magazine === 0) {
    return Object.freeze({ ok: false, reason: 'not-reloadable', state: weaponState });
  }

  if (weaponState.ammoInMagazine >= selectedWeapon.ammo.magazine) {
    return Object.freeze({ ok: false, reason: 'magazine-full', state: weaponState });
  }

  if (weaponState.reserveAmmo <= 0) {
    return Object.freeze({ ok: false, reason: 'no-reserve-ammo', state: weaponState });
  }

  return Object.freeze({
    ok: true,
    reason: 'reload-started',
    state: Object.freeze({
      ...weaponState,
      isReloading: true,
      reloadCompleteAtMs: nowMs + selectedWeapon.reloadMs,
    }),
  });
};

export const completeReload = (weaponState, nowMs = weaponState.reloadCompleteAtMs) => {
  const selectedWeapon = getWeaponById(weaponState.weaponId);

  if (!selectedWeapon || !weaponState.isReloading || nowMs < weaponState.reloadCompleteAtMs) {
    return Object.freeze({ ok: false, reason: 'reload-not-ready', state: weaponState });
  }

  const neededAmmo = selectedWeapon.ammo.magazine - weaponState.ammoInMagazine;
  const loadedAmmo = Math.min(neededAmmo, weaponState.reserveAmmo);

  return Object.freeze({
    ok: true,
    reason: 'reload-complete',
    state: Object.freeze({
      ...weaponState,
      ammoInMagazine: weaponState.ammoInMagazine + loadedAmmo,
      reserveAmmo: weaponState.reserveAmmo - loadedAmmo,
      isReloading: false,
      reloadCompleteAtMs: 0,
      shotsFired: 0,
    }),
  });
};

export const getWeaponSpeedModifier = (weaponId) => getWeaponById(weaponId)?.speedModifier ?? 1;
