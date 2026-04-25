import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const canvas = document.getElementById("gameCanvas");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startButton");

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x03060a, 40, 120);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 28, 28);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const hemiLight = new THREE.HemisphereLight(0x88c9ff, 0x101828, 0.9);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0x9bd4ff, 0.95);
keyLight.position.set(8, 20, 10);
keyLight.castShadow = true;
scene.add(keyLight);

const arena = new THREE.Mesh(
  new THREE.CircleGeometry(24, 64),
  new THREE.MeshStandardMaterial({
    color: 0x0e2235,
    metalness: 0.15,
    roughness: 0.8,
    emissive: 0x061018,
    emissiveIntensity: 0.55,
  }),
);
arena.rotation.x = -Math.PI / 2;
arena.receiveShadow = true;
scene.add(arena);

const arenaRing = new THREE.Mesh(
  new THREE.RingGeometry(24, 24.8, 96),
  new THREE.MeshBasicMaterial({ color: 0x3f8dd6, transparent: true, opacity: 0.65 }),
);
arenaRing.rotation.x = -Math.PI / 2;
scene.add(arenaRing);

const starGeom = new THREE.BufferGeometry();
const starCount = 800;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  starPositions[i * 3] = (Math.random() - 0.5) * 220;
  starPositions[i * 3 + 1] = Math.random() * 90 + 15;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
}
starGeom.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(starGeom, new THREE.PointsMaterial({ color: 0xb8dcff, size: 0.35 })));

const player = new THREE.Mesh(
  new THREE.ConeGeometry(0.8, 2.3, 14),
  new THREE.MeshStandardMaterial({ color: 0x72d5ff, emissive: 0x1f7bb5, emissiveIntensity: 0.35 }),
);
player.rotation.x = Math.PI / 2;
player.position.y = 0.65;
player.castShadow = true;
scene.add(player);

const clock = new THREE.Clock();
const keys = new Set();
const bullets = [];
const enemies = [];
const hitBursts = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const targetPoint = new THREE.Vector3(0, 0, -6);
const upPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const state = {
  running: false,
  gameOver: false,
  score: 0,
  health: 100,
  fireCooldown: 0,
  spawnTimer: 0,
  spawnEvery: 1.35,
};

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.health = 100;
  state.fireCooldown = 0;
  state.spawnTimer = 0;
  state.spawnEvery = 1.35;

  player.position.set(0, 0.65, 0);
  targetPoint.set(0, 0, -6);

  bullets.forEach((b) => scene.remove(b.mesh));
  enemies.forEach((e) => scene.remove(e.mesh));
  hitBursts.forEach((p) => scene.remove(p.mesh));
  bullets.length = 0;
  enemies.length = 0;
  hitBursts.length = 0;

  scoreEl.textContent = "0";
  healthEl.textContent = "100";
  statusEl.textContent = "WASD / Arrow keys move. Mouse aims. Click or Space fires.";
  startBtn.textContent = "Restart";
}

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 22.6;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  const enemy = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.8 + Math.random() * 0.25, 0),
    new THREE.MeshStandardMaterial({ color: 0xff6454, emissive: 0x70160f, emissiveIntensity: 0.45 }),
  );
  enemy.position.set(x, 0.78, z);
  enemy.castShadow = true;
  scene.add(enemy);

  enemies.push({
    mesh: enemy,
    speed: 3 + Math.random() * 1.6 + state.score * 0.01,
    hp: 1 + (Math.random() < Math.min(0.45, state.score / 220) ? 1 : 0),
  });
}

function burstAt(position, color = 0xffc575) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  mesh.position.copy(position);
  scene.add(mesh);
  hitBursts.push({ mesh, ttl: 0.22 });
}

function fire() {
  if (!state.running || state.fireCooldown > 0) return;

  const dir = targetPoint.clone().sub(player.position).setY(0);
  if (dir.lengthSq() < 0.001) return;
  dir.normalize();

  const bulletMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffee88 }),
  );
  bulletMesh.position.copy(player.position).add(dir.clone().multiplyScalar(1.35)).setY(0.75);
  scene.add(bulletMesh);

  bullets.push({
    mesh: bulletMesh,
    velocity: dir.multiplyScalar(19),
    life: 1.35,
  });

  state.fireCooldown = 0.16;
}

function loseHealth(amount) {
  state.health = Math.max(0, state.health - amount);
  healthEl.textContent = `${state.health}`;

  if (state.health <= 0) {
    state.running = false;
    state.gameOver = true;
    statusEl.textContent = `Game over. Final score: ${state.score}. Press Restart.`;
  }
}

function updateAimFromPointer(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(upPlane, targetPoint);

  const direction = targetPoint.clone().sub(player.position).setY(0);
  if (direction.lengthSq() > 0.0001) {
    const yaw = Math.atan2(direction.x, direction.z);
    player.rotation.z = -yaw;
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.code === "Space") {
    event.preventDefault();
    fire();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("mousemove", (event) => {
  updateAimFromPointer(event.clientX, event.clientY);
});

window.addEventListener("pointerdown", (event) => {
  updateAimFromPointer(event.clientX, event.clientY);
  fire();
});

startBtn.addEventListener("click", () => {
  resetGame();
});

function update(delta) {
  if (!state.running) return;

  state.fireCooldown = Math.max(0, state.fireCooldown - delta);
  state.spawnTimer += delta;

  if (state.spawnTimer >= state.spawnEvery) {
    state.spawnTimer = 0;
    spawnEnemy();
    state.spawnEvery = Math.max(0.45, state.spawnEvery * 0.995);
  }

  const moveVec = new THREE.Vector3();
  if (keys.has("w") || keys.has("arrowup")) moveVec.z -= 1;
  if (keys.has("s") || keys.has("arrowdown")) moveVec.z += 1;
  if (keys.has("a") || keys.has("arrowleft")) moveVec.x -= 1;
  if (keys.has("d") || keys.has("arrowright")) moveVec.x += 1;

  if (moveVec.lengthSq() > 0) {
    moveVec.normalize().multiplyScalar(8.5 * delta);
    player.position.add(moveVec);
    const maxRadius = 21;
    if (player.position.length() > maxRadius) {
      player.position.setLength(maxRadius);
      player.position.y = 0.65;
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.mesh.position.addScaledVector(bullet.velocity, delta);
    bullet.life -= delta;
    if (bullet.life <= 0 || bullet.mesh.position.length() > 26) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      if (bullet.mesh.position.distanceTo(enemy.mesh.position) < 1.1) {
        enemy.hp -= 1;
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);

        if (enemy.hp <= 0) {
          burstAt(enemy.mesh.position);
          scene.remove(enemy.mesh);
          enemies.splice(j, 1);
          state.score += 10;
          scoreEl.textContent = `${state.score}`;
        } else {
          enemy.mesh.scale.multiplyScalar(0.85);
          enemy.mesh.material.color.offsetHSL(0, 0, -0.1);
        }
        break;
      }
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const toPlayer = player.position.clone().sub(enemy.mesh.position).setY(0);
    const dist = toPlayer.length();
    toPlayer.normalize();

    enemy.mesh.position.addScaledVector(toPlayer, enemy.speed * delta);
    enemy.mesh.rotation.x += delta * 2.6;
    enemy.mesh.rotation.y += delta * 2.2;

    if (dist < 1.35) {
      burstAt(enemy.mesh.position, 0xff6f6f);
      scene.remove(enemy.mesh);
      enemies.splice(i, 1);
      loseHealth(10);
    }
  }

  for (let i = hitBursts.length - 1; i >= 0; i -= 1) {
    const particle = hitBursts[i];
    particle.ttl -= delta;
    particle.mesh.scale.multiplyScalar(1 + delta * 6);
    particle.mesh.material.opacity = Math.max(0, particle.ttl * 4);
    if (particle.ttl <= 0) {
      scene.remove(particle.mesh);
      hitBursts.splice(i, 1);
    }
  }

  const cameraTarget = player.position.clone();
  camera.position.x += (player.position.x - camera.position.x) * delta * 1.2;
  camera.position.z += (player.position.z + 28 - camera.position.z) * delta * 1.2;
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  update(delta);
  renderer.render(scene, camera);
}

animate();
statusEl.textContent = "Click Start Game to begin. Survive as long as you can.";
