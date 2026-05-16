import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';


// DOM Elements
const levelEl = document.querySelector('#level');
const scoreEl = document.querySelector('#score');
const starsEl = document.querySelector('#stars');
const overlayEl = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');

const state = {
  running: false,
  level: 1,
  score: 0,
  stars: 0,
  lastPlatform: null,
};

const keys = new Set();
const moveInput = new THREE.Vector3();
let jumpRequested = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x02060f, 30, 120);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 12, 25);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x8ec5ff, 0x0b0f21, 0.9);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0x8dc5ff, 1);
dir.position.set(8, 10, 5);
scene.add(dir);

// Simple star field background
const starGeo = new THREE.BufferGeometry();
const stars = [];
for (let i = 0; i < 400; i++) {
  stars.push((Math.random() - 0.5) * 100, Math.random() * 30 - 15, (Math.random() - 0.5) * 100);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa3c2ff, size: 0.3 }));
scene.add(starField);

// Player – a simple sphere that can jump
const playerGeo = new THREE.SphereGeometry(1, 16, 16);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x35d3ff, emissive: 0x0f3454 });
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.y = 1.5;
scene.add(player);

const FALL_THRESHOLD = -10;
const clock = new THREE.Clock();

const platformGeo = new THREE.BoxGeometry(6, 1, 6);
const platformMat = new THREE.MeshStandardMaterial({ color: 0x2f8cff });

let platforms = [];
function createPlatform(x, z) {
  const p = new THREE.Mesh(platformGeo, platformMat);
  p.position.set(x, 0, z);
  scene.add(p);
  platforms.push(p);
}

function setupLevel(level) {
  // Clear previous platforms
  platforms.forEach(p => scene.remove(p));
  platforms = [];

  // Simple layout – five platforms per level (center + four cardinal)
  const spacing = Math.min(14, 10 + level);
  createPlatform(0, 0);
  createPlatform(spacing, 0);
  createPlatform(-spacing, 0);
  createPlatform(0, spacing);
  createPlatform(0, -spacing);
  // Reset player to first platform
  player.position.set(0, 1.5, 0);
  player.userData.velY = undefined;
  state.stars = 0;
  state.lastPlatform = platforms[0];
}

function currentPlatform() {
  return platforms.find((platform) => (
    Math.abs(player.position.x - platform.position.x) <= 3.5 &&
    Math.abs(player.position.z - platform.position.z) <= 3.5
  ));
}

function isOverPlatform() {
  return Boolean(currentPlatform());
}

function isGrounded() {
  return player.position.y <= 1.5 && isOverPlatform();
}

function failRun() {
  state.running = false;
  overlayEl.classList.remove('hidden');
  overlayEl.querySelector('h2').textContent = 'Lost in the Clouds';
  overlayEl.querySelector('p').textContent = `Score: ${state.score}. Level reached: ${state.level}.`;
  startBtn.textContent = 'Restart Adventure';
}

function resetGame() {
  state.running = true;
  state.level = 1;
  state.score = 0;
  overlayEl.classList.add('hidden');
  startBtn.textContent = 'Restart Adventure';
  setupLevel(state.level);
  updateHud();
}

function updateHud() {
  levelEl.textContent = state.level;
  scoreEl.textContent = state.score;
  starsEl.textContent = state.stars;
}

function tick() {
  const dt = Math.min(0.1, clock.getDelta());

  if (state.running) {
    // Simple WASD movement on the XZ plane
    moveInput.set(0, 0, 0);
    if (keys.has('KeyW')) moveInput.z -= 1;
    if (keys.has('KeyS')) moveInput.z += 1;
    if (keys.has('KeyA')) moveInput.x -= 1;
    if (keys.has('KeyD')) moveInput.x += 1;
    if (moveInput.lengthSq() > 0) moveInput.normalize();
    const speed = 12;
    player.position.x += moveInput.x * speed * dt;
    player.position.z += moveInput.z * speed * dt;

    // Keep player within bounds of current platforms
    const bounds = 25 + state.level * 5;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -bounds, bounds);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -bounds, bounds);

    // Jump on space – simple upward impulse and gravity
    if (jumpRequested && isGrounded()) {
      player.userData.velY = 12;
    }
    jumpRequested = false;
    if (player.userData.velY !== undefined) {
      player.position.y += player.userData.velY * dt;
      player.userData.velY -= 20 * dt; // gravity
      if (player.position.y <= 1.5 && isOverPlatform()) {
        player.position.y = 1.5;
        player.userData.velY = undefined;
      }
    } else if (!isOverPlatform()) {
      player.userData.velY = 0;
    }

    if (player.position.y < FALL_THRESHOLD) failRun();

    const landedPlatform = currentPlatform();
    if (landedPlatform && landedPlatform !== state.lastPlatform && player.position.y <= 1.5) {
      state.lastPlatform = landedPlatform;
      state.stars += 1;
      state.score += 10;
    }

    // Level progression – after 5 stars
    if (state.stars >= 5) {
      state.level += 1;
      setupLevel(state.level);
    }

    updateHud();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) jumpRequested = true;
  }
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));

overlayEl.querySelector('button').addEventListener('click', resetGame);

tick();
