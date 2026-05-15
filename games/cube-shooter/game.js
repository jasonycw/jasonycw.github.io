import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';
import { clamp } from '../shared/utils.js';

// DOM Elements
const scoreEl = document.querySelector('#score');
const healthEl = document.querySelector('#health');
const timeEl = document.querySelector('#time');
const overlayEl = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');

const ws = document.createElement('p');
ws.style.color = 'white';
overlayEl.querySelector('.card').appendChild(ws);

const state = {
  running: false,
  score: 0,
  health: 100,
  timeLeft: 60,
  fireCooldown: 0,
  spawnTimer: 0,
};

const keys = new Set();
const mouseNdc = new THREE.Vector2();
const moveInput = new THREE.Vector3();
const mouseAimPoint = new THREE.Vector3();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x02060f, 40, 120);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 8, 12);
camera.lookAt(0, 5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x8ec5ff, 0x0b0f21, 0.95);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0x8dc5ff, 1);
dir.position.set(8, 5, 5);
scene.add(dir);

const starGeo = new THREE.BufferGeometry();
const stars = [];
for (let i = 0; i < 500; i += 1) {
  stars.push((Math.random() - 0.5) * 80, Math.random() * 20 - 10, (Math.random() - 0.5) * 80);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa3c2ff, size: 0.25 }));
scene.add(starField);

const bulletGeo = new THREE.SphereGeometry(0.13, 8, 8);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffea88 });
const bullets = [];
const enemies = [];
const enemyGeo = new THREE.BoxGeometry(1,1,1);
const enemyMat = new THREE.MeshBasicMaterial({ color: 0xff6959 });

const clock = new THREE.Clock();

function spawnEnemy() {
  const mesh = new THREE.Mesh(enemyGeo, enemyMat);
  const radius = 30 + Math.random() * 10;
  const angle = Math.random() * Math.PI * 2;
  mesh.position.set(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius);
  scene.add(mesh);

  enemies.push({
    mesh,
    speed: 1 + Math.random() * 2,
    hp: 1,
  });
}

function fireBullet() {
  if (state.fireCooldown > 0 || !state.running) return;

  const mesh = new THREE.Mesh(bulletGeo, bulletMat);
  mesh.position.copy(playerGroup.position);
  scene.add(mesh);

  const dir = new THREE.Vector3(Math.sin(playerGroup.rotation.y), 0, Math.cos(playerGroup.rotation.y));
  bullets.push({ mesh, velocity: dir.multiplyScalar(25), life: 1 });

  state.fireCooldown = 0.2;
}

// Helper functions

function resetGame() {
  state.running = true;
  state.score = 0;
  state.health = 100;
  state.timeLeft = 60;
  state.fireCooldown = 0;
  state.spawnTimer = 0;
  ws.textContent = '';

  for (const item of [...bullets, ...enemies]) {
    scene.remove(item.mesh);
  }
  bullets.length = 0;
  enemies.length = 0;

  overlayEl.classList.add('hidden');
  startBtn.textContent = 'Start Simulation';
}

function updateHud() {
  scoreEl.textContent = `${state.score}`;
  healthEl.textContent = `${Math.round(state.health)}`;
  timeEl.textContent = `${Math.round(state.timeLeft)}`;
}

// Player setup
const playerGeometry = new THREE.SphereGeometry(1, 8, 8);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, emissive: 0x00ff00 });
const playerGroup = new THREE.Group();
scene.add(playerGroup);

for (let i = 0; i < 8; i++) {
  const slice = new THREE.Mesh(playerGeometry, playerMaterial);
  slice.rotation.z = i * Math.PI / 4;
  playerGroup.add(slice);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (state.running) {
    // Spawn enemies periodically
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = 2; // spawn every 2 seconds
    }

    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      state.running = false;
      overlayEl.classList.remove('hidden');
      overlayEl.querySelector('h2').textContent = 'Simulation Complete';
      overlayEl.querySelector('p').textContent = `Final score: ${state.score}. Health remaining: ${Math.round(state.health)}%.`;
      startBtn.textContent = 'Restart Simulation';
      updateHud();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
      return;
    }

    // Player movement
    moveInput.set(0, 0, 0);
    if (keys.has('w') || keys.has('arrowup')) moveInput.z -= 1;
    if (keys.has('s') || keys.has('arrowdown')) moveInput.z += 1;
    if (keys.has('a') || keys.has('arrowleft')) moveInput.x -= 1;
    if (keys.has('d') || keys.has('arrowright')) moveInput.x += 1;

    if (moveInput.lengthSq() > 0) moveInput.normalize();

    const speed = 4;
    playerGroup.position.x += moveInput.x * speed * dt;
    playerGroup.position.z += moveInput.z * speed * dt;

    // Keep player within bounds
    playerGroup.position.x = clamp(playerGroup.position.x, -25, 25);
    playerGroup.position.z = clamp(playerGroup.position.z, -25, 25);

    // Fire bullets on mouse click or spacebar
    if (keys.has(' ') && state.running) {
      fireBullet();
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.mesh.position.addScaledVector(bullet.velocity, dt);
      bullet.life -= dt;
      let hitEnemy = false;

      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (bullet.mesh.position.distanceToSquared(enemy.mesh.position) < 0.85) {
          scene.remove(enemy.mesh);
          scene.remove(bullet.mesh);
          enemies.splice(j, 1);
          bullets.splice(i, 1);
          state.score += 10;
          hitEnemy = true;
          break;
        }
      }

      if (hitEnemy) continue;

      if (bullet.life <= 0) {
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];

      // Simple approach: move enemy toward player
      const dx = playerGroup.position.x - enemy.mesh.position.x;
      const dz = playerGroup.position.z - enemy.mesh.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < 2.25) {
        // Collision!
        state.health -= 10;
        scene.remove(enemy.mesh);
        enemies.splice(i, 1);
        if (state.health <= 0) {
          state.running = false;
          overlayEl.classList.remove('hidden');
          overlayEl.querySelector('h2').textContent = 'Mission Failed';
          overlayEl.querySelector('p').textContent = `Score: ${state.score}. Time survived: ${Math.round(60-state.timeLeft)}s`;
          startBtn.textContent = 'Restart Simulation';
          ws.style.color = 'darkred';
          ws.textContent = 'You were hit by an enemy!';
        }
        continue;
      }

      // Move toward player
      if (distSq > 0) {
        const dist = Math.sqrt(distSq);
        enemy.mesh.position.x += (dx/dist) * enemy.speed * dt;
        enemy.mesh.position.z += (dz/dist) * enemy.speed * dt;
      }

      // Remove if too far
      if (enemy.mesh.position.x < -40 || enemy.mesh.position.x > 40 ||
          enemy.mesh.position.z < -40 || enemy.mesh.position.z > 40) {
        scene.remove(enemy.mesh);
        enemies.splice(i, 1);
      }
    }

    updateHud();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Mouse click fire
window.addEventListener('mousedown', fireBullet, false);

window.addEventListener('mousemove', (event) => {
  mouseNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  raycaster.ray.intersectPlane(groundPlane, mouseAimPoint);
  const dx = mouseAimPoint.x - playerGroup.position.x;
  const dz = mouseAimPoint.z - playerGroup.position.z;
  if (dx * dx + dz * dz > 0.001) {
    playerGroup.rotation.y = Math.atan2(dx, dz);
  }
}, false);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

// Set up overlay button
overlayEl.querySelector('h2').textContent = 'Training Simulation';
overlayEl.querySelector('p').textContent = 'Destroy the incoming cubes to test your shooting skills.';

overlayEl.querySelector('button').addEventListener('click', resetGame);

updateHud();
tick();
