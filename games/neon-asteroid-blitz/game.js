import * as THREE from 'three';

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const statusEl = document.getElementById('status');
const crosshairEl = document.getElementById('crosshair');
const appEl = document.getElementById('app');

if (!appEl) {
  throw new Error('Missing #app container for renderer mount.');
}

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050914, 0.045);

const initialWidth = appEl.clientWidth || window.innerWidth;
const initialHeight = appEl.clientHeight || window.innerHeight;

const camera = new THREE.PerspectiveCamera(58, initialWidth / initialHeight, 0.1, 1000);
camera.position.set(0, 26, 22);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(initialWidth, initialHeight);
appEl.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0x98ddff, 0x0f1527, 0.9);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0x89dbff, 0.9);
dirLight.position.set(12, 18, 8);
scene.add(dirLight);

const field = new THREE.Mesh(
  new THREE.CylinderGeometry(30, 30, 0.4, 80),
  new THREE.MeshStandardMaterial({
    color: 0x081225,
    emissive: 0x071526,
    emissiveIntensity: 0.4,
    metalness: 0.1,
    roughness: 0.9,
  })
);
field.position.y = -0.4;
scene.add(field);

const grid = new THREE.GridHelper(60, 40, 0x1f70d8, 0x0f315f);
grid.position.y = -0.19;
scene.add(grid);

const player = new THREE.Mesh(
  new THREE.ConeGeometry(0.8, 2.4, 12),
  new THREE.MeshStandardMaterial({
    color: 0x59caff,
    emissive: 0x1e8dff,
    emissiveIntensity: 0.85,
    metalness: 0.7,
    roughness: 0.2,
  })
);
player.rotation.x = Math.PI;
player.position.y = 0.8;
scene.add(player);

const playerRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.1, 0.08, 16, 48),
  new THREE.MeshBasicMaterial({ color: 0x5fffff })
);
playerRing.rotation.x = Math.PI / 2;
playerRing.position.y = 0.2;
scene.add(playerRing);

const starGeo = new THREE.BufferGeometry();
const starCount = 800;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  starPositions[i * 3] = (Math.random() - 0.5) * 260;
  starPositions[i * 3 + 1] = Math.random() * 180 + 10;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 260;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ size: 0.75, color: 0x7fb6ff })
);
scene.add(stars);

const keyboard = new Set();
const mouse = new THREE.Vector2();
const aimPoint = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const bullets = [];
const asteroids = [];
const effects = [];

let score = 0;
let lives = 3;
let gameOver = false;
let spawnTimer = 0;
let shootCooldown = 0;
let waveTimer = 0;
let spawnInterval = 1.1;

function updateHUD() {
  scoreEl.textContent = `${score}`;
  livesEl.textContent = `${lives}`;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function resetGame() {
  bullets.forEach(({ mesh }) => scene.remove(mesh));
  asteroids.forEach(({ mesh }) => scene.remove(mesh));
  effects.forEach(({ mesh }) => scene.remove(mesh));
  bullets.length = 0;
  asteroids.length = 0;
  effects.length = 0;

  score = 0;
  lives = 3;
  spawnTimer = 0;
  shootCooldown = 0;
  waveTimer = 0;
  spawnInterval = 1.1;
  gameOver = false;
  player.position.set(0, 0.8, 0);
  updateHUD();
  setStatus('Survive and blast asteroids!');
}

function addImpact(position, color = 0xffc96f, size = 0.45) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 10, 10),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.copy(position);
  scene.add(mesh);
  effects.push({ mesh, life: 0.35, maxLife: 0.35 });
}

function spawnBullet() {
  const dir = aimPoint.clone().sub(player.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) return;
  dir.normalize();

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x9af8ff })
  );
  mesh.position.copy(player.position).add(dir.clone().multiplyScalar(1.3));
  mesh.position.y = 0.65;
  scene.add(mesh);

  bullets.push({ mesh, velocity: dir.multiplyScalar(26), life: 1.1 });
}

function spawnAsteroid() {
  const radius = 25 + Math.random() * 5;
  const angle = Math.random() * Math.PI * 2;
  const pos = new THREE.Vector3(Math.cos(angle) * radius, 0.8, Math.sin(angle) * radius);
  const towardCenter = player.position.clone().sub(pos).setY(0).normalize();
  const speed = 2.7 + Math.random() * 2.2 + score * 0.008;
  const size = 0.8 + Math.random() * 1.5;

  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({
      color: 0x6b6774,
      emissive: 0x3f2e43,
      emissiveIntensity: 0.35,
      roughness: 0.85,
      metalness: 0.12,
    })
  );
  mesh.position.copy(pos);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  scene.add(mesh);

  asteroids.push({
    mesh,
    radius: size * 0.85,
    velocity: towardCenter.multiplyScalar(speed),
    spin: new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4),
  });
}

function updateAimFromMouse() {
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(groundPlane, aimPoint);

  if (aimPoint) {
    const look = aimPoint.clone().sub(player.position);
    look.y = 0;
    if (look.lengthSq() > 0.01) {
      const yaw = Math.atan2(look.x, look.z);
      player.rotation.y = yaw;
      playerRing.rotation.z += 0.03;
    }
  }
}

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  crosshairEl.style.left = `${e.clientX}px`;
  crosshairEl.style.top = `${e.clientY}px`;
});

window.addEventListener('keydown', (e) => {
  keyboard.add(e.code);

  if (e.code === 'KeyR' && gameOver) {
    resetGame();
  }

  if (e.code === 'Space') {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  keyboard.delete(e.code);
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && !gameOver && shootCooldown <= 0) {
    spawnBullet();
    shootCooldown = 0.15;
  }
});

window.addEventListener('resize', () => {
  const width = appEl.clientWidth || window.innerWidth;
  const height = appEl.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

updateHUD();

let previous = performance.now();
function animate(now) {
  const dt = Math.min((now - previous) / 1000, 0.033);
  previous = now;

  stars.rotation.y += dt * 0.01;
  updateAimFromMouse();

  if (!gameOver) {
    const move = new THREE.Vector3(0, 0, 0);
    if (keyboard.has('KeyW') || keyboard.has('ArrowUp')) move.z -= 1;
    if (keyboard.has('KeyS') || keyboard.has('ArrowDown')) move.z += 1;
    if (keyboard.has('KeyA') || keyboard.has('ArrowLeft')) move.x -= 1;
    if (keyboard.has('KeyD') || keyboard.has('ArrowRight')) move.x += 1;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(12 * dt);
      player.position.add(move);
      player.position.x = THREE.MathUtils.clamp(player.position.x, -20, 20);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -20, 20);
      playerRing.position.x = player.position.x;
      playerRing.position.z = player.position.z;
    }

    if (keyboard.has('Space') && shootCooldown <= 0) {
      spawnBullet();
      shootCooldown = 0.15;
    }

    shootCooldown -= dt;
    spawnTimer -= dt;
    waveTimer += dt;

    if (waveTimer > 8) {
      waveTimer = 0;
      spawnInterval = Math.max(0.45, spawnInterval - 0.08);
      setStatus('Asteroid activity increasing!');
      setTimeout(() => {
        if (!gameOver) setStatus('Survive and blast asteroids!');
      }, 1200);
    }

    if (spawnTimer <= 0) {
      spawnAsteroid();
      if (Math.random() < 0.25 + Math.min(score / 800, 0.35)) spawnAsteroid();
      spawnTimer = spawnInterval * (0.65 + Math.random() * 0.75);
    }

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.mesh.position.addScaledVector(bullet.velocity, dt);
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.mesh.position.length() > 40) {
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i -= 1) {
      const asteroid = asteroids[i];
      asteroid.mesh.position.addScaledVector(asteroid.velocity, dt);
      asteroid.mesh.rotation.x += asteroid.spin.x * dt;
      asteroid.mesh.rotation.y += asteroid.spin.y * dt;
      asteroid.mesh.rotation.z += asteroid.spin.z * dt;

      if (asteroid.mesh.position.distanceToSquared(player.position) < (asteroid.radius + 0.7) ** 2) {
        addImpact(player.position, 0xff6060, asteroid.radius * 0.7);
        scene.remove(asteroid.mesh);
        asteroids.splice(i, 1);
        lives -= 1;
        updateHUD();
        setStatus('Direct hit! Keep moving!');

        if (lives <= 0) {
          gameOver = true;
          setStatus(`Game Over — Final Score: ${score}. Press R to restart.`);
        }
      }
    }

    for (let a = asteroids.length - 1; a >= 0; a -= 1) {
      const asteroid = asteroids[a];
      for (let b = bullets.length - 1; b >= 0; b -= 1) {
        const bullet = bullets[b];
        if (asteroid.mesh.position.distanceToSquared(bullet.mesh.position) < (asteroid.radius + 0.22) ** 2) {
          addImpact(asteroid.mesh.position, 0xffd98e, asteroid.radius * 0.35);
          scene.remove(asteroid.mesh);
          scene.remove(bullet.mesh);
          asteroids.splice(a, 1);
          bullets.splice(b, 1);
          score += 10;
          updateHUD();
          break;
        }
      }
    }
  }

  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.life -= dt;
    effect.mesh.scale.multiplyScalar(1 + dt * 4.6);
    effect.mesh.material.opacity = Math.max(effect.life / effect.maxLife, 0);
    effect.mesh.material.transparent = true;

    if (effect.life <= 0) {
      scene.remove(effect.mesh);
      effects.splice(i, 1);
    }
  }

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.25, 0.08);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, 22 + player.position.z * 0.2, 0.08);
  camera.lookAt(player.position.x, 0, player.position.z);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resetGame();
requestAnimationFrame(animate);
