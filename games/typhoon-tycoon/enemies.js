import * as THREE from 'three';
import { scene } from './three-setup.js';
import { CONFIG } from './config.js';
import { state } from './state.js';
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

  // ===================== 3D TyPhoon (volumetric cyclone) =====================
  const typhoonGroup = new THREE.Group();
  typhoonGroup.position.set(x, 1.2, z);
  typhoonGroup.scale.setScalar(0.4 + (hp / (CONFIG.enemyBaseHP + state.gameTime * 4)) * 1.1);

  const allTyphoonMats = [];

  // Wide cloud base deck
  const deckMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.08,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(deckMat);
  const deck = new THREE.Mesh(new THREE.RingGeometry(0.8, 2.6, 48), deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -0.25;
  typhoonGroup.add(deck);

  // Upper cloud wisp
  const wispMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.05,
    side: THREE.DoubleSide, depthWrite: false
  });
  allTyphoonMats.push(wispMat);
  const wisp = new THREE.Mesh(new THREE.RingGeometry(0.6, 2.1, 40), wispMat);
  wisp.rotation.x = -Math.PI / 2;
  wisp.position.y = 0.12;
  typhoonGroup.add(wisp);

  // Eye wall
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

  // Core glow
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x4fc3f7, transparent: true, opacity: 0.55
  });
  allTyphoonMats.push(coreMat);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), coreMat);
  core.position.y = 0.05;
  typhoonGroup.add(core);

  // Spiral rainbands
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

  // Typhoon texture plane
  const planeMat = new THREE.MeshBasicMaterial({
    map: typhoonSpriteTexture, transparent: true, opacity: 0.2,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  allTyphoonMats.push(planeMat);
  const texPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), planeMat);
  texPlane.rotation.x = -Math.PI / 2;
  texPlane.position.y = 0.06;
  typhoonGroup.add(texPlane);

  // Orbiting particles
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

  // Health bar
  const hpBg = new THREE.Mesh(hpBarBgGeom, hpBarBgMat);
  hpBg.position.set(x, 1.6, z);
  scene.add(hpBg);

  const hpFill = new THREE.Mesh(hpBarFillGeom, hpBarFillMat);
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

    const distToCenter = Math.sqrt(e.x * e.x + e.z * e.z);

    // Repel
    if (e.repelX !== 0 || e.repelZ !== 0) {
      const repelAngle = Math.atan2(e.repelZ, e.repelX);
      e.moveAngle += repelAngle * 0.1 * dt;
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

    // Color shift on slow
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

    // Destroy scenery as typhoon passes
    if (distToCenter > CONFIG.islandRadius + 0.5) {
      destroySceneryNear(e.x, e.z, 1.8);
    }

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
        const idx = enemies.indexOf(e);
        if (idx !== -1) removeEnemy(idx);
        continue;
      }
    }

    // Size follows HP
    const newScale = 0.4 + (e.hp / e.maxHp) * 1.1;
    if (e.mesh.scale.x !== newScale) {
      e.mesh.scale.setScalar(newScale);
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

    // 3D animations
    e.mesh.rotation.y += dt * 3;
    if (e.mesh.userData.particles) {
      for (const pd of e.mesh.userData.particles) {
        pd.angle += dt * pd.speed;
        pd.mesh.position.x = Math.cos(pd.angle) * pd.radius;
        pd.mesh.position.z = Math.sin(pd.angle) * pd.radius;
      }
    }

    e.coreMat.opacity = (0.6 + Math.sin(state.gameTime * 4) * 0.1) * (0.3 + hpRatio * 0.7);
    e.eyeMat.opacity = 0.3 * (0.3 + hpRatio * 0.7);
    for (const am of e.armMats) {
      const base = (am._bop || 0.3);
      am.opacity = base * (0.3 + hpRatio * 0.7);
    }

    // Despawn if too far
    if (Math.abs(e.x) > 20 || Math.abs(e.z) > 20) {
      removeEnemy(i);
      continue;
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
