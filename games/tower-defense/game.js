import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const scoreEl = document.querySelector('#score');
const resourcesEl = document.querySelector('#resources');
const healthEl = document.querySelector('#health');
const waveEl = document.querySelector('#wave');
const overlayEl = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');

const ARENA_LIMIT = 24;
const BASE_RADIUS = 2.3;
const TURRET_COST = 50;
const STARTING_RESOURCES = 100;
const ENEMY_REWARD = 10;

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
let frameCount = 0;

const pointer = new THREE.Vector2();
const targetPoint = new THREE.Vector3(0, 0, -4);
const enemyDirection = new THREE.Vector3();
const turretMove = new THREE.Vector3();
const turretAim = new THREE.Vector3();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x02060f, 42, 120);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 28, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x9ed5ff, 0x07111f, 0.95);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xb2e8ff, 1.2);
dir.position.set(8, 16, 10);
scene.add(dir);

const starGeo = new THREE.BufferGeometry();
const stars = [];
for (let i = 0; i < 500; i += 1) {
  stars.push((Math.random() - 0.5) * 120, Math.random() * 45 + 6, (Math.random() - 0.5) * 120);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa3c2ff, size: 0.25 })));

const island = new THREE.Mesh(
  new THREE.CylinderGeometry(28, 23, 1.2, 72),
  new THREE.MeshStandardMaterial({ color: 0x10273b, roughness: 0.75, metalness: 0.1, emissive: 0x04101c }),
);
island.position.y = -0.65;
scene.add(island);

const path = new THREE.Mesh(
  new THREE.PlaneGeometry(48, 3.2),
  new THREE.MeshBasicMaterial({ color: 0x25425f, transparent: true, opacity: 0.72 }),
);
path.rotation.x = -Math.PI / 2;
path.position.z = 0;
scene.add(path);

const base = new THREE.Group();
const baseCore = new THREE.Mesh(
  new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS * 1.25, 1.8, 32),
  new THREE.MeshStandardMaterial({ color: 0x35d3ff, emissive: 0x0a5f7a, emissiveIntensity: 0.6 }),
);
baseCore.position.y = 0.9;
base.add(baseCore);
const baseRing = new THREE.Mesh(
  new THREE.RingGeometry(BASE_RADIUS + 0.25, BASE_RADIUS + 0.55, 48),
  new THREE.MeshBasicMaterial({ color: 0x8ef8ff, transparent: true, opacity: 0.5 }),
);
baseRing.rotation.x = -Math.PI / 2;
baseRing.position.y = 0.04;
base.add(baseRing);
scene.add(base);

const cursor = new THREE.Group();
const cursorPad = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1.25, 28),
  new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.75 }),
);
cursorPad.rotation.x = -Math.PI / 2;
cursor.add(cursorPad);
const cursorBarrel = new THREE.Mesh(
  new THREE.ConeGeometry(0.32, 1.25, 16),
  new THREE.MeshBasicMaterial({ color: 0xffd166 }),
);
cursorBarrel.rotation.x = Math.PI / 2;
cursorBarrel.position.set(0, 0.55, -0.45);
cursor.add(cursorBarrel);
cursor.position.set(-7, 0.08, 7);
scene.add(cursor);

const enemyGeo = new THREE.IcosahedronGeometry(0.75, 0);
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff6959, emissive: 0x72160f, emissiveIntensity: 0.55 });
const projectileGeo = new THREE.SphereGeometry(0.18, 10, 10);
const projectileMat = new THREE.MeshBasicMaterial({ color: 0xfff1a3 });
const turretBaseGeo = new THREE.CylinderGeometry(0.85, 1.05, 0.55, 24);
const turretBaseMat = new THREE.MeshStandardMaterial({ color: 0x68d391, emissive: 0x124d2d, emissiveIntensity: 0.28 });
const turretBarrelGeo = new THREE.BoxGeometry(0.32, 0.32, 1.45);
const turretBarrelMat = new THREE.MeshStandardMaterial({ color: 0xd9fff0, emissive: 0x1f6b4a, emissiveIntensity: 0.24 });

const _fireStart = new THREE.Vector3();
const _fireTarget = new THREE.Vector3();
const clock = new THREE.Clock();

function waveSize() {
  return 5 + state.wave * 2;
}

function spawnEvery() {
  return Math.max(0.55, 1.65 - state.wave * 0.08);
}

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
  });
  state.spawnedThisWave += 1;
}

function makeTurret(position) {
  const group = new THREE.Group();
  const baseMesh = new THREE.Mesh(turretBaseGeo, turretBaseMat);
  baseMesh.position.y = 0.28;
  group.add(baseMesh);

  const barrel = new THREE.Mesh(turretBarrelGeo, turretBarrelMat);
  barrel.position.set(0, 0.75, -0.62);
  group.add(barrel);

  group.position.copy(position).setY(0);
  scene.add(group);
  turrets.push({ group, barrel, range: 10, cooldown: 0 });
}

function canPlaceTurret(position) {
  if (position.lengthSq() > (ARENA_LIMIT - 2) ** 2) return false;
  if (position.distanceToSquared(base.position) < (BASE_RADIUS + 2) ** 2) return false;
  if (Math.abs(position.z) < 2.0) return false;
  return !turrets.some((turret) => turret.group.position.distanceToSquared(position) < 4.84);
}

function tryPlaceTurret() {
  if (!state.running || state.resources < TURRET_COST) return;

  const position = cursor.position.clone().setY(0);
  if (!canPlaceTurret(position)) return;

  state.resources -= TURRET_COST;
  makeTurret(position);
  updateHud();
}

function clearActors() {
  for (const enemy of enemies) scene.remove(enemy.mesh);
  for (const turret of turrets) scene.remove(turret.group);
  for (const projectile of projectiles) scene.remove(projectile.mesh);
  enemies.length = 0;
  turrets.length = 0;
  projectiles.length = 0;
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
  cursor.position.set(-7, 0.08, 7);
  cursor.visible = true;
  overlayEl.classList.add('hidden');
  startBtn.textContent = 'Restart Defense';
  updateHud();
}

function updateHud() {
  scoreEl.textContent = `${state.score}`;
  resourcesEl.textContent = `${state.resources}`;
  healthEl.textContent = `${Math.round(state.health)}`;
  waveEl.textContent = `${state.wave}`;
}

function endGame() {
  state.running = false;
  overlayEl.classList.remove('hidden');
  overlayEl.querySelector('h2').textContent = 'Base Overrun';
  overlayEl.querySelector('p').textContent = `Final score: ${state.score}. Wave reached: ${state.wave}.`;
  startBtn.textContent = 'Restart Defense';
}

function damageBase(amount) {
  state.health = Math.max(0, state.health - amount);
  if (state.health <= 0) endGame();
}

function destroyEnemy(index) {
  const enemy = enemies[index];
  scene.remove(enemy.mesh);
  enemies.splice(index, 1);
  state.score += ENEMY_REWARD;
  state.resources += ENEMY_REWARD;
}

function fireFromTurret(turret, enemy) {
  _fireStart.copy(turret.group.position).setY(0.9);
  _fireTarget.copy(enemy.mesh.position).setY(0.75);
  const velocity = _fireTarget.sub(_fireStart).normalize().multiplyScalar(18).clone();
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

  cursorPad.material.color.set(canPlaceTurret(cursor.position) && state.resources >= TURRET_COST ? 0xffd166 : 0xff6959);
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const direction = enemyDirection.subVectors(base.position, enemy.mesh.position).setY(0);
    const distance = direction.length();

    if (distance <= BASE_RADIUS) {
      scene.remove(enemy.mesh);
      enemies.splice(i, 1);
      damageBase(12);
      continue;
    }

    if (distance > 0) {
      enemy.mesh.position.addScaledVector(direction.divideScalar(distance), enemy.speed * dt);
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

    for (const enemy of enemies) {
      const distanceSq = turret.group.position.distanceToSquared(enemy.mesh.position);
      if (distanceSq < nearestSq) {
        nearestSq = distanceSq;
        target = enemy;
      }
    }

    if (!target) continue;

    const aim = turretAim.subVectors(target.mesh.position, turret.group.position).setY(0);
    if (aim.lengthSq() > 0.001) {
      turret.group.rotation.y = Math.atan2(aim.x, aim.z);
    }

    if (turret.cooldown <= 0) fireFromTurret(turret, target);
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    projectile.mesh.position.addScaledVector(projectile.velocity, dt);
    projectile.life -= dt;

    // If target was already removed from scene, remove projectile (O(1) check)
    if (!projectile.target.mesh.parent) {
      scene.remove(projectile.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    if (projectile.mesh.position.distanceToSquared(projectile.target.mesh.position) < 0.9 ** 2) {
      projectile.target.hp -= projectile.damage;
      scene.remove(projectile.mesh);
      projectiles.splice(i, 1);
      if (projectile.target.hp <= 0) {
        const targetIndex = enemies.indexOf(projectile.target);
        if (targetIndex !== -1) destroyEnemy(targetIndex);
      }
      continue;
    }

    if (projectile.life <= 0) {
      scene.remove(projectile.mesh);
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
      state.wave += 1;
      state.health = Math.min(100, state.health + 8);
      state.spawnedThisWave = 0;
      state.spawnTimer = 0.8;
      state.nextWaveDelay = 0;
    }
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);

  if (state.running) {
    updateCursor(dt);
    updateWave(dt);
    updateProjectiles(dt);
  }
  if (frameCount++ % 15 === 0) updateHud();

  baseRing.rotation.z += dt * 0.9;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
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

window.addEventListener('pointermove', (event) => {
  updatePointer(event.clientX, event.clientY);
});

window.addEventListener('pointerdown', (event) => {
  if (!state.running || event.target !== renderer.domElement) return;
  updatePointer(event.clientX, event.clientY);
  cursor.position.x = THREE.MathUtils.clamp(targetPoint.x, -ARENA_LIMIT + 2, ARENA_LIMIT - 2);
  cursor.position.z = THREE.MathUtils.clamp(targetPoint.z, -ARENA_LIMIT + 2, ARENA_LIMIT - 2);
  tryPlaceTurret();
});

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.code === 'Space' && !event.repeat) {
    tryPlaceTurret();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

overlayEl.classList.remove('hidden');
overlayEl.querySelector('h2').textContent = 'Defend the Island';
overlayEl.querySelector('p').textContent = 'Move the placement cursor, spend resources on turrets, and stop drones before they reach the base.';
startBtn.textContent = 'Start Defense';
startBtn.addEventListener('click', resetGame);

updateHud();
tick();
