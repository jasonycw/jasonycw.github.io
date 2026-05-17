import * as THREE from 'three';

// ==================== CONFIGURATION ====================
const WIN_WAVE = 20; // Survive this many waves to win

const CONFIG = {
  // Map
  mapSize: 30, // world units
  cellSize: 2,
  islandRadius: 4.5, // center island radius
  groundY: 0, // ground plane Y

  // HSI (currency + health)
  hsiInit: 5000,
  hsiPassiveRate: 150, // per second
  hsiRandomMin: -10,
  hsiRandomMax: 10,
  hsiDamagePerTyphoon: 150,
  hsiTyphoonEffectRadius: 8,

  // Lives
  livesMax: 100,

  // Enemies
  enemyBaseHP: 100,
  enemyBaseSpeed: 1.8,
  enemyReward: 50,
  enemySpawnRadius: 16, // beyond grid bounds → guaranteed sea spawn (|cx|>7 returns sea)
  enemyHitRange: 1.2,
  killRewardHSI: 80,

  // Waves
  waveInitDelay: 10, // seconds before first wave
  waveSpawnInterval: 5,

  // Structures
  structures: {
    LaserTower: {
      title: 'Laser Tower', power: -3, cost: 500, range: 8, damage: 25,
      req: null, builtOn: 'sea', attackInterval: 0.5, color: 0x4fc3f7
    },
    FreezeTower: {
      title: 'Freeze Tower', power: -6, cost: 700, range: 5, damage: 0,
      req: 'University', builtOn: 'sea', slowAmount: 0.5, slowDuration: 2,
      attackInterval: 1.2, color: 0x81d4fa
    },
    RepelTower: {
      title: 'Repel Tower', power: -10, cost: 2500, range: 6.5, damage: 0,
      req: 'ResearchCenter', builtOn: 'sea', repelForce: 6,
      attackInterval: 1.5, color: 0xff8a65
    },
    PowerPlant: {
      title: 'Power Plant', power: 10, cost: 1000, req: null, builtOn: 'land',
      color: 0x66bb6a
    },
    NuclearPlant: {
      title: 'Nuclear Power Plant', power: 40, cost: 5000, req: 'ResearchCenter',
      builtOn: 'land', color: 0x43a047
    },
    University: {
      title: 'University', power: -20, cost: 2500, req: null, builtOn: 'land',
      color: 0x7e57c2
    },
    ResearchCenter: {
      title: 'Research Center', power: -30, cost: 4000, req: 'University',
      builtOn: 'land', color: 0xab47bc
    },
    CheungKong: {
      title: "Li's Enterprise HQ", power: -50, cost: 7000, req: 'ResearchCenter',
      builtOn: 'land', color: 0xffd54f
    }
  }
};

// ==================== THREE.JS SETUP ====================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1628);
scene.fog = new THREE.Fog(0x0a1628, 30, 55);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(18, 18, 18);
camera.lookAt(0, 0, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0x4466aa, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
dirLight.position.set(15, 25, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar(2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.radius = 4;
scene.add(dirLight);

const hemiLight = new THREE.HemisphereLight(0x8888ff, 0x444422, 0.4);
scene.add(hemiLight);

const clock = new THREE.Clock();

// ==================== RESIZE HANDLER ====================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== MAP CREATION ====================

// Hong Kong position on the 960×600 map.png (yellow cluster center)
const HK_MAP_PX = { x: 376, y: 236 };
// UV coordinate of Hong Kong on the texture
const HK_UV = { u: HK_MAP_PX.x / 960, v: 1 - HK_MAP_PX.y / 600 };
// Shift map so Hong Kong texture pixel aligns with world origin (0,0,0)
const MAP_PLANE_SIZE = 28;
const HK_LOCAL_X = (HK_UV.u - 0.5) * MAP_PLANE_SIZE;
const HK_LOCAL_Y = (HK_UV.v - 0.5) * MAP_PLANE_SIZE;
const MAP_OFFSET_X = -HK_LOCAL_X;  // 3.032
const MAP_OFFSET_Z = HK_LOCAL_Y;   // 2.988

// Load map texture
const textureLoader = new THREE.TextureLoader();
const mapTexture = textureLoader.load('assets/map.png');

// Map ground plane (uses original map.png of South China Sea / HK region)
const mapGeom = new THREE.PlaneGeometry(MAP_PLANE_SIZE, MAP_PLANE_SIZE);
const mapMat = new THREE.MeshStandardMaterial({
  map: mapTexture,
  roughness: 0.9,
  metalness: 0.0
});
const mapMesh = new THREE.Mesh(mapGeom, mapMat);
mapMesh.rotation.x = -Math.PI / 2;
mapMesh.position.set(MAP_OFFSET_X, -0.01, MAP_OFFSET_Z);
mapMesh.receiveShadow = true;
scene.add(mapMesh);

// Concentric circle rings (like original game's danger zones around HK)
const RING_RADII = [3, 5, 7, 9.5];
for (let i = 0; i < RING_RADII.length; i++) {
  const r = RING_RADII[i];
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.04, r + 0.04, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.10 + i * 0.03,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);
}

// Glow marker for center target
const targetGlow = new THREE.Mesh(
  new THREE.CylinderGeometry(0.15, 0.3, 0.05, 12),
  new THREE.MeshBasicMaterial({ color: 0xff5722 })
);
targetGlow.position.set(0, 0.01, 0);
scene.add(targetGlow);

// Grid cells data (invisible — for placement logic only)
const gridCells = [];
const cellHalf = CONFIG.cellSize / 2;
const halfCells = 7; // -7 to +7

// Hitarea-based terrain classification — fallback: simple circle
let useHitareaClassification = false;

// Load hitarea mask to classify land vs sea from the actual map
const hitareaImg = new Image();
hitareaImg.onload = () => {
  const cvs = document.createElement('canvas');
  cvs.width = hitareaImg.width;
  cvs.height = hitareaImg.height;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(hitareaImg, 0, 0);
  const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;

  // Convert pixel-coord → world-coord → UV → hitarea sample
  function sampleHitarea(wx, wz) {
    // World → local on rotated plane
    const lx = wx - MAP_OFFSET_X;
    const ly = MAP_OFFSET_Z - wz;
    const uvx = (lx + MAP_PLANE_SIZE / 2) / MAP_PLANE_SIZE;
    const uvy = (ly + MAP_PLANE_SIZE / 2) / MAP_PLANE_SIZE;
    if (uvx < 0 || uvx > 1 || uvy < 0 || uvy > 1) return false;
    const px = Math.round(uvx * 960);
    const py = Math.round((1 - uvy) * 600);
    const idx = (py * 960 + px) * 4;
    // White (255) = land, Black (0) = sea
    return data[idx] > 128;
  }

  // Re-classify all cells
  for (const cell of gridCells) {
    cell.isLand = sampleHitarea(cell.wx, cell.wz);
  }
  useHitareaClassification = true;
  console.log('MAP: hitarea loaded, cells classified');
};
hitareaImg.src = 'assets/map-hitarea.png';

for (let cx = -halfCells; cx <= halfCells; cx++) {
  for (let cz = -halfCells; cz <= halfCells; cz++) {
    const wx = cx * CONFIG.cellSize;
    const wz = cz * CONFIG.cellSize;
    const dist = Math.sqrt(wx * wx + wz * wz);
    const isLand = dist < CONFIG.islandRadius;

    gridCells.push({
      cx, cz, wx, wz,
      isLand,
      occupied: null // reference to structure object
    });
  }
}

// ==================== GAME STATE ====================
const state = {
  phase: 'menu', // 'menu' | 'playing' | 'gameover' | 'win'
  hsi: CONFIG.hsiInit,
  hsiMax: CONFIG.hsiInit,
  lives: CONFIG.livesMax,
  powerQuota: 0, // generated by power plants
  powerUsed: 0, // consumed by towers and buildings
  wave: 0,
  enemiesKilled: 0,
  totalWaves: 0,
  gameTime: 0,
  waveTimer: CONFIG.waveInitDelay,
  spawnTimer: 0,
  enemiesPerWave: 3,
  enemiesSpawnedInWave: 0,
  enemyCount: 0,

  // Tech tree
  hasUniversity: false,
  hasResearchCenter: false,
  hasCheungKong: false,
  universityCount: 0,
  researchCenterCount: 0,

  // Selection
  selectedType: null, // structure type key

  // Power outage
  powerOutage: false,
  outageTimer: 0
};

// Runtime arrays
const enemies = [];
const towers = [];
const buildings = [];
const projectiles = [];
const effects = []; // visual effects

// ==================== HSI / POWER UPDATE ====================
function getAvailablePower() {
  return state.powerQuota + state.powerUsed; // powerUsed is negative
}

function updatePower() {
  const available = getAvailablePower();
  const isOverload = available < 0;

  if (isOverload && !state.powerOutage) {
    state.powerOutage = true;
    // Towers go offline
    for (const t of towers) t.online = false;
    setStatus('POWER OUTAGE — Build more Power Plants!', '#ff5252');
  } else if (!isOverload && state.powerOutage) {
    state.powerOutage = false;
    for (const t of towers) t.online = true;
    setStatus('Power restored!', '#69f0ae');
  }

  // Update power bar
  const bar = document.getElementById('powerBar');
  const text = document.getElementById('powerText');
  const maxPower = Math.max(state.powerQuota, Math.abs(state.powerUsed), 1);
  const ratio = Math.max(0, Math.min(1, available / maxPower));
  bar.style.width = (ratio * 100) + '%';
  bar.classList.toggle('overload', isOverload);
  text.textContent = `${Math.round(available)} / ${state.powerQuota}`;
}

function updateHSI(dt) {
  // Passive HSI gain
  let change = CONFIG.hsiPassiveRate * dt;
  // Random fluctuation
  change += (Math.random() * (CONFIG.hsiRandomMax - CONFIG.hsiRandomMin) + CONFIG.hsiRandomMin) * dt;
  // CheungKong bonus
  if (state.hasCheungKong) change *= 1.5;

  // HSI loss from nearby typhoons
  for (const e of enemies) {
    const dist = Math.sqrt(e.x * e.x + e.z * e.z);
    if (dist < CONFIG.hsiTyphoonEffectRadius) {
      const dmg = CONFIG.hsiDamagePerTyphoon * dt * (1 - dist / CONFIG.hsiTyphoonEffectRadius);
      change -= dmg;
    }
  }

  state.hsi += change;
  if (state.hsi <= 0) {
    state.hsi = 0;
    gameOver();
  }

  state.hsi = Math.max(0, state.hsi);
  document.getElementById('hsiDisplay').textContent = Math.round(state.hsi);
}

// ==================== STRUCTURE FACTORY ====================
function getStructConfig(type) {
  return CONFIG.structures[type];
}

function meetsRequirements(type) {
  const cfg = getStructConfig(type);
  if (!cfg) return false;
  if (!cfg.req) return true;
  if (cfg.req === 'University') return state.hasUniversity;
  if (cfg.req === 'ResearchCenter') return state.hasResearchCenter;
  return false;
}

function getStructureCost(type) {
  const cfg = getStructConfig(type);
  return cfg ? cfg.cost : Infinity;
}

function isStructureUnlocked(type) {
  if (type === 'LaserTower' || type === 'PowerPlant' || type === 'University') return true;
  if (type === 'FreezeTower' || type === 'ResearchCenter') return state.hasUniversity;
  if (type === 'RepelTower' || type === 'NuclearPlant') return state.hasResearchCenter;
  if (type === 'CheungKong') return state.hasResearchCenter;
  return false;
}

// ==================== ENEMY SYSTEM ====================
const typhoonSpriteTexture = textureLoader.load('assets/typhoon.png');
const hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
const hpBarBgGeom = new THREE.BoxGeometry(0.8, 0.04, 0.06);
const hpBarFillMat = new THREE.MeshBasicMaterial({ color: 0x4caf50 });
const hpBarFillGeom = new THREE.BoxGeometry(0.8, 0.04, 0.06);

/** Check if a world position is over sea (using hitarea-classified grid) */
function isSeaAt(wx, wz) {
  const cx = Math.round(wx / CONFIG.cellSize);
  const cz = Math.round(wz / CONFIG.cellSize);
  if (Math.abs(cx) > halfCells || Math.abs(cz) > halfCells) return true; // outside grid = sea
  const cell = gridCells.find(c => c.cx === cx && c.cz === cz);
  return cell ? !cell.isLand : true;
}

function spawnEnemy() {
  // Spawn from sea-facing angles only (southeast→south→southwest)
  // Camera is at (18,18,18) so points at Z=0 appear in the upper/land part of screen.
  // Constrain to [π/6, 5π/6] = 30° to 150° giving Z >= 8 (clearly in southern sea)
  const r = CONFIG.enemySpawnRadius;
  const angle = Math.PI / 6 + Math.random() * Math.PI * 2 / 3; // π/6 to 5π/6
  const x = Math.cos(angle) * r;
  const z = Math.sin(angle) * r;

  const hp = CONFIG.enemyBaseHP + state.gameTime * 1.5;
  const speed = CONFIG.enemyBaseSpeed + state.gameTime / 100;

  // ===================== 3D TyPhoon (volumetric cyclone) =====================
  const typhoonGroup = new THREE.Group();
  typhoonGroup.position.set(x, 1.2, z);

  // All typhoon materials — for cleanup / opacity-from-HP traversal
  const allTyphoonMats = [];

  // --- Wide cloud base deck ---
  const deckMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.08,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(deckMat);
  const deck = new THREE.Mesh(new THREE.RingGeometry(0.8, 2.6, 48), deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -0.25;
  typhoonGroup.add(deck);

  // --- Upper cloud wisp ---
  const wispMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.05,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(wispMat);
  const wisp = new THREE.Mesh(new THREE.RingGeometry(0.6, 2.1, 40), wispMat);
  wisp.rotation.x = -Math.PI / 2;
  wisp.position.y = 0.12;
  typhoonGroup.add(wisp);

  // --- Eye wall (hollow cylinder — the storm's eye) ---
  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0xb3e5fc, transparent: true, opacity: 0.3,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(eyeMat);
  const eyeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 0.75, 16, 1, true), eyeMat
  );
  eyeMesh.position.y = 0.1;
  typhoonGroup.add(eyeMesh);

  // --- Core glow (eye brightness) ---
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x4fc3f7, transparent: true, opacity: 0.55
  });
  allTyphoonMats.push(coreMat);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), coreMat);
  core.position.y = 0.05;
  typhoonGroup.add(core);

  // --- Spiral rainbands (3 arms × arc segments) ---
  const armMats = [];
  for (let arm = 0; arm < 3; arm++) {
    const baseAngle = (arm / 3) * Math.PI * 2;
    for (let seg = 0; seg < 6; seg++) {
      const radius = 0.45 + seg * 0.34;
      const arcLen = Math.PI * 0.4 + seg * 0.15;
      const angle = baseAngle + seg * 0.85;
      const aMat = new THREE.MeshBasicMaterial({
        color: 0xe3f2fd, transparent: true, opacity: 0.12 + seg * 0.05,
        side: THREE.DoubleSide, depthWrite: false
      });
      armMats.push(aMat);
      allTyphoonMats.push(aMat);
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.035 + seg * 0.008, 4, 12, arcLen), aMat
      );
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = angle;
      arc.position.y = -0.12 + seg * 0.04;
      typhoonGroup.add(arc);
    }
  }

  // --- Typhoon texture plane (PlaneGeometry, rotates WITH group — NOT a Sprite!) ---
  const planeMat = new THREE.MeshBasicMaterial({
    map: typhoonSpriteTexture, transparent: true, opacity: 0.2,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  allTyphoonMats.push(planeMat);
  const texPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), planeMat);
  texPlane.rotation.x = -Math.PI / 2; // horizontal — rotates with group.rotation.y
  texPlane.position.y = 0.06;
  typhoonGroup.add(texPlane);

  // --- Orbiting particles (rain-streak / cloud droplets) ---
  const particleData = [];
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 2.2;
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.2 + Math.random() * 0.3
    });
    allTyphoonMats.push(pMat);
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.025 + Math.random() * 0.025, 4, 4), pMat
    );
    pMesh.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.3, Math.sin(a) * r);
    typhoonGroup.add(pMesh);
    particleData.push({ mesh: pMesh, angle: a, radius: r, speed: 0.6 + Math.random() * 0.8 });
  }
  typhoonGroup.userData.particles = particleData;

  scene.add(typhoonGroup);

  // ===================== Health bar =====================
  const hpBg = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.04, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x444444 })
  );
  hpBg.position.set(x, 1.6, z);
  scene.add(hpBg);

  const hpFill = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.04, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x66bb6a })
  );
  hpFill.position.set(x, 1.6, z);
  scene.add(hpFill);

  const enemy = {
    mesh: typhoonGroup,
    coreMat,
    eyeMat,
    armMats,
    allTyphoonMats,
    hpBar: { bg: hpBg, fill: hpFill },
    x, z,
    hp,
    maxHp: hp,
    speed,
    angle: Math.atan2(-z, -x),
    size: 0.9,
    isSlowed: 0,
    slowFactor: 0,
    repelX: 0,
    repelZ: 0,
    alive: true,
    reachedCenter: false,
    // Trajectory wobble
    wobbleSpeed: 1.0 + Math.random() * 2.5,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 1.5 + Math.random() * 3
  };

  enemies.push(enemy);
  state.enemyCount++;
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.alive) continue;

    // Calculate movement direction (toward center + repel forces)
    const targetAngle = Math.atan2(-e.z, -e.x);
    let moveX = Math.cos(targetAngle);
    let moveZ = Math.sin(targetAngle);

    // ---------- Trajectory wobble (sinusoidal perpendicular offset) ----------
    const distToCenter = Math.sqrt(e.x * e.x + e.z * e.z);
    const progress = 1 - Math.min(distToCenter / CONFIG.enemySpawnRadius, 1);
    const wobbleFactor = Math.sin(state.gameTime * e.wobbleSpeed + e.wobblePhase) * e.wobbleAmp * (1 - progress);
    // Perpendicular direction (using original moveX/moveZ before modification)
    const perpX = -moveZ;
    const perpZ = moveX;
    moveX += perpX * wobbleFactor * 0.15;
    moveZ += perpZ * wobbleFactor * 0.15;

    // Apply repel force
    if (e.repelX !== 0 || e.repelZ !== 0) {
      moveX += e.repelX;
      moveZ += e.repelZ;
      e.repelX *= 0.95;
      e.repelZ *= 0.95;
      if (Math.abs(e.repelX) < 0.001) e.repelX = 0;
      if (Math.abs(e.repelZ) < 0.001) e.repelZ = 0;
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    // Apply speed (with slow — time-based)
    let spd = e.speed * dt;
    const slowed = e.isSlowed > 0;
    if (slowed) {
      spd *= (1 - e.slowFactor);
      e.isSlowed -= dt;
    }

    // Color shift on slow (core + eye + spiral arms)
    if (slowed) {
      e.coreMat.color.setHex(0x81d4fa);
      e.eyeMat.color.setHex(0x90caf9);
      for (const am of e.armMats) am.color.setHex(0x81d4fa);
    } else {
      e.coreMat.color.setHex(0x4fc3f7);
      e.eyeMat.color.setHex(0xb3e5fc);
      for (const am of e.armMats) am.color.setHex(0xe3f2fd);
    }

    e.mesh.position.x += moveX * spd;
    e.mesh.position.z += moveZ * spd;
    e.x = e.mesh.position.x;
    e.z = e.mesh.position.z;

    // Update HP bar position
    e.hpBar.bg.position.set(e.x, 1.6, e.z);
    e.hpBar.fill.position.set(e.x, 1.6, e.z);
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    e.hpBar.fill.scale.x = Math.max(0.01, hpRatio);
    const hpColor = hpRatio > 0.5 ? 0x66bb6a : (hpRatio > 0.25 ? 0xffa726 : 0xef5350);
    e.hpBar.fill.material.color.setHex(hpColor);

    // === 3D typhoon animations ===

    // Y-axis spin (cyclone rotation)
    e.mesh.rotation.y += dt * 3;

    // Orbit particles around core
    if (e.mesh.userData.particles) {
      for (const pd of e.mesh.userData.particles) {
        pd.angle += dt * pd.speed;
        pd.mesh.position.x = Math.cos(pd.angle) * pd.radius;
        pd.mesh.position.z = Math.sin(pd.angle) * pd.radius;
      }
    }

    // Core pulsing + opacity fade with HP (hpRatio reused from HP bar above)
    e.coreMat.opacity = (0.6 + Math.sin(state.gameTime * 4) * 0.1) * (0.3 + hpRatio * 0.7);
    e.eyeMat.opacity = 0.3 * (0.3 + hpRatio * 0.7);
    for (const am of e.armMats) {
      const base = (am._bop || 0.3);
      am.opacity = base * (0.3 + hpRatio * 0.7);
    }

    // Check if reached center
    if (distToCenter < CONFIG.islandRadius + 0.5) {
      // Deal damage to lives
      console.log(`ENEMY_REACHED: hp=${e.hp.toFixed(0)} dist=${distToCenter.toFixed(1)}`);
      state.lives -= 5;
      if (state.lives <= 0) {
        state.lives = 0;
        gameOver();
      }
      document.getElementById('livesDisplay').textContent = state.lives;

      // Spawn damage effect
      spawnEffect(e.x, 0.2, e.z, 0xff1744, 0.8);

      removeEnemy(i);
      continue;
    }

    // Despawn if too far
    if (Math.abs(e.x) > 20 || Math.abs(e.z) > 20) {
      removeEnemy(i);
      continue;
    }
  }
}

function removeEnemy(index) {
  const e = enemies[index];
  if (!e) return;
  scene.remove(e.mesh);
  e.mesh.traverse(child => {
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => { m.dispose(); });
      else child.material.dispose();
    }
    if (child.geometry) child.geometry.dispose();
  });
  if (e.hpBar) {
    scene.remove(e.hpBar.bg);
    scene.remove(e.hpBar.fill);
    e.hpBar.bg.material.dispose();
    e.hpBar.bg.geometry.dispose();
    e.hpBar.fill.material.dispose();
    e.hpBar.fill.geometry.dispose();
  }
  e.alive = false;
  state.enemyCount--;
  enemies.splice(index, 1);
}

function damageEnemy(enemy, damage) {
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    // Kill enemy
    console.log(`ENEMY_KILLED: hp was ${enemy.hp+damage}, took ${damage} dmg`);
    state.hsi += CONFIG.killRewardHSI;
    state.enemiesKilled++;
    // Explosion burst
    spawnBurst(enemy.x, 0.5, enemy.z, 0xffab00, 12);
    spawnEffect(enemy.x, 0.5, enemy.z, 0xff6d00, 0.4);
    const idx = enemies.indexOf(enemy);
    if (idx !== -1) removeEnemy(idx);
  }
}

// ==================== TOWER SYSTEM ====================
function createTowerMesh(type) {
  const group = new THREE.Group();
  const cfg = getStructConfig(type);

  if (type === 'LaserTower') {
    // Base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    // Barrel
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.2 })
    );
    barrel.position.y = 0.45;
    group.add(barrel);
    // Turret ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.05, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 0.2 })
    );
    ring.position.y = 0.3;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    // Store turret parts for rotation
    group.userData.turret = barrel;
    group.userData.ring = ring;
  } else if (type === 'FreezeTower') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    // Crystal body
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4),
      new THREE.MeshStandardMaterial({ color: 0x81d4fa, emissive: 0x4fc3f7, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.5 })
    );
    body.position.y = 0.5;
    body.rotation.y = Math.PI / 4;
    group.add(body);
    // Ice ring
    const iceRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.04, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.7 })
    );
    iceRing.position.y = 0.5;
    iceRing.rotation.x = Math.PI / 2;
    group.add(iceRing);
    group.userData.body = body;
    group.userData.iceRing = iceRing;
  } else if (type === 'RepelTower') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.65, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 })
    );
    base.position.y = 0.15;
    group.add(base);
    // Dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xff8a65, emissive: 0xff6d00, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.4 })
    );
    dome.position.y = 0.4;
    group.add(dome);
    // Repel rings
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(0.25 + i * 0.15, 0.03, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0xffab40, transparent: true, opacity: 0.6 - i * 0.15 })
      );
      r.position.y = 0.3 + i * 0.1;
      r.rotation.x = Math.PI / 2 + i * 0.3;
      group.add(r);
      group.userData.rings = group.userData.rings || [];
      group.userData.rings.push(r);
    }
  }

  group.castShadow = true;
  return group;
}

function createBuildingMesh(type) {
  const group = new THREE.Group();
  const cfg = getStructConfig(type);

  if (type === 'PowerPlant') {
    // Factory building
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.7, metalness: 0.2 })
    );
    body.position.y = 0.25;
    group.add(body);
    // Chimney
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.8 })
    );
    chimney.position.set(0.2, 0.55, 0.2);
    group.add(chimney);
    // Glow
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x69f0ae })
    );
    glow.position.set(0.2, 0.6, 0.2);
    group.add(glow);
  } else if (type === 'NuclearPlant') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.15, 12),
      new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.7 })
    );
    base.position.y = 0.075;
    group.add(base);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x43a047, emissive: 0x00e676, emissiveIntensity: 0.15, roughness: 0.4 })
    );
    dome.position.y = 0.7; // sits on top of base (0.15 + 0.55)
  } else if (type === 'University') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.4, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x7e57c2, roughness: 0.6, metalness: 0.2 })
    );
    body.position.y = 0.2;
    group.add(body);
    // Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x9575cd, roughness: 0.5 })
    );
    roof.position.y = 0.4;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  } else if (type === 'ResearchCenter') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xab47bc, roughness: 0.5, metalness: 0.3 })
    );
    body.position.y = 0.25;
    group.add(body);
    // Antenna
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0xce93d8, emissive: 0xce93d8, emissiveIntensity: 0.3 })
    );
    antenna.position.y = 0.55;
    group.add(antenna);
  } else if (type === 'CheungKong') {
    // Tall building
    for (let i = 0; i < 3; i++) {
      const section = new THREE.Mesh(
        new THREE.BoxGeometry(0.5 - i * 0.08, 0.3, 0.5 - i * 0.08),
        new THREE.MeshStandardMaterial({
          color: i === 0 ? 0x37474f : (i === 1 ? 0x455a64 : 0x546e7a),
          roughness: 0.5, metalness: 0.5
        })
      );
      section.position.y = 0.15 + i * 0.3;
      group.add(section);
    }
    // Gold top
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.5 })
    );
    top.position.y = 0.85;
    group.add(top);
  }

  group.castShadow = true;
  return group;
}

// ==================== PROJECTILE SYSTEM ====================
function fireProjectile(tower) {
  const target = tower.target;
  if (!target || !target.alive) return;

  if (tower.type === 'LaserTower') {
    // Compute barrel tip = barrel center + 0.35 * targetDir
    // targetDir = normalize(dx, 0.55, dz) where 0.55 = target Y(1.0) - barrel center Y(0.45)
    // Same computation used in spawnLaserMuzzle and updateTowers barrel rotation
    const dx = target.x - tower.wx;
    const dz = target.z - tower.wz;
    const aimDist = Math.sqrt(dx * dx + 0.55 * 0.55 + dz * dz);
    if (aimDist > 0.01) {
      const bx = tower.wx + 0.35 * dx / aimDist;
      const by = 0.45 + 0.35 * 0.55 / aimDist;
      const bz = tower.wz + 0.35 * dz / aimDist;
      spawnLaserBeam(bx, by, bz, target.x, 1.0, target.z, 0xffeb3b);
    } else {
      spawnLaserBeam(tower.wx, 0.5, tower.wz, target.x, 1.0, target.z, 0xffeb3b);
    }

    // Muzzle flash at barrel tip (computed from barrel rotation)
    spawnLaserMuzzle(tower, target);

    // Deal damage immediately
    const cfg = getStructConfig('LaserTower');
    let dmg = cfg.damage;
    if (state.universityCount > 0) dmg += state.universityCount * 5;
    if (state.researchCenterCount > 0) dmg += state.researchCenterCount * 3;
    damageEnemy(target, dmg);

    // Bright flash burst at impact
    spawnBurst(target.x, 0.5, target.z, 0xffeb3b, 6);
    return;
  }

  // Non-laser towers: traveling sphere projectile
  let color, size, speed;
  if (tower.type === 'FreezeTower') {
    color = 0x4fc3f7;
    size = 0.15;
    speed = 8;
  } else if (tower.type === 'RepelTower') {
    color = 0xff6d00;
    size = 0.18;
    speed = 10;
  } else {
    return; // unknown tower type
  }

  const proj = new THREE.Mesh(
    new THREE.SphereGeometry(size, 8, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  proj.position.copy(tower.mesh.position);
  proj.position.y = 1.0;

  scene.add(proj);
  projectiles.push({
    mesh: proj,
    target,
    tower,
    speed,
    type: tower.type,
    alive: true,
    startPos: proj.position.clone(),
    trailTimer: 0
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p.alive || !p.target || !p.target.alive) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      projectiles.splice(i, 1);
      continue;
    }

    const targetPos = p.target.mesh.position;
    const dir = new THREE.Vector3()
      .copy(targetPos)
      .sub(p.mesh.position);
    const dist = dir.length();

    if (dist < 0.5) {
      // Hit!
      console.log(`PROJ_HIT: ${p.type} dmg deal, enemy hp before=${p.target.hp.toFixed(0)}`);
      if (p.type === 'FreezeTower') {
        p.target.isSlowed = 2.0;
        p.target.slowFactor = 0.5;
        spawnBurst(p.target.x, 0.5, p.target.z, 0x4fc3f7, 10);
      } else if (p.type === 'RepelTower') {
        const dx = p.target.x - p.tower.mesh.position.x;
        const dz = p.target.z - p.tower.mesh.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0) {
          p.target.repelX += (dx / d) * 6;
          p.target.repelZ += (dz / d) * 6;
        }
        spawnBurst(p.target.x, 0.5, p.target.z, 0xff6d00, 8);
        // Expanding ring effect
        spawnEffect(p.target.x, 0.5, p.target.z, 0xff8a65, 0.3);
      }

      scene.remove(p.mesh);
      p.mesh.material.dispose();
      projectiles.splice(i, 1);
      continue;
    }

    // Particle trail
    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.04;
      const trailColor = p.mesh.material.color.getHex();
      const tGeom = new THREE.SphereGeometry(
        (p.mesh.geometry.parameters ? p.mesh.geometry.parameters.radius : 0.12) * 0.6, 4, 4);
      const tMat = new THREE.MeshBasicMaterial({
        color: trailColor, transparent: true, opacity: 0.5
      });
      const tMesh = new THREE.Mesh(tGeom, tMat);
      tMesh.position.copy(p.mesh.position);
      scene.add(tMesh);
      effects.push({ mesh: tMesh, mat: tMat, life: 0.25, maxLife: 0.25, geom: tGeom });
    }

    // Move toward target (use dt so projectiles maintain consistent speed at any framerate)
    const step = Math.min(p.speed * dt, dist);
    p.mesh.position.add(dir.normalize().multiplyScalar(step));
  }
}

// ==================== EFFECTS ====================
function spawnEffect(x, y, z, color, duration) {
  const geom = new THREE.SphereGeometry(0.1, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  effects.push({ mesh, mat, life: duration, maxLife: duration });
}

/** Multi-particle burst flying outward from a point */
function spawnBurst(x, y, z, color, count) {
  const n = count || 8;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 1.5 + Math.random() * 3;
    const geom = new THREE.SphereGeometry(0.04, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    effects.push({
      mesh, mat, life: 0.5, maxLife: 0.5, geom,
      _vx: Math.cos(angle) * speed,
      _vz: Math.sin(angle) * speed,
      _vy: 0.8 + Math.random() * 1.5,
      _burst: true
    });
  }
}

/** Thin glowing beam between two points (for LaserTower) */
function spawnLaserBeam(x1, y1, z1, x2, y2, z2, color) {
  const start = new THREE.Vector3(x1, y1, z1);
  const end = new THREE.Vector3(x2, y2, z2);
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 0.1) return;
  const cols = color || 0xffeb3b;

  // Core line: always connects start→end correctly (1px but visible with additive blend)
  const lineGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const lineMat = new THREE.LineBasicMaterial({
    color: cols,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const line = new THREE.Line(lineGeom, lineMat);
  scene.add(line);
  effects.push({ mesh: line, mat: lineMat, life: 0.2, maxLife: 0.2, geom: lineGeom, _laserBeam: true });

  // Glow spheres: 5 small bright spheres scattered along the beam
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6; // space them evenly, first is slightly past start
    const pos = start.clone().add(dir.clone().multiplyScalar(t));
    const r = 0.04 + t * 0.06;
    const geom = new THREE.SphereGeometry(r, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: cols, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    effects.push({ mesh, mat, life: 0.2, maxLife: 0.2, geom, _laserBeam: true });
  }
}

/** Spawn muzzle flash at the computed barrel tip position */
function spawnLaserMuzzle(tower, target) {
  const dx = target.x - tower.wx;
  const dz = target.z - tower.wz;
  const aimDist = Math.sqrt(dx * dx + 0.55 * 0.55 + dz * dz);
  if (aimDist > 0.01) {
    const bx = tower.wx + 0.35 * dx / aimDist;
    const by = 0.45 + 0.35 * 0.55 / aimDist;
    const bz = tower.wz + 0.35 * dz / aimDist;
    spawnEffect(bx, by, bz, 0xffeb3b, 0.15);
    spawnEffect(bx, by, bz, 0xffffff, 0.08);
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      scene.remove(e.mesh);
      e.mat.dispose();
      if (e.geom) e.geom.dispose();
      effects.splice(i, 1);
      continue;
    }
    const ratio = e.life / e.maxLife;
    e.mat.opacity = ratio;

    if (e._burst) {
      // Burst particles fly outward with gravity
      e.mesh.position.x += e._vx * dt;
      e.mesh.position.z += e._vz * dt;
      e.mesh.position.y += e._vy * dt;
      e._vx *= 0.96;
      e._vz *= 0.96;
      e._vy -= 2.5 * dt;
      e.mesh.scale.setScalar(0.8 + (1 - ratio) * 0.6);
    } else if (!e._laserBeam) {
      // Laser beam pieces fade without expanding (no scaling)
      e.mesh.scale.setScalar(1 + (1 - ratio) * 2);
    }
  }
}

// ==================== TOWER PLACEMENT & UPDATES ====================

/** Check if a world position falls within the visible map texture (UV 0…1) */
function isOnMap(wx, wz) {
  const lx = wx - MAP_OFFSET_X;
  const ly = MAP_OFFSET_Z - wz;
  const half = MAP_PLANE_SIZE / 2;
  const uvx = (lx + half) / MAP_PLANE_SIZE;
  const uvy = (ly + half) / MAP_PLANE_SIZE;
  return uvx >= 0 && uvx <= 1 && uvy >= 0 && uvy <= 1;
}

function placeStructure(cell, type) {
  const cfg = getStructConfig(type);
  if (!cfg) return false;

  // Check cost
  if (state.hsi < cfg.cost) {
    setStatus(`Not enough HSI! Need ${cfg.cost}`, '#ff5252');
    return false;
  }

  // Check requirements
  if (!meetsRequirements(type)) {
    setStatus(`Requires: ${cfg.req}`, '#ff5252');
    return false;
  }

  // Check if cell is on the visible map
  if (!isOnMap(cell.wx, cell.wz)) {
    setStatus('Cannot build outside the map area!', '#ff5252');
    return false;
  }

  // Check placement zone
  const isTower = cfg.builtOn === 'sea';
  const isBuilding = cfg.builtOn === 'land';
  if (isTower && cell.isLand) {
    setStatus('Towers must be built on the sea!', '#ff5252');
    return false;
  }
  if (isBuilding && !cell.isLand) {
    setStatus('Buildings must be built on land!', '#ff5252');
    return false;
  }

  // Check if cell is occupied
  if (cell.occupied) {
    setStatus('This area is already occupied!', '#ff5252');
    return false;
  }

  // Deduct cost
  state.hsi -= cfg.cost;

  // Create mesh
  let mesh;
  if (isTower) {
    mesh = createTowerMesh(type);
  } else {
    mesh = createBuildingMesh(type);
  }
  // Buildings sit on island surface (y=0.8), towers on water (y=0)
  mesh.position.set(cell.wx, isBuilding ? 0.8 : 0, cell.wz);
  scene.add(mesh);

  // Apply power
  if (cfg.power > 0) state.powerQuota += cfg.power;
  else state.powerUsed += cfg.power;

  cell.occupied = true;

  // Create structure record
  const structure = {
    type,
    mesh,
    cell,
    cx: cell.cx,
    cz: cell.cz,
    wx: cell.wx,
    wz: cell.wz,
    online: true,
    cooldown: 0,
    target: null,
    ...(isTower ? { range: cfg.range } : {})
  };

  if (isTower) {
    towers.push(structure);
  } else {
    buildings.push(structure);

    // Handle special building effects
    if (type === 'University') {
      state.hasUniversity = true;
      state.universityCount++;
      unlockStructure('FreezeTower');
      unlockStructure('ResearchCenter');
      setStatus('University built! Freeze Tower unlocked!', '#69f0ae');
    }
    if (type === 'ResearchCenter') {
      state.hasResearchCenter = true;
      state.researchCenterCount++;
      unlockStructure('RepelTower');
      unlockStructure('NuclearPlant');
      unlockStructure('CheungKong');
      setStatus('Research Center built! Repel Tower & Nuclear Plant unlocked!', '#69f0ae');
    }
    if (type === 'CheungKong') {
      state.hasCheungKong = true;
      // Upgrade repel towers
      for (const t of towers) {
        if (t.type === 'RepelTower') t.range += 1.5;
      }
      setStatus('CheungKong HQ built! Repel Tower upgraded, HSI boosted!', '#69f0ae');
    }
  }

  // Spawn build effect
  spawnEffect(cell.wx, 0.3, cell.wz, cfg.color || 0xffffff, 0.5);
  updatePower();
  updateUI();

  return true;
}

function unlockStructure(type) {
  const btn = document.querySelector(`.build-btn[data-type="${type}"]`);
  if (btn) btn.classList.remove('disabled');
}

// ==================== WAVE SYSTEM ====================
function updateWaves(dt) {
  state.gameTime += dt;
  state.waveTimer -= dt;

  if (state.waveTimer <= 0) {
    // Start new wave
    state.wave++;
    state.enemiesSpawnedInWave = 0;
    state.enemiesPerWave = Math.min(3 + state.wave, 15);
    state.spawnTimer = 0;
    state.waveTimer = CONFIG.waveSpawnInterval + Math.max(0, 10 - state.wave * 0.5);

    setStatus(`Wave ${state.wave} incoming!`, '#ffab40');
    document.getElementById('waveDisplay').textContent = state.wave;
  }

  // Spawn enemies during wave
  if (state.waveTimer > CONFIG.waveSpawnInterval - 3) {
    // Spawn phase
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.enemiesSpawnedInWave < state.enemiesPerWave) {
      spawnEnemy();
      state.enemiesSpawnedInWave++;
      state.spawnTimer = 0.8 + Math.random() * 0.4;
    }
  }

  // Update enemy count display
  document.getElementById('enemyCount').textContent = enemies.length;

  // Check win condition: survived enough waves and all enemies cleared
  if (state.wave >= WIN_WAVE && enemies.length === 0 && state.enemiesSpawnedInWave >= state.enemiesPerWave) {
    winGame();
  }
}

// ==================== UI ====================
function setStatus(msg, color) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.style.color = color || '#8ff4ff';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => {
    if (state.selectedType) {
      el.textContent = `Click on map to place ${getStructConfig(state.selectedType)?.title || ''}`;
    } else {
      el.textContent = 'Click a structure to build, then click on the map.';
    }
    el.style.color = '#8ff4ff';
  }, 3000);
}

function updateUI() {
  document.getElementById('hsiDisplay').textContent = Math.round(state.hsi);
  document.getElementById('livesDisplay').textContent = state.lives;
  document.getElementById('enemyCount').textContent = enemies.length;
  document.getElementById('waveDisplay').textContent = state.wave;
}

function gameOver() {
  state.phase = 'gameover';
  document.getElementById('gameover').classList.remove('hidden');
  document.getElementById('gameoverStat').textContent =
    `Wave ${state.wave} | Enemies destroyed: ${state.enemiesKilled} | Time: ${Math.floor(state.gameTime)}s`;
}

function winGame() {
  state.phase = 'win';
  document.getElementById('winoverlay').classList.remove('hidden');
  document.getElementById('winStat').textContent =
    `Final wave: ${state.wave} | Enemies destroyed: ${state.enemiesKilled} | Final HSI: ${Math.round(state.hsi)}`;
}

// ==================== INPUT HANDLING ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const planeIntersect = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function getGridCell(worldX, worldZ) {
  const cx = Math.round(worldX / CONFIG.cellSize);
  const cz = Math.round(worldZ / CONFIG.cellSize);
  // Clamp
  if (Math.abs(cx) > halfCells || Math.abs(cz) > halfCells) return null;
  return gridCells.find(c => c.cx === cx && c.cz === cz) || null;
}

function getMouseWorld(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeIntersect, point);
  return point;
}

// Building preview ghost
let previewGhost = null;
let previewValid = false;

function updatePreview(event) {
  if (!state.selectedType || state.phase !== 'playing') {
    if (previewGhost) {
      scene.remove(previewGhost);
      previewGhost = null;
    }
    return;
  }

  const world = getMouseWorld(event);

  // Show grid highlight
  if (!previewGhost) {
    const geom = new THREE.PlaneGeometry(CONFIG.cellSize * 0.95, CONFIG.cellSize * 0.95);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    previewGhost = new THREE.Mesh(geom, mat);
    previewGhost.rotation.x = -Math.PI / 2;
    scene.add(previewGhost);
  }

  const cell = getGridCell(world.x, world.z);
  if (cell) {
    previewGhost.position.set(cell.wx, CONFIG.groundY + 0.01, cell.wz);
    const cfg = getStructConfig(state.selectedType);
    const isLandStruct = cfg && cfg.builtOn === 'land';
    const valid = !cell.occupied &&
      isOnMap(cell.wx, cell.wz) &&
      (isLandStruct ? cell.isLand : !cell.isLand) &&
      state.hsi >= (cfg ? cfg.cost : Infinity) &&
      meetsRequirements(state.selectedType);

    previewGhost.material.color.setHex(valid ? 0x69f0ae : 0xff1744);
    previewGhost.material.opacity = valid ? 0.35 : 0.2;
    previewValid = valid;
  } else if (previewGhost) {
    previewGhost.position.set(world.x, CONFIG.groundY + 0.01, world.z);
    previewGhost.material.color.setHex(0xff1744);
    previewGhost.material.opacity = 0.2;
    previewValid = false;
  }
}

function handleMapClick(event) {
  if (state.phase !== 'playing' || !state.selectedType) return;

  const world = getMouseWorld(event);
  const cell = getGridCell(world.x, world.z);
  if (!cell) {
    setStatus('Invalid build location', '#ff5252');
    return;
  }

  if (placeStructure(cell, state.selectedType)) {
    // Keep selection active for rapid building
    setStatus(`${getStructConfig(state.selectedType).title} built!`, '#69f0ae');
  }
}

// Listeners
renderer.domElement.addEventListener('mousemove', updatePreview);
renderer.domElement.addEventListener('click', handleMapClick);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (state.phase === 'menu' && e.key === 'Enter') {
    document.getElementById('startBtn').click();
    return;
  }

  if (state.phase !== 'playing') return;

  const keyMap = {
    '1': 'LaserTower', '2': 'FreezeTower', '3': 'RepelTower',
    '4': 'PowerPlant',
    'q': 'NuclearPlant', 'Q': 'NuclearPlant',
    'w': 'University', 'W': 'University',
    'e': 'ResearchCenter', 'E': 'ResearchCenter',
    'r': 'CheungKong', 'R': 'CheungKong',
    'Escape': null
  };

  const type = keyMap[e.key];
  if (type !== undefined) {
    selectStructure(type);
    e.preventDefault();
  }
});

// Toolbar button handlers
document.querySelectorAll('.build-btn[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    selectStructure(type);
  });
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  selectStructure(null);
});

function selectStructure(type) {
  // Deselect all buttons
  document.querySelectorAll('.build-btn').forEach(b => { b.classList.remove('selected'); });

  if (!type) {
    state.selectedType = null;
    if (previewGhost) { scene.remove(previewGhost); previewGhost = null; }
    setStatus('Selection cleared.', '#8ff4ff');
    return;
  }

  const cfg = getStructConfig(type);
  if (!cfg) return;

  // Check if unlocked
  if (!isStructureUnlocked(type)) {
    setStatus(`${cfg.title} is locked! Build required tech first.`, '#ff5252');
    return;
  }

  state.selectedType = type;
  const btn = document.querySelector(`.build-btn[data-type="${type}"]`);
  if (btn) btn.classList.add('selected');

  const area = cfg.builtOn === 'land' ? 'land (island)' : 'sea (water)';
  setStatus(
    `Placing ${cfg.title} (Cost: ${cfg.cost} HSI, Power: ${cfg.power > 0 ? '+' : ''}${cfg.power}) on ${area}`,
    '#8ff4ff'
  );
}

// ==================== GAME LOOP ====================
function updateTowers(dt) {
  for (const t of towers) {
    if (!t.online) continue;

    t.cooldown -= dt;

    // Find nearest enemy in range
    let nearest = null;
    let nearDist = t.range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.wx;
      const dz = e.z - t.wz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearDist) {
        nearDist = dist;
        nearest = e;
      }
    }

    t.target = nearest;

    // Rotate tower turret to aim at target
    if (nearest && t.mesh.userData.turret) {
      const dx = nearest.x - t.wx;
      const dz = nearest.z - t.wz;
      const dist2d = Math.sqrt(dx * dx + dz * dz);
      if (dist2d > 0.1) {
        const up = new THREE.Vector3(0, 1, 0);
        const targetDir = new THREE.Vector3(dx, 1.0 - 0.45, dz).normalize();
        t.mesh.userData.turret.quaternion.setFromUnitVectors(up, targetDir);
        // Also rotate the turret ring (yaw) to face target
        if (t.mesh.userData.ring) {
          t.mesh.userData.ring.rotation.z = Math.atan2(dx, dz);
        }
      }
    }

    // Animate special tower visuals
    if (t.type === 'FreezeTower' && t.mesh.userData.body) {
      t.mesh.userData.body.rotation.y += dt * 1.5;
    }
    if (t.type === 'RepelTower' && t.mesh.userData.rings) {
      for (const r of t.mesh.userData.rings) {
        r.rotation.z += dt * 2;
      }
    }

    // Attack
    if (nearest && t.cooldown <= 0) {
      t.cooldown = getStructConfig(t.type).attackInterval;
      console.log(`TOWER_FIRE: ${t.type} at (${t.wx},${t.wz}) → enemy dist=${Math.sqrt((nearest.x-t.wx)**2+(nearest.z-t.wz)**2).toFixed(1)} hp=${nearest.hp.toFixed(0)}`);
      fireProjectile(t);
    }
  }
}

function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.05, clock.getDelta());

  if (state.phase === 'playing') {
    // Place default buildings once hitarea has classified cells
    if (useHitareaClassification && !state.defaultBuildingsPlaced) {
      placeDefaultBuildings();
      state.defaultBuildingsPlaced = true;
    }

    // Update systems
    updateWaves(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateTowers(dt);
    updateHSI(dt);
    updateEffects(dt);
    updatePower();

    // Check win condition (survive many waves = win)
    if (state.wave > 0 && state.lives > 0 && state.hsi > 0) {
      // Win after surviving a certain number of waves
    }
  } else {
    updateEffects(dt);
  }

  renderer.render(scene, camera);
}

// ==================== INITIALIZATION ====================
function startGame() {
  // Reset game state
  state.phase = 'playing';
  state.hsi = CONFIG.hsiInit;
  state.lives = CONFIG.livesMax;
  state.powerQuota = 0;
  state.powerUsed = 0;
  state.wave = 0;
  state.enemiesKilled = 0;
  state.gameTime = 0;
  state.waveTimer = CONFIG.waveInitDelay;
  state.spawnTimer = 0;
  state.enemiesPerWave = 3;
  state.enemiesSpawnedInWave = 0;
  state.enemyCount = 0;
  state.hasUniversity = false;
  state.hasResearchCenter = false;
  state.hasCheungKong = false;
  state.universityCount = 0;
  state.researchCenterCount = 0;
  state.selectedType = null;
  state.powerOutage = false;

  // Clear entities
  for (const e of enemies) {
    scene.remove(e.mesh);
    e.mesh.traverse(child => {
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => { m.dispose(); });
        else child.material.dispose();
      }
      if (child.geometry) child.geometry.dispose();
    });
  }
  enemies.length = 0;

  for (const p of projectiles) {
    scene.remove(p.mesh);
    p.mesh.material.dispose();
  }
  projectiles.length = 0;

  for (const e of effects) {
    scene.remove(e.mesh);
    e.mat.dispose();
  }
  effects.length = 0;

  // Remove all placed structures
  for (const t of towers) {
    scene.remove(t.mesh);
    // Dispose children
    t.mesh.traverse(c => {
      if (c.material) c.material.dispose();
      if (c.geometry) c.geometry.dispose();
    });
  }
  towers.length = 0;

  for (const b of buildings) {
    scene.remove(b.mesh);
    b.mesh.traverse(c => {
      if (c.material) c.material.dispose();
      if (c.geometry) c.geometry.dispose();
    });
  }
  buildings.length = 0;

  // Reset grid cells
  for (const cell of gridCells) cell.occupied = null;
  state.defaultBuildingsPlaced = false;

  // Reset structure buttons
  const lockedTypes = ['FreezeTower', 'RepelTower', 'NuclearPlant', 'ResearchCenter', 'CheungKong'];
  document.querySelectorAll('.build-btn[data-type]').forEach(btn => {
    if (lockedTypes.includes(btn.dataset.type)) {
      btn.classList.add('disabled');
    } else {
      btn.classList.remove('disabled');
    }
  });

  // Hide overlays
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('winoverlay').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');

  // Clear preview
  if (previewGhost) { scene.remove(previewGhost); previewGhost = null; }

  updateUI();
}

/** Place starter buildings at the home island once hitarea classifies cells */
function placeDefaultBuildings() {
  // Find unoccupied land cells near center
  const homeCells = gridCells.filter(c => c.isLand && !c.occupied);
  // Sort by distance to center
  homeCells.sort((a, b) => (a.wx*a.wx + a.wz*a.wz) - (b.wx*b.wx + b.wz*b.wz));

  if (homeCells.length < 2) {
    // Fallback: force-place even if cell classified as sea
    const forced = gridCells.filter(c => !c.occupied).sort(
      (a, b) => (a.wx*a.wx + a.wz*a.wz) - (b.wx*b.wx + b.wz*b.wz)
    );
    for (const cell of forced.slice(0, 3)) {
      cell.isLand = true; // override classification
      const type = cell === forced[0] ? 'PowerPlant' : (cell === forced[1] ? 'University' : 'PowerPlant');
      placeStructure(cell, type);
    }
    return;
  }

  // Place buildings starting from center outward
  const placements = [
    { type: 'PowerPlant', offset: 0 },
    { type: 'University', offset: 1 },
    { type: 'PowerPlant', offset: 2 },
  ];
  for (const p of placements) {
    if (p.offset < homeCells.length && !homeCells[p.offset].occupied) {
      placeStructure(homeCells[p.offset], p.type);
    }
  }
  console.log('DEFAULT BUILDINGS PLACED');
}

// Debug helper - expose internals for testing
window.__debug = { state, enemies, towers, buildings, projectiles, effects, placeStructure, gridCells, getStructConfig, CONFIG };

// Start / Restart buttons
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('winRestartBtn').addEventListener('click', startGame);

// Start game loop
gameLoop();

// Initial state display
document.getElementById('hsiDisplay').textContent = CONFIG.hsiInit;
document.getElementById('livesDisplay').textContent = CONFIG.livesMax;
