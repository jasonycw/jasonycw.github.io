import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const scoreEl = document.querySelector('#score');
const healthEl = document.querySelector('#health');
const waveEl = document.querySelector('#wave');
const overlayEl = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');

const state = {
  running: false,
  score: 0,
  health: 100,
  wave: 1,
  fireCooldown: 0,
  spawnTimer: 0,
  waveTimer: 0,
  boostEnergy: 1,
  gameOver: false,
};

const keys = new Set();
const mouseNdc = new THREE.Vector2();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x02060f, 40, 120);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 18, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x8ec5ff, 0x0b0f21, 0.95);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0x8dc5ff, 1);
dir.position.set(8, 14, 5);
scene.add(dir);

const grid = new THREE.GridHelper(110, 44, 0x2f8cff, 0x1d2a50);
grid.position.y = -0.7;
scene.add(grid);

const playerGroup = new THREE.Group();
scene.add(playerGroup);

const shipBody = new THREE.Mesh(
  new THREE.ConeGeometry(0.7, 2.2, 12),
  new THREE.MeshStandardMaterial({ color: 0x35d3ff, emissive: 0x0f3454, roughness: 0.3 })
);
shipBody.rotation.x = Math.PI / 2;
playerGroup.add(shipBody);

const wing = new THREE.Mesh(
  new THREE.BoxGeometry(2.4, 0.15, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x89e9ff, metalness: 0.3, roughness: 0.4 })
);
wing.position.z = -0.2;
playerGroup.add(wing);

const thruster = new THREE.PointLight(0x46b3ff, 2, 6, 2);
thruster.position.set(0, 0, -1.3);
playerGroup.add(thruster);

const starGeo = new THREE.BufferGeometry();
const stars = [];
for (let i = 0; i < 1200; i += 1) {
  stars.push((Math.random() - 0.5) * 220, Math.random() * 120 - 20, (Math.random() - 0.5) * 220);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa3c2ff, size: 0.35 }));
scene.add(starField);

const bullets = [];
const enemies = [];
const sparks = [];

const bulletGeo = new THREE.SphereGeometry(0.13, 10, 10);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffea88 });

const enemyGeo = new THREE.OctahedronGeometry(0.9, 0);
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff6959, emissive: 0x551111, roughness: 0.35 });

const clock = new THREE.Clock();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function spawnEnemy() {
  const mesh = new THREE.Mesh(enemyGeo, enemyMat.clone());
  const radius = 26 + Math.random() * 18;
  const angle = Math.random() * Math.PI * 2;
  mesh.position.set(Math.cos(angle) * radius, 0.3, Math.sin(angle) * radius);
  scene.add(mesh);

  enemies.push({
    mesh,
    speed: 3.2 + Math.random() * 1.8 + state.wave * 0.18,
    hp: 1 + Math.floor(state.wave / 4),
    rotSpeed: (Math.random() - 0.5) * 2,
  });
}

function fireBullet() {
  if (state.fireCooldown > 0 || !state.running) {
    return;
  }

  const mesh = new THREE.Mesh(bulletGeo, bulletMat);
  mesh.position.copy(playerGroup.position);
  mesh.position.y = 0.2;
  scene.add(mesh);

  const dir = new THREE.Vector3(Math.sin(playerGroup.rotation.y), 0, Math.cos(playerGroup.rotation.y));
  bullets.push({ mesh, velocity: dir.multiplyScalar(30), life: 1.05 });

  state.fireCooldown = 0.16;
}

function spawnSparks(position, amount = 8) {
  for (let i = 0; i < amount; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc777 })
    );
    mesh.position.copy(position);
    scene.add(mesh);

    sparks.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8),
      life: 0.6 + Math.random() * 0.5,
    });
  }
}

function cleanupDeadItems() {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
    }
  }

  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const spark = sparks[i];
    if (spark.life <= 0) {
      scene.remove(spark.mesh);
      sparks.splice(i, 1);
    }
  }
}

function damagePlayer(amount) {
  state.health = clamp(state.health - amount, 0, 100);
  if (state.health <= 0) {
    state.running = false;
    state.gameOver = true;
    overlayEl.classList.remove('hidden');
    overlayEl.querySelector('h2').textContent = 'Mission Failed';
    overlayEl.querySelector('p').textContent = `Final score: ${state.score}. Press Start Mission to retry.`;
    startBtn.textContent = 'Retry Mission';
  }
}

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.health = 100;
  state.wave = 1;
  state.fireCooldown = 0;
  state.spawnTimer = 0;
  state.waveTimer = 0;
  state.boostEnergy = 1;

  playerGroup.position.set(0, 0, 0);

  for (const item of [...bullets, ...enemies, ...sparks]) {
    scene.remove(item.mesh);
  }
  bullets.length = 0;
  enemies.length = 0;
  sparks.length = 0;

  overlayEl.classList.add('hidden');
  startBtn.textContent = 'Start Mission';
  overlayEl.querySelector('h2').textContent = 'Hold the Drift Lane';
  overlayEl.querySelector('p').textContent =
    'Rogue drones are stealing scrap from your station. Survive and clear waves to keep your lane open.';
}

function updateHud() {
  scoreEl.textContent = `${state.score}`;
  healthEl.textContent = `${Math.round(state.health)}`;
  waveEl.textContent = `${state.wave}`;
}

function movePlayer(dt) {
  const input = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) input.z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) input.z += 1;
  if (keys.has('a') || keys.has('arrowleft')) input.x -= 1;
  if (keys.has('d') || keys.has('arrowright')) input.x += 1;

  if (input.lengthSq() > 0) input.normalize();

  const boost = keys.has('shift') && state.boostEnergy > 0.05;
  const speed = boost ? 12.5 : 8.2;

  if (boost && input.lengthSq() > 0) {
    state.boostEnergy = clamp(state.boostEnergy - dt * 0.5, 0, 1);
  } else {
    state.boostEnergy = clamp(state.boostEnergy + dt * 0.32, 0, 1);
  }

  playerGroup.position.x = clamp(playerGroup.position.x + input.x * speed * dt, -24, 24);
  playerGroup.position.z = clamp(playerGroup.position.z + input.z * speed * dt, -24, 24);

  const mouseWorldX = mouseNdc.x * 17;
  const mouseWorldZ = mouseNdc.y * 13;
  const angle = Math.atan2(mouseWorldX - playerGroup.position.x, mouseWorldZ - playerGroup.position.z);
  playerGroup.rotation.y = angle;

  thruster.intensity = 1.2 + (boost ? 2.1 : 0.8) + Math.sin(performance.now() * 0.018) * 0.25;
}

function updateBullets(dt) {
  for (const bullet of bullets) {
    bullet.mesh.position.addScaledVector(bullet.velocity, dt);
    bullet.life -= dt;
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const toPlayer = new THREE.Vector3().subVectors(playerGroup.position, enemy.mesh.position);
    const dist = toPlayer.length();
    toPlayer.normalize();

    enemy.mesh.position.addScaledVector(toPlayer, enemy.speed * dt);
    enemy.mesh.rotation.y += enemy.rotSpeed * dt;

    if (dist < 1.2 && state.running) {
      damagePlayer(15);
      spawnSparks(enemy.mesh.position, 10);
      scene.remove(enemy.mesh);
      enemies.splice(i, 1);
      continue;
    }

    for (let b = bullets.length - 1; b >= 0; b -= 1) {
      const bullet = bullets[b];
      if (bullet.mesh.position.distanceTo(enemy.mesh.position) < 0.8) {
        enemy.hp -= 1;
        bullet.life = 0;
        if (enemy.hp <= 0) {
          state.score += 10;
          spawnSparks(enemy.mesh.position, 14);
          scene.remove(enemy.mesh);
          enemies.splice(i, 1);
        }
        break;
      }
    }
  }
}

function updateSparks(dt) {
  for (const spark of sparks) {
    spark.mesh.position.addScaledVector(spark.velocity, dt);
    spark.velocity.multiplyScalar(0.96);
    spark.life -= dt;
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);

  state.fireCooldown = Math.max(0, state.fireCooldown - dt);

  if (state.running) {
    movePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateSparks(dt);
    cleanupDeadItems();

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      const base = Math.max(0.38, 1.3 - state.wave * 0.07);
      state.spawnTimer = base + Math.random() * 0.55;
    }

    state.waveTimer += dt;
    if (state.waveTimer >= 18) {
      state.wave += 1;
      state.waveTimer = 0;
      state.health = clamp(state.health + 8, 0, 100);
    }

    camera.position.x += (playerGroup.position.x * 0.2 - camera.position.x) * dt * 3;
    camera.position.z += (playerGroup.position.z + 20 - camera.position.z) * dt * 3;
    camera.lookAt(playerGroup.position.x, 0, playerGroup.position.z);
  }

  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key === ' ' && state.running) {
    event.preventDefault();
    fireBullet();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener('mousemove', (event) => {
  mouseNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -((event.clientY / window.innerHeight) * 2 - 1);
});

window.addEventListener('mousedown', () => {
  fireBullet();
});

startBtn.addEventListener('click', () => {
  resetGame();
});

updateHud();
tick();
