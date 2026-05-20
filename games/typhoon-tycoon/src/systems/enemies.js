import * as THREE from 'three';
import { scene } from '../core/three-setup.js';
import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';
import { effects, spawnBurst, spawnEffect } from './effects.js';
import { destroySceneryNear } from './scenery.js';
import { gameOver } from './ui.js';
import { playHitSound } from './audio.js';
import { setStatus } from './ui.js';

export const enemies = [];

// ==================== ENEMY SHARED GEOMETRIES ====================
const textureLoader = new THREE.TextureLoader();
const typhoonSpriteTexture = textureLoader.load('assets/typhoon.png');
const hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
const hpBarBgGeom = new THREE.BoxGeometry(0.8, 0.04, 0.06);
const hpBarFillMat = new THREE.MeshBasicMaterial({ color: 0x66bb6a });
const hpBarFillGeom = new THREE.BoxGeometry(0.76, 0.04, 0.05);

export function spawnEnemy() {
  const r = CONFIG.enemySpawnRadius;
  const dirs = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4];
  const dir = dirs[Math.floor(Math.random() * dirs.length)];
  const angle = dir + (Math.random() - 0.5) * Math.PI/9;
  const x = Math.cos(angle) * r;
  const z = Math.sin(angle) * r;

  const baseHp = CONFIG.enemyBaseHP + state.gameTime * 4;
  const hp = Math.round(baseHp * (0.8 + Math.random() * 0.4));

  // ===================== 3D TYPHOON (realistic cyclone from above) =====================
  const typhoonGroup = new THREE.Group();
  typhoonGroup.position.set(x, 1.2, z);
  const initScale = 0.4 + (hp / (CONFIG.enemyBaseHP + state.gameTime * 4)) * 1.1;
  typhoonGroup.scale.setScalar(initScale);
  // Store visual radius in world-units for hitbox — same as original but now explicit
  typhoonGroup.userData.hitRadius = initScale * 1.8;

  const allTyphoonMats = [];

  // --- OUTER CLOUD CANOPY (broad semi-transparent deck, fading edges) ---
  const canopyMat = new THREE.MeshBasicMaterial({
    color: 0xf0f0f0, transparent: true, opacity: 0.13,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(canopyMat);
  const canopy = new THREE.Mesh(new THREE.RingGeometry(0.3, 2.8, 64), canopyMat);
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.y = -0.28;
  typhoonGroup.add(canopy);

  // --- MID CLOUD LAYER (denser inner cloud mass) ---
  const midCloudMat = new THREE.MeshBasicMaterial({
    color: 0xfafafa, transparent: true, opacity: 0.18,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(midCloudMat);
  const midCloud = new THREE.Mesh(new THREE.RingGeometry(0.25, 2.2, 56), midCloudMat);
  midCloud.rotation.x = -Math.PI / 2;
  midCloud.position.y = -0.06;
  typhoonGroup.add(midCloud);

  // --- EYE (dark blue center gap — calm eye of the storm) ---
  const eyeGeom = new THREE.CircleGeometry(0.21, 32);
  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0x08192e, transparent: true, opacity: 0.72,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(eyeMat);
  const eye = new THREE.Mesh(eyeGeom, eyeMat);
  eye.rotation.x = -Math.PI / 2;
  eye.position.y = 0.01;
  typhoonGroup.add(eye);

  // --- EYEWALL (bright dense ring of violent convection around eye) ---
  const eyewallMat = new THREE.MeshBasicMaterial({
    color: 0xe3e8f0, transparent: true, opacity: 0.48,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(eyewallMat);
  const eyewall = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.36, 48), eyewallMat);
  eyewall.rotation.x = -Math.PI / 2;
  eyewall.position.y = 0.02;
  typhoonGroup.add(eyewall);

  // --- INNER EYEWALL (brightest, most opaque inner ring) ---
  const innerWallMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(innerWallMat);
  const innerWall = new THREE.Mesh(new THREE.RingGeometry(0.21, 0.28, 40), innerWallMat);
  innerWall.rotation.x = -Math.PI / 2;
  innerWall.position.y = 0.03;
  typhoonGroup.add(innerWall);

  // --- CORE GLOW (blue storm energy at heart of cyclone) ---
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x4fc3f7, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  allTyphoonMats.push(coreMat);
  const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), coreMat);
  coreGlow.position.y = 0.04;
  typhoonGroup.add(coreGlow);

  // --- SPIRAL RAINBANDS (4 asymmetric logarithmic-spiral arms) ---
  // Arms vary in length, tightness, and opacity — real typhoons are NOT symmetric
  const armMats = [];
  const armConfigs = [
    { startAngle: 0.0,             segments: 12, a: 0.32, b: 0.085, opacity: 0.20 },
    { startAngle: Math.PI * 0.72,  segments: 16, a: 0.34, b: 0.065, opacity: 0.15 },
    { startAngle: Math.PI * 1.35,  segments: 10, a: 0.30, b: 0.100, opacity: 0.24 },
    { startAngle: Math.PI * 1.88,  segments: 14, a: 0.31, b: 0.075, opacity: 0.17 }
  ];

  for (const cfg of armConfigs) {
    for (let seg = 0; seg < cfg.segments; seg++) {
      const t = seg / cfg.segments;
      const theta = t * Math.PI * 2.3;       // each arm wraps ~1.15 full rotations
      const radius = cfg.a * Math.exp(cfg.b * theta);
      const angle = cfg.startAngle + theta;    // counterclockwise from start

      // Arm segments thicken near core, thin at tips
      const segWidth = 0.045 + (1 - t) * 0.035;
      const arcLen = Math.PI * 0.38 + t * 0.22;

      const aMat = new THREE.MeshBasicMaterial({
        color: 0xfafafa, transparent: true,
        opacity: cfg.opacity * (0.55 + t * 0.45),
        side: THREE.DoubleSide, depthWrite: false
      });
      armMats.push(aMat);
      allTyphoonMats.push(aMat);
      aMat._bop = cfg.opacity * (0.55 + t * 0.45);

      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(radius, segWidth, 4, 12, arcLen),
        aMat
      );
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = angle;
      arc.position.set(
        Math.cos(angle) * radius,
        -0.10 + seg * 0.025,   // slight vertical stacking
        Math.sin(angle) * radius
      );
      typhoonGroup.add(arc);
    }
  }

  // --- TEXTURE PLANE (satellite overlay for extra visual richness) ---
  const planeMat = new THREE.MeshBasicMaterial({
    map: typhoonSpriteTexture, transparent: true, opacity: 0.14,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  allTyphoonMats.push(planeMat);
  const texPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), planeMat);
  texPlane.rotation.x = -Math.PI / 2;
  texPlane.position.y = 0.04;
  typhoonGroup.add(texPlane);

  // --- PARTICLES (wind streaks + cloud wisps + rain curtain below) ---
  const particleData = [];
  // Wind streak particles (fast tangential flow, mid-radii)
  for (let i = 0; i < 32; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.28 + Math.random() * 2.4;
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xf2f2f2, transparent: true,
      opacity: 0.14 + Math.random() * 0.22, depthWrite: false
    });
    allTyphoonMats.push(pMat);
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.02 + Math.random() * 0.03, 4, 4), pMat
    );
    pMesh.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.25, Math.sin(a) * r);
    typhoonGroup.add(pMesh);
    particleData.push({ mesh: pMesh, angle: a, radius: r, speed: 0.8 + Math.random() * 1.4, type: 'wind' });
  }
  // Cloud wisp particles (larger, slower, at outer edge — diffuse canopy)
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() * 1.6;
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xfcfcfc, transparent: true,
      opacity: 0.06 + Math.random() * 0.10, depthWrite: false
    });
    allTyphoonMats.push(pMat);
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random() * 0.06, 4, 4), pMat
    );
    pMesh.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.12, Math.sin(a) * r);
    typhoonGroup.add(pMesh);
    particleData.push({ mesh: pMesh, angle: a, radius: r, speed: 0.25 + Math.random() * 0.4, type: 'wisp' });
  }
  // Rain curtain particles (below cloud deck, fast, small, blue-tinted)
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.25 + Math.random() * 1.6;
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xc8ddf0, transparent: true,
      opacity: 0.10 + Math.random() * 0.14, depthWrite: false
    });
    allTyphoonMats.push(pMat);
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.012 + Math.random() * 0.016, 3, 3), pMat
    );
    pMesh.position.set(Math.cos(a) * r, -0.35 - Math.random() * 0.5, Math.sin(a) * r);
    typhoonGroup.add(pMesh);
    particleData.push({ mesh: pMesh, angle: a, radius: r, speed: 1.2 + Math.random() * 1.8, type: 'rain' });
  }
  typhoonGroup.userData.particles = particleData;

  scene.add(typhoonGroup);

  // Health bar
  const hpBg = new THREE.Mesh(hpBarBgGeom, hpBarBgMat);
  hpBg.position.set(x, 1.6, z);
  scene.add(hpBg);

  const hpFill = new THREE.Mesh(hpBarFillGeom, hpBarFillMat.clone());
  hpFill.position.set(x, 1.6, z);
  scene.add(hpFill);

  const enemy = {
    mesh: typhoonGroup,
    coreMat,
    eyeMat,
    eyewallMat,
    innerWallMat,
    armMats,
    allTyphoonMats,
    hpBar: { bg: hpBg, fill: hpFill },
    x, z,
    hp,
    maxHp: hp,
    speed: CONFIG.enemyBaseSpeed + state.gameTime / 50,
    moveAngle: Math.atan2(-z, -x),
    isSlowed: 0,
    slowFactor: 0,
    repelX: 0,
    repelZ: 0,
    alive: true,
    passedHK: false,
    clearedHK: false,
    turnRate: 0.3 + Math.random() * 0.5,
    wobbleSpeed: 0.5 + Math.random() * 1.5,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 0.4 + Math.random() * 0.8
  };

  enemies.push(enemy);
  state.enemyCount++;
}

export function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.alive) continue;

    // Repel — apply as direct position push (not angle tweak)
    if (e.repelX !== 0 || e.repelZ !== 0) {
      e.mesh.position.x += e.repelX * dt;
      e.mesh.position.z += e.repelZ * dt;
      e.repelX *= 0.95;
      e.repelZ *= 0.95;
      if (Math.abs(e.repelX) < 0.001) e.repelX = 0;
      if (Math.abs(e.repelZ) < 0.001) e.repelZ = 0;
    }

    // Random drift
    e.moveAngle += (Math.random() - 0.5) * e.turnRate * dt;

    // Outward push after clearing HK
    if (e.clearedHK) {
      const exitAngle = Math.atan2(e.z, e.x);
      const angleDiff = e.moveAngle - exitAngle;
      const normDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      e.moveAngle -= normDiff * 0.3 * dt;
    }

    // Sinusoidal wobble
    const wobble = Math.sin(state.gameTime * e.wobbleSpeed + e.wobblePhase) * e.wobbleAmp;
    e.moveAngle += wobble * dt;

    // Slow effect
    let spd = e.speed * dt;
    const slowed = e.isSlowed > 0;
    if (slowed) {
      spd *= (1 - e.slowFactor);
      e.isSlowed -= dt;
    }

    // Movement
    let moveX = Math.cos(e.moveAngle);
    let moveZ = Math.sin(e.moveAngle);
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    // Color shift on slow — freeze effect tints blue
    if (slowed) {
      e.coreMat.color.setHex(0x81d4fa);
      for (const am of e.armMats) am.color.setHex(0xb3e5fc);
    } else {
      e.coreMat.color.setHex(0x4fc3f7);
      for (const am of e.armMats) am.color.setHex(0xfafafa);
    }

    e.mesh.position.x += moveX * spd;
    e.mesh.position.z += moveZ * spd;
    e.x = e.mesh.position.x;
    e.z = e.mesh.position.z;

    // Recompute distance AFTER movement for accurate land/sea classification
    const distToCenter = Math.sqrt(e.x * e.x + e.z * e.z);

    // Destroy decorative scenery this typhoon touches (anywhere — sea or land)
    const hitR = e.mesh.userData.hitRadius || 1.8;
    destroySceneryNear(e.x, e.z, hitR);

    // Sea regen / land decay — scales with gameTime to stay visible alongside soaring enemy HP
    const hpScale = 1 + state.gameTime * 0.04; // ~5x at gameTime 100, ~9x at 200
    if (distToCenter > CONFIG.islandRadius + 0.5) {
      const regenPerSec = (2 + Math.random() * 3) * hpScale;
      e.hp = Math.min(e.maxHp, e.hp + regenPerSec * dt);
    } else {
      const decayPerSec = (3 + (e.hp / e.maxHp) * 4) * hpScale;
      e.hp -= decayPerSec * dt;
      if (e.hp <= 0) {
        console.log(`ENEMY_DISSIPATED`);
        spawnBurst(e.x, 0.5, e.z, 0x4fc3f7, 8);
        removeEnemy(i);
        continue;
      }
    }

    // Size follows HP — also update hitbox radius for scenery destruction
    const newScale = 0.4 + (e.hp / e.maxHp) * 1.1;
    if (e.mesh.scale.x !== newScale) {
      e.mesh.scale.setScalar(newScale);
      e.mesh.userData.hitRadius = newScale * 1.8;
    }

    // HP bar position
    e.hpBar.bg.position.set(e.x, 1.6, e.z);
    e.hpBar.fill.position.set(e.x, 1.6, e.z);
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    e.hpBar.fill.scale.x = Math.max(0.01, hpRatio);
    const hpColor = hpRatio > 0.5 ? 0x66bb6a : (hpRatio > 0.25 ? 0xffa726 : 0xef5350);
    e.hpBar.fill.material.color.setHex(hpColor);

    // HSI drain while typhoon covers HK
    if (distToCenter < CONFIG.islandRadius + 0.5) {
      if (!e.passedHK) e.passedHK = true;
      if (!e.clearedHK && e.passedHK) {
        const hsiDrain = e.hp * 0.01 * dt;
        state.hsi -= hsiDrain;
        if (state.hsi <= 0) {
          state.hsi = 0;
          gameOver();
        }
      }
    } else if (e.passedHK && !e.clearedHK) {
      e.clearedHK = true;
    }

    // 3D animations — multi-speed counterclockwise rotation (Northern Hemisphere cyclone)
    e.mesh.rotation.y += dt * 2.5; // whole storm rotates CCW (viewed from above)
    if (e.mesh.userData.particles) {
      for (const pd of e.mesh.userData.particles) {
        // Wind streaks orbit fast near core, slow at edge (differential rotation)
        const speedMod = pd.type === 'rain' ? 1.3 : (pd.type === 'wind' ? 1.0 : 0.6);
        pd.angle += dt * pd.speed * speedMod;
        // Slight radial oscillation for wispy feel
        const rOsc = pd.type === 'wisp' ? pd.radius + Math.sin(state.gameTime * 2 + pd.angle) * 0.08 : pd.radius;
        pd.mesh.position.x = Math.cos(pd.angle) * rOsc;
        pd.mesh.position.z = Math.sin(pd.angle) * rOsc;
        // Rain curtain bobs down
        if (pd.type === 'rain') {
          pd.mesh.position.y = -0.35 - Math.abs(Math.sin(state.gameTime * 3 + pd.angle)) * 0.25;
        }
      }
    }

    // Core glow pulses with storm intensity (brightness tied to HP ratio)
    e.coreMat.opacity = (0.4 + Math.sin(state.gameTime * 5) * 0.08) * (0.3 + hpRatio * 0.7);
    // Eyewall brightens as storm weakens (less cloud = more visible dense core ring)
    e.eyewallMat.opacity = 0.48 * (0.3 + hpRatio * 0.7);
    e.innerWallMat.opacity = 0.35 * (0.3 + hpRatio * 0.7);
    // Spiral arms fade with HP
    for (const am of e.armMats) {
      const base = (am._bop || 0.2);
      am.opacity = base * (0.3 + hpRatio * 0.7);
    }

    // Despawn if too far
    if (Math.abs(e.x) > 20 || Math.abs(e.z) > 20) {
      removeEnemy(i);
      continue;
    }
  }

  // Update HK danger overlay — red border flash when typhoon covers HK
  const dangerEl = document.getElementById('dangerOverlay');
  if (dangerEl) {
    const anyOverHK = enemies.some(e => e.alive && !e.clearedHK && e.passedHK);
    if (anyOverHK) {
      dangerEl.classList.remove('hidden');
      // Intensity scales with how low HSI is
      if (state.hsi < 1500) {
        dangerEl.className = 'critical';
      } else {
        dangerEl.className = 'active';
      }
    } else {
      dangerEl.className = 'hidden';
    }
  }
}

export function removeEnemy(index) {
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
    // Each enemy clones the fill material — dispose the clone (bg is shared, not disposed)
    if (e.hpBar.fill.material) e.hpBar.fill.material.dispose();
  }
  e.alive = false;
  state.enemyCount--;
  enemies.splice(index, 1);
}

export function damageEnemy(enemy, damage) {
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    console.log(`ENEMY_KILLED: hp was ${enemy.hp+damage}, took ${damage} dmg`);
    state.hsi += CONFIG.killRewardHSI;
    state.enemiesKilled++;
    spawnBurst(enemy.x, 0.5, enemy.z, 0xffab00, 12);
    spawnEffect(enemy.x, 0.5, enemy.z, 0xff6d00, 0.4);
    playHitSound();
    const idx = enemies.indexOf(enemy);
    if (idx !== -1) removeEnemy(idx);
  }
}
