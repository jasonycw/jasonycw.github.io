import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const canvas = document.querySelector("#game-canvas");
const scoreEl = document.querySelector("#score");
const healthEl = document.querySelector("#health");
const messageEl = document.querySelector("#message");
const restartBtn = document.querySelector("#restart");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05050a, 0.045);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 16, 14);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0x8f9cff, 0.38));
const keyLight = new THREE.PointLight(0x7ef5ff, 1.5, 80, 2.1);
keyLight.position.set(0, 8, 0);
scene.add(keyLight);

const arenaRadius = 11;
const coreRadius = 1.2;

const grid = new THREE.Mesh(
  new THREE.CircleGeometry(arenaRadius, 64),
  new THREE.MeshStandardMaterial({ color: 0x0c1228, emissive: 0x0a123a, roughness: 0.8, metalness: 0.15 })
);
grid.rotation.x = -Math.PI / 2;
scene.add(grid);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(arenaRadius - 0.22, arenaRadius, 96),
  new THREE.MeshBasicMaterial({ color: 0x4ee7ff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);

const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(coreRadius, 1),
  new THREE.MeshStandardMaterial({ color: 0xa3f6ff, emissive: 0x4fdcff, emissiveIntensity: 0.95, roughness: 0.25, metalness: 0.2 })
);
core.position.y = 1;
scene.add(core);

const player = new THREE.Mesh(
  new THREE.ConeGeometry(0.48, 1.25, 4),
  new THREE.MeshStandardMaterial({ color: 0xff7be6, emissive: 0xa01f86, emissiveIntensity: 0.55, roughness: 0.35 })
);
player.rotation.x = Math.PI;
player.position.set(0, 0.7, 6.5);
scene.add(player);

const bulletGeometry = new THREE.SphereGeometry(0.12, 8, 8);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const enemyGeometry = new THREE.OctahedronGeometry(0.52);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0xff2a56, emissiveIntensity: 0.75, roughness: 0.33, metalness: 0.2 });

const keys = new Set();
const bullets = [];
const enemies = [];
let pointer = new THREE.Vector2(0, 0);
let score = 0;
let health = 100;
let elapsed = 0;
let gameOver = false;
let spawnTimer = 0;
let shotCooldown = 0;
const gameDuration = 90;
const clock = new THREE.Clock();

function resetGame() {
  for (const b of bullets) scene.remove(b.mesh);
  for (const e of enemies) scene.remove(e.mesh);
  bullets.length = 0;
  enemies.length = 0;
  score = 0;
  health = 100;
  elapsed = 0;
  gameOver = false;
  spawnTimer = 0;
  shotCooldown = 0;
  player.position.set(0, 0.7, 6.5);
  messageEl.textContent = "Defend the core for 90 seconds.";
  restartBtn.hidden = true;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(score);
  healthEl.textContent = String(Math.max(0, Math.ceil(health)));
}

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const distance = arenaRadius - 0.7;
  const enemy = new THREE.Mesh(
    enemyGeometry,
    enemyMaterial
  );
  enemy.position.set(Math.cos(angle) * distance, 0.65, Math.sin(angle) * distance);
  scene.add(enemy);
  enemies.push({ mesh: enemy, speed: 1.35 + Math.random() * 0.95, hp: 1 + Math.random() * 0.45 });
}

function shoot() {
  if (shotCooldown > 0 || gameOver) return;
  const dir = new THREE.Vector3(pointer.x - player.position.x, 0, pointer.y - player.position.z).normalize();
  if (Number.isNaN(dir.x) || Number.isNaN(dir.z)) return;

  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
  bullet.position.copy(player.position);
  bullet.position.y = 0.75;
  scene.add(bullet);
  bullets.push({ mesh: bullet, velocity: dir.multiplyScalar(13) });
  shotCooldown = 0.13;
}

function endGame(win) {
  gameOver = true;
  messageEl.textContent = win ? `Victory! Final score: ${score}` : `Core destroyed. Final score: ${score}`;
  restartBtn.hidden = false;
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.code === "Space") {
    event.preventDefault();
    shoot();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("mousedown", shoot);

window.addEventListener("mousemove", (event) => {
  const normalized = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(normalized, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, point);
  pointer.set(point.x, point.z);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

restartBtn.addEventListener("click", resetGame);

function updatePlayer(delta) {
  const movement = new THREE.Vector3();
  if (keys.has("w") || keys.has("arrowup")) movement.z -= 1;
  if (keys.has("s") || keys.has("arrowdown")) movement.z += 1;
  if (keys.has("a") || keys.has("arrowleft")) movement.x -= 1;
  if (keys.has("d") || keys.has("arrowright")) movement.x += 1;

  if (movement.lengthSq() > 0) {
    movement.normalize().multiplyScalar(7.3 * delta);
    player.position.add(movement);
    const limit = arenaRadius - 1.1;
    const radius = Math.hypot(player.position.x, player.position.z);
    if (radius > limit) {
      player.position.x = (player.position.x / radius) * limit;
      player.position.z = (player.position.z / radius) * limit;
    }
  }

  const aim = new THREE.Vector3(pointer.x - player.position.x, 0, pointer.y - player.position.z);
  if (aim.lengthSq() > 0.001) {
    player.rotation.y = Math.atan2(aim.x, aim.z);
  }
}

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.mesh.position.addScaledVector(bullet.velocity, delta);
    if (bullet.mesh.position.length() > arenaRadius + 3) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
    }
  }
}

function updateEnemies(delta) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const toCore = new THREE.Vector3(-enemy.mesh.position.x, 0, -enemy.mesh.position.z);
    const direction = toCore.normalize();
    enemy.mesh.position.addScaledVector(direction, enemy.speed * delta);
    enemy.mesh.rotation.y += delta * 2.4;

    const coreDist = enemy.mesh.position.distanceTo(core.position);
    if (coreDist < coreRadius + 0.5) {
      health -= 11;
      scene.remove(enemy.mesh);
      enemies.splice(i, 1);
      if (health <= 0) {
        health = 0;
        endGame(false);
      }
      continue;
    }

    const playerDist = enemy.mesh.position.distanceTo(player.position);
    if (playerDist < 0.85) {
      health -= 7;
      scene.remove(enemy.mesh);
      enemies.splice(i, 1);
      if (health <= 0) {
        health = 0;
        endGame(false);
      }
    }
  }
}

function detectHits() {
  for (let ei = enemies.length - 1; ei >= 0; ei -= 1) {
    const enemy = enemies[ei];
    for (let bi = bullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = bullets[bi];
      if (enemy.mesh.position.distanceTo(bullet.mesh.position) < 0.58) {
        enemy.hp -= 1;
        scene.remove(bullet.mesh);
        bullets.splice(bi, 1);
        if (enemy.hp <= 0) {
          scene.remove(enemy.mesh);
          enemies.splice(ei, 1);
          score += 10;
        }
        break;
      }
    }
  }
}

function animate() {
  const delta = Math.min(0.05, clock.getDelta());
  core.rotation.y += delta * 0.55;
  core.rotation.z += delta * 0.35;
  ring.material.opacity = 0.58 + Math.sin(performance.now() * 0.004) * 0.14;

  if (!gameOver) {
    elapsed += delta;
    shotCooldown = Math.max(0, shotCooldown - delta);

    const spawnRate = Math.max(0.32, 1 - elapsed * 0.006);
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = spawnRate;
    }

    updatePlayer(delta);
    updateBullets(delta);
    updateEnemies(delta);
    detectHits();

    if (elapsed >= gameDuration) {
      endGame(true);
    } else {
      const left = Math.ceil(gameDuration - elapsed);
      messageEl.textContent = `Survive: ${left}s`;
    }

    updateHud();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resetGame();
animate();
