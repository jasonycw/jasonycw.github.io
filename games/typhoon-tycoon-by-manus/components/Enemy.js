import * as THREE from 'three';
import { GameConfig } from './GameConfig.js';

// Shared resources
const enemyGeometry = new THREE.TorusKnotGeometry(4, 1.2, 64, 8);
const enemyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x888888, 
    roughness: 0.3, 
    metalness: 0.8,
    emissive: 0x222222
});
const barGeometry = new THREE.PlaneGeometry(12, 1.5);
const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.7 });
const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

export class Enemy {
    constructor(scene, path, waveNumber = 1, effects) {
        this.scene = scene;
        this.path = path;
        this.effects = effects;
        this.pathIndex = 0;
        this.progress = 0;
        this.alive = true;
        this.waveNumber = waveNumber;

        this.maxHP = GameConfig.enemy.maxHP * GameConfig.wave.enemyHealthMultiplier(waveNumber);
        this.hp = this.maxHP;
        this.speed = GameConfig.enemy.speed;
        this.damage = GameConfig.enemy.damage;
        this.reward = GameConfig.enemy.reward;

        this.segmentLength = 0;
        this.updateSegmentLength();

        this.createMesh();
    }

    updateSegmentLength() {
        if (this.pathIndex < this.path.length - 1) {
            this.segmentLength = this.path[this.pathIndex].distanceTo(this.path[this.pathIndex + 1]);
        }
    }

    createMesh() {
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.path[0]);
        this.mesh.position.y = 10;

        // Visual "Typhoon" core
        this.core = new THREE.Mesh(enemyGeometry, enemyMaterial);
        this.mesh.add(this.core);
        
        // Add a glow light
        this.light = new THREE.PointLight(0x00ffcc, 1, 30);
        this.light.position.y = 5;
        this.mesh.add(this.light);

        this.scene.add(this.mesh);
        this.createHealthBar();
    }

    createHealthBar() {
        this.healthBarBg = new THREE.Mesh(barGeometry, bgMaterial);
        this.healthBarBg.position.y = 25;
        this.mesh.add(this.healthBarBg);

        this.healthBarFg = new THREE.Mesh(barGeometry, fgMaterial);
        this.healthBarFg.position.y = 25;
        this.healthBarFg.position.z = 0.1;
        this.mesh.add(this.healthBarFg);
    }

    update(deltaTime, camera) {
        if (!this.alive) return false;

        const moveDistance = this.speed * deltaTime;
        if (this.segmentLength > 0) {
            this.progress += moveDistance / this.segmentLength;
        }

        if (this.progress >= 1) {
            this.pathIndex++;
            this.progress = 0;

            if (this.pathIndex >= this.path.length - 1) {
                this.die(false);
                return true;
            }
            this.updateSegmentLength();
        }

        const currentWaypoint = this.path[this.pathIndex];
        const nextWaypoint = this.path[this.pathIndex + 1];
        this.mesh.position.lerpVectors(currentWaypoint, nextWaypoint, this.progress);
        this.mesh.position.y = 10 + Math.sin(Date.now() * 0.005) * 2; // Hover effect

        if (camera) {
            this.healthBarBg.quaternion.copy(camera.quaternion);
            this.healthBarFg.quaternion.copy(camera.quaternion);
        }

        if (this.core) {
            this.core.rotation.y += deltaTime * 3;
            this.core.rotation.x += deltaTime * 2;
        }

        return false;
    }

    takeDamage(amount) {
        this.hp -= amount;
        const healthRatio = Math.max(0, this.hp / this.maxHP);
        this.healthBarFg.scale.x = healthRatio;
        this.healthBarFg.position.x = (healthRatio - 1) * 6;
        this.healthBarFg.visible = healthRatio > 0;

        if (this.hp <= 0 && this.alive) {
            this.die(true);
            return true;
        }
        return false;
    }

    die(killed = true) {
        if (!this.alive) return;
        this.alive = false;
        
        if (killed && this.effects) {
            this.effects.spawnBurst(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z, 0x00ffcc, 15);
        }
        
        this.scene.remove(this.mesh);
    }

    getPosition() {
        return this.mesh.position;
    }

    isAlive() {
        return this.alive;
    }
}
