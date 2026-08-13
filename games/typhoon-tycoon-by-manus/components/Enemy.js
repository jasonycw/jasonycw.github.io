import * as THREE from 'three';
import { GameConfig } from './GameConfig.js';

// Shared resources to avoid per-instance allocation
const enemyGeometry = new THREE.ConeGeometry(5, 15, 8);
const enemyMaterial = new THREE.MeshPhongMaterial({ color: 0xFF4500 });
const barGeometry = new THREE.PlaneGeometry(10, 1.2);
const bgMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF00 });

export class Enemy {
    constructor(scene, path, waveNumber = 1) {
        this.scene = scene;
        this.path = path;
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
        // Gemini Feedback: Use a Group to allow cone rotation while keeping health bars stable
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.path[0]);
        this.mesh.position.y = 7.5;

        this.cone = new THREE.Mesh(enemyGeometry, enemyMaterial);
        this.mesh.add(this.cone);

        this.scene.add(this.mesh);

        this.createHealthBar();
    }

    createHealthBar() {
        this.healthBarBg = new THREE.Mesh(barGeometry, bgMaterial);
        this.healthBarBg.position.y = 20;
        this.mesh.add(this.healthBarBg);

        this.healthBarFg = new THREE.Mesh(barGeometry, fgMaterial);
        this.healthBarFg.position.y = 20;
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
                this.die();
                return true;
            }
            this.updateSegmentLength();
        }

        const currentWaypoint = this.path[this.pathIndex];
        const nextWaypoint = this.path[this.pathIndex + 1];
        this.mesh.position.lerpVectors(currentWaypoint, nextWaypoint, this.progress);
        this.mesh.position.y = 7.5;

        if (camera) {
            this.healthBarBg.quaternion.copy(camera.quaternion);
            this.healthBarFg.quaternion.copy(camera.quaternion);
        }

        // Gemini Feedback: Rotate only the cone mesh
        if (this.cone) {
            this.cone.rotation.y += deltaTime * 5;
        }

        return false;
    }

    takeDamage(amount) {
        this.hp -= amount;
        const healthRatio = Math.max(0, this.hp / this.maxHP);
        this.healthBarFg.scale.x = healthRatio;
        this.healthBarFg.position.x = (healthRatio - 1) * 5;
        // Gemini Feedback: Hide bar when health is 0
        this.healthBarFg.visible = healthRatio > 0;

        if (this.hp <= 0 && this.alive) {
            this.die();
            return true;
        }
        return false;
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.scene.remove(this.mesh);
        // Note: Geometries and materials are shared, so we don't dispose them here.
    }

    getPosition() {
        return this.mesh.position;
    }

    isAlive() {
        return this.alive;
    }
}
