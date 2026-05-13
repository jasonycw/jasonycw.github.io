import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

// DOM Elements
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
  boostEnergy: 1,
};

const keys = new Set();
const mouseNdc = new THREE.Vector2();

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

import { clamp } from '../shared/utils.js';

function resetGame() {
  state.running = true;
  state.score = 0;
  state.health = 100;
  state.wave = 1;
  state.fireCooldown = 0;
  state.spawnTimer = 0;
  overlayEl.classList.add('hidden');
  startBtn.textContent = 'Start Defense';
}

function updateHud() {
  scoreEl.textContent = `${state.score}`;
  healthEl.textContent = `${Math.round(state.health)}`;
  waveEl.textContent = `${state.wave}`;
}

const playerGeometry = new THREE.SphereGeometry(1, 8, 8);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, emissive: 0x00ff00 });
const playerGroup = new THREE.Group();
scene.add(playerGroup);

for (let i = 0; i < 8; i++) {
  const slice = new THREE.Mesh(playerGeometry, playerMaterial.clone());
  slice.rotation.z = i * Math.PI / 4;
  playerGroup.add(slice);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);

  state.fireCooldown = Math.max(0, state.fireCooldown - dt);

  if (state.running) {
    // Player movement
    const moveInput = new THREE.Vector3();
    if (keys.has('w')) moveInput.z -= 1;
    if (keys.has('s')) moveInput.z += 1;
    if (keys.has('a')) moveInput.x -= 1;
    if (keys.has('d')) moveInput.x += 1;

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
      if (bullet.life <= 0) {
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.mesh.position.y += 0.02;

      // Simple approach: move enemy toward player
      const dx = playerGroup.position.x - enemy.mesh.position.x;
      const dz = playerGroup.position.z - enemy.mesh.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      if (dist < 1.5) {
        // Collision!
        state.health -= 10;
        if (state.health <= 0) {
          state.running = false;
          overlayEl.classList.remove('hidden');
          overlayEl.querySelector('h2').textContent = 'Mission Failed';
          overlayEl.querySelector('p').textContent = `Score: ${state.score}.`;
          startBtn.textContent = 'Restart Defense';
        }
      }

      // Move toward player
      if (dist > 0) {
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

window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

overlayEl.classList.add('hidden');
overlayEl.querySelector('h2').textContent = 'Defend the Island';
overlayEl.querySelector('p').textContent = 'Place turrets to stop the enemy drones from reaching your base.';

overlayEl.querySelector('button').addEventListener('click', resetGame);

updateHud();
tick();