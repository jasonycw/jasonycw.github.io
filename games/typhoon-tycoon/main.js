import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

// UI elements
const scoreEl = document.querySelector('#score');
const resourcesEl = document.querySelector('#resources');
const healthEl = document.querySelector('#health');
const waveEl = document.querySelector('#wave');
const overlayEl = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');

// Game constants
const ARENA_LIMIT = 24;
const BASE_RADIUS = 2.3;
const TURRET_COST = 50;
const TURRET_SPACING_SQ = 4.84;
const STARTING_RESOURCES = 100;
const ENEMY_REWARD = 10;
const PROJECTILE_HITBOX_RADIUS_SQ = 0.81;

// Spatial grid for fast turret targeting
const _SPATIAL_CELL = 10;
const _spatialGrid = new Map();
const _activeCells = [];

function _gridKey(cx, cz) {
  return ((cx * 997 + cz * 991) >>> 0);
}

function _buildGrid() {
  for (const c of _activeCells) c.length = 0;
  _activeCells.length = 0;
  for (const e of enemies) {
    const k = _gridKey(
      Math.floor(e.mesh.position.x / _SPATIAL_CELL),
      Math.floor(e.mesh.position.z / _SPATIAL_CELL)
    );
    let c = _spatialGrid.get(k);
    if (!c) { c = []; _spatialGrid.set(k, c); }
    if (c.length === 0) _activeCells.push(c);
    c.push(e);
  }
}

function _nearbyEnemies(pos, rangeSq, fn) {
  const range = Math.sqrt(rangeSq);
  const cellRange = Math.ceil(range / _SPATIAL_CELL);
  const cx = Math.floor(pos.x / _SPATIAL_CELL);
  const cz = Math.floor(pos.z / _SPATIAL_CELL);
  for (let dx = -cellRange; dx <= cellRange; dx++) {
    for (let dz = -cellRange; dz <= cellRange; dz++) {
      const cell = _spatialGrid.get(_gridKey(cx + dx, cz + dz));
      if (!cell) continue;
      for (const e of cell) {
        if (e.dead) continue;
        if (pos.distanceToSquared(e.mesh.position) < rangeSq) {
          if (fn(e)) return;
        }
      }
    }
  }
}

// Game state
const state = {
  running: false,
  score: 0,
  resources: STARTING_RESOURCES,
  health: 100,
  wave: 1,
  spawnTimer: 0,
  spawnedThisWave: 0,
  nextWaveDelay: 0,
};

const keys = new Set();
const enemies = [];
const turrets = [];
const projectiles = [];
let _tickRafId = null;

// Input helpers
const pointer = new THREE.Vector2();
const targetPoint = new THREE.Vector3();
const enemyDirection = new THREE.Vector3();
const turretMove = new THREE.Vector3();
const turretAim = new THREE.Vector3();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();

// Three.js scene setup
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x02060f, 42, 120);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 28, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lights
const hemi = new THREE.HemisphereLight(0x9ed5ff, 0x07111f, 0.95);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xb2e8ff, 1.2);
dir.position.set(8, 16, 10);
scene.add(dir);

// Stars background
const starGeo = new THREE.BufferGeometry();
const stars = [];
for (let i = 0; i < 500; i++) {
  stars.push((Math.random() - 0.5) * 120, Math.random() * 45 + 6, (Math.random() - 0.5) * 120);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa3c2ff, size: 0.25 })));

// Island ground
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(28, 23, 1.2, 72),
  new THREE.MeshStandardMaterial({ color: 0x10273b, roughness: 0.75, metalness: 0.1, emissive: 0x04101c })
);
island.position.y = -0.65;
scene.add(island);

// Path (typhoon trajectory)
const path = new THREE.Mesh(
  new THREE.PlaneGeometry(48, 3.2),
  new THREE.MeshBasicMaterial({ color: 0x25425f, transparent: true, opacity: 0.72 })
);
path.rotation.x = -Math.PI / 2;
path.position.z = 0;
scene.add(path);

// Base core
const base = new THREE.Group();
const baseCore = new THREE.Mesh(
  new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS * 1.25, 1.8, 32),
  new THREE.MeshStandardMaterial({ color: 0x35d3ff, emissive: 0x0a5f7a, emissiveIntensity: 0.6 })
);
baseCore.position.y = 0.9;
base.add(baseCore);
const baseRing = new THREE.Mesh(
  new THREE.RingGeometry(BASE_RADIUS + 0.25, BASE_RADIUS + 0.55, 48),
  new THREE.MeshBasicMaterial({ color: 0x8ef8ff, transparent: true, opacity: 0.5 })
);
baseRing.rotation.x = -Math.PI / 2;
baseRing.position.y = 0.04;
base.add(baseRing);
scene.add(base);

// Add a rotating ring for visual effect (same as tower-defense)
const visualBaseRing = baseRing.clone();
visualBaseRing.material = baseRing.material.clone();
scene.add(visualBaseRing);

// Cursor for tower placement
const cursor = new THREE.Group();
const cursorPad = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1.25, 28),
  new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.75 })
);
cursorPad.rotation.x = -Math.PI / 2;
cursor.add(cursorPad);
const cursorBarrel = new THREE.Mesh(
  new THREE.ConeGeometry(0.32, 1.25, 16),
  new THREE.MeshBasicMaterial({ color: 0xffd166 })
);
cursorBarrel.rotation.x = Math.PI / 2;
cursorBarrel.position.set(0, 0.55, 0.45);
cursor.add(cursorBarrel);
cursor.position.set(-7, 0.08, 7);
scene.add(cursor);

// Geometry & materials for entities
const enemyGeo = new THREE.IcosahedronGeometry(0.75, 0);
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff6959, emissive: 0x72160f, emissiveIntensity: 0.55 });
const projectileGeo = new THREE.SphereGeometry(0.18, 10, 10);
const projectileMat = new THREE.MeshBasicMaterial({ color: 0xfff1a3 });
const turretBaseGeo = new THREE.CylinderGeometry(0.85, 1.05, 0.55, 24);
const turretBaseMat = new THREE.MeshStandardMaterial({ color: 0x68d391, emissive: 0x124d2d, emissiveIntensity: 0.28 });
const turretBarrelGeo = new THREE.BoxGeometry(0.32, 0.32, 1.45);
const turretBarrelMat = new THREE.MeshStandardMaterial({ color: 0xd9fff0, emissive: 0x1f6b4a, emissiveIntensity: 0.24 });

// Temporary vectors for projectile firing
const _fireStart = new THREE.Vector3();
const _fireTarget = new THREE.Vector3();
const _fireVelocity = new THREE.Vector3();
const clock = new THREE.Clock();
let frameCount = 0;

function waveSize() { return 5 + state.wave * 2; }
function spawnEvery() { return Math.max(0.55, 1.65 - state.wave * 0.08); }

function spawnEnemy() {
  if (!state.running || state.spawnedThisWave >= waveSize()) return;
  const z = (Math.random() - 0.5) * 3.2;
  const mesh = new THREE.Mesh(enemyGeo, enemyMat);
  mesh.position.set(-ARENA_LIMIT, 0.75, z);
  scene.add(mesh);
  enemies.push({
    mesh,
    hp: 24 + state.wave * 6,
    maxHp: 24 + state.wave * 6,
    speed: 2.1 + state.wave * 0.12,
    dead: false,
  });
  state.spawnedThisWave++;
}

function makeTurret(position) {
  const group = new THREE.Group();
  const baseMesh = new THREE.Mesh(turretBaseGeo, turretBaseMat);
  baseMesh.position.y = 0.28;
  group.add(baseMesh);
  const barrel = new THREE.Mesh(turretBarrelGeo, turretBarrelMat);
  barrel.position.set(0, 0.75, 0.62);
  group.add(barrel);
  group.position.copy(position).setY(0);
  scene.add(group);
  turrets.push({ group, barrel, range: 10, cooldown: 0 });
}

function canPlaceTurret(position) {
  if (position.lengthSq() > (ARENA_LIMIT - 2) ** 2) return false;
  if (position.distanceToSquared(base.position) < (BASE_RADIUS + 2) ** 2) return false;
  if (Math.abs(position.z) < 2.65) return false;
  return !turrets.some(t => t.group.position.distanceToSquared(position) < TURRET_SPACING_SQ);
}

function tryPlaceTurret() {
  if (!state.running || state.resources < TURRET_COST) return;
  const pos = cursor.position.clone().setY(0);
  if (!canPlaceTurret(pos)) return;
  state.resources -= TURRET_COST;
  makeTurret(pos);
  updateHud();
}

function clearActors() {
  enemies.forEach(e => scene.remove(e.mesh));
  turrets.forEach(t => scene.remove(t.group));
  projectiles.forEach(p => scene.remove(p.mesh));
  enemies.length = 0;
  turrets.length = 0;
  projectiles.length = 0;
  _spatialGrid.clear();
  _activeCells.length = 0;
}

function resetGame() {
  clearActors();
  state.running = true;
  state.score = 0;
  state.resources = STARTING_RESOURCES;
  state.health = 100;
  state.wave = 1;
  state.spawnTimer = 0.6;
  state.spawnedThisWave = 0;
  state.nextWaveDelay = 0;
  frameCount = 0;
  cursor.position.set(-7, 0.08, 7);
  cursor.visible = true;
  overlayEl.classList.add('hidden');
  startBtn.textContent = 'Restart Defense';
  updateHud();
  if (_tickRafId) { cancelAnimationFrame(_tickRafId); _tickRafId = null; }
  tick();
}

function updateHud() {
  scoreEl.textContent = state.score;
  resourcesEl.textContent = state.resources;
  healthEl.textContent = Math.round(state.health);
  waveEl.textContent = state.wave;
}

function endGame() {
  state.running = false;
  overlayEl.classList.remove('hidden');
  overlayEl.querySelector('h2').textContent = 'Base Overrun';
  overlayEl.querySelector('p').textContent = `Final score: ${state.score}. Wave reached: ${state.wave}.`;
  startBtn.textContent = 'Restart Defense';
  updateHud();
}

function damageBase(amount) {
  state.health = Math.max(0, state.health - amount);
  if (state.health <= 0) endGame();
}

function destroyEnemy(targetEnemy) {
  targetEnemy.dead = true;
  const idx = enemies.indexOf(targetEnemy);
  if (idx !== -1) {
    scene.remove(targetEnemy.mesh);
    enemies.splice(idx, 1);
    state.score += ENEMY_REWARD;
    state.resources += ENEMY_REWARD;
  }
}

function fireFromTurret(turret, enemy) {
  _fireStart.copy(turret.group.position).setY(0.9);
  _fireTarget.copy(enemy.mesh.position).setY(0.75);
  const velocity = _fireVelocity.copy(_fireTarget).sub(_fireStart).normalize().multiplyScalar(18);
  const mesh = new THREE.Mesh(projectileGeo, projectileMat);
  mesh.position.copy(_fireStart);
  scene.add(mesh);
  projectiles.push({ mesh, velocity, damage: 18, life: 0.9, target: enemy });
  turret.cooldown = 0.65;
}

function updateCursor(dt) {
  const move = turretMove.set(0, 0, 0);
  if (keys.has('KeyW') || keys.has('ArrowUp')) move.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) move.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) move.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) move.x += 1;

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(9 * dt);
    cursor.position.add(move);
    cursor.position.x = THREE.MathUtils.clamp(cursor.position.x, -ARENA_LIMIT + 2, ARENA_LIMIT - 2);
    cursor.position.z = THREE.MathUtils.clamp(cursor.position.z, -ARENA_LIMIT + 2, ARENA_LIMIT - 2);
  }

  const direction = turretAim.subVectors(targetPoint, cursor.position).setY(0);
  if (direction.lengthSq() > 0.001) {
    cursor.rotation.y = Math.atan2(direction.x, direction.z);
  }

  cursorPad.material.color.set(
    canPlaceTurret(cursor.position) && state.resources >= TURRET_COST ? 0xffd166 : 0xff6959
  );
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const dir = enemyDirection.subVectors(base.position, enemy.mesh.position).setY(0);
    const distance = dir.length();
    if (distance <= BASE_RADIUS) {
      enemy.dead = true;
      scene.remove(enemy.mesh);
      enemies.splice(i, 1);
      damageBase(12);
      continue;
    }
    if (distance > 0) {
      enemy.mesh.position.addScaledVector(dir.divideScalar(distance), enemy.speed * dt);
    }
    enemy.mesh.rotation.x += dt * 2;
    enemy.mesh.rotation.y += dt * 3;
    const healthRatio = THREE.MathUtils.clamp(enemy.hp / enemy.maxHp, 0.25, 1);
    enemy.mesh.scale.setScalar(0.75 + healthRatio * 0.35);
  }
}

function updateTurrets(dt) {
  for (const turret of turrets) {
    turret.cooldown = Math.max(0, turret.cooldown - dt);
    let target = null;
    let nearestSq = turret.range ** 2;
    _nearbyEnemies(turret.group.position, nearestSq, (enemy) => {
      const d = turret.group.position.distanceToSquared(enemy.mesh.position);
      if (d < nearestSq) {
        nearestSq = d;
        target = enemy;
      }
    });
    if (!target) continue;
    const aim = turretAim.subVectors(target.mesh.position, turret.group.position).setY(0);
    if (aim.lengthSq() > 0.001) {
      turret.group.rotation.y = Math.atan2(aim.x, aim.z);
    }
    if (turret.cooldown <= 0) fireFromTurret(turret, target);
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.life -= dt;
    let hit = null;
    _nearbyEnemies(p.mesh.position, PROJECTILE_HITBOX_RADIUS_SQ, (e) => { hit = e; return true; });
    if (hit) {
      hit.hp -= p.damage;
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      if (hit.hp <= 0) destroyEnemy(hit);
      continue;
    }
    if (p.life <= 0) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function updateWave(dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.spawnedThisWave < waveSize()) {
    spawnEnemy();
    state.spawnTimer = spawnEvery();
  }
  if (state.spawnedThisWave >= waveSize() && enemies.length === 0) {
    state.nextWaveDelay += dt;
    if (state.nextWaveDelay >= 2) {
      state.wave++;
      state.health = Math.min(100, state.health + 8);
      state.spawnedThisWave = 0;
      state.spawnTimer = 0.8;
      state.nextWaveDelay = 0;
    }
  }
}

function tick() {
  // Check win condition: survive 10 waves and clear all enemies
  if (state.running && state.wave >= 10 && enemies.length === 0) {
    // Win condition achieved
    state.running = false;
    overlayEl.classList.remove('hidden');
    overlayEl.querySelector('h2').textContent = 'Victory!';
    overlayEl.querySelector('p').textContent = `You survived ${state.wave} waves and earned ${state.score} points.`;
    startBtn.textContent = 'Play Again';
    updateHud();
    return; // Skip rest of tick
  }

  const dt = Math.min(clock.getDelta(), 0.1);
  if (state.running) {
    updateCursor(dt);
    updateWave(dt);
    updateEnemies(dt);
    _buildGrid();
    updateTurrets(dt);
    updateProjectiles(dt);
  }
  if (frameCount++ % 15 === 0) updateHud();
  baseRing.rotation.z += dt * 0.9;
  renderer.render(scene, camera);
  if (state.running) _tickRafId = requestAnimationFrame(tick);
}

function updatePointer(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(groundPlane, targetPoint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

window.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY));
window.addEventListener('pointerdown', (e) => {
  if (!state.running || e.target !== renderer.domElement) return;
  updatePointer(e.clientX, e.clientY);
  cursor.position.set(
    THREE.MathUtils.clamp(targetPoint.x, -ARENA_LIMIT + 2, ARENA_LIMIT - 2),
    0.08,
    THREE.MathUtils.clamp(targetPoint.z, -ARENA_LIMIT + 2, ARENA_LIMIT - 2)
  );
  tryPlaceTurret();
});

window.addEventListener('keydown', (e) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Space' && !e.repeat) tryPlaceTurret();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });

overlayEl.classList.remove('hidden');
overlayEl.querySelector('h2').textContent = 'Defend the Island';
overlayEl.querySelector('p').textContent = 'Move the cursor, spend resources on towers, and stop typhoons before they reach the base.';
startBtn.textContent = 'Start Defense';
startBtn.addEventListener('click', resetGame);

updateHud();
tick();