import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * Defensive Tower and Structure Entity
 * LLM-Model: deepseek-v4-flash-free
 */
export class Tower {
    constructor(scene, pos, type, assets, effects) {
        this.scene = scene;
        this.position = pos;
        this.type = type;
        this.assets = assets;
        this.effects = effects;
        this.config = Config.STRUCTURES[type];

        this.lastAttack = 0;
        this.level = 1;

        // Dynamic stats
        this.damage = this.config.damage || 0;
        this.range = this.config.range || 0;
        this.attackSpeed = this.config.attackSpeed || 1;
        this.repelForce = this.config.repelForce || 0;

        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);

        // Base - Metallic Sci-fi look
        const baseGeom = new THREE.CylinderGeometry(0.8, 1.0, 0.5, 6);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.9,
            roughness: 0.1
        });
        const base = new THREE.Mesh(baseGeom, baseMat);
        base.position.y = 0.25;
        this.group.add(base);

        // Sprite Icon above tower
        const spriteTex = this.assets.get(this.config.sprite);
        if (spriteTex) {
            const spriteMat = new THREE.SpriteMaterial({
                map: spriteTex,
                transparent: true
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.y = 1.5;
            sprite.scale.set(1.5, 1.5, 1);
            this.group.add(sprite);
        }

        // Visual indicator for type
        const headGeom = new THREE.BoxGeometry(0.4, 0.8, 0.4);
        const headMat = new THREE.MeshStandardMaterial({
            color: this.config.color,
            emissive: this.config.color,
            emissiveIntensity: 0.5
        });
        this.head = new THREE.Mesh(headGeom, headMat);
        this.head.position.y = 0.8;
        this.group.add(this.head);

        // Range ring
        if (this.range > 0) {
            const rangeGeom = new THREE.RingGeometry(this.range - 0.1, this.range + 0.1, 64);
            const rangeMat = new THREE.MeshBasicMaterial({
                color: this.config.color,
                transparent: true,
                opacity: 0.15,
                side: THREE.DoubleSide
            });
            this.rangeRing = new THREE.Mesh(rangeGeom, rangeMat);
            this.rangeRing.rotation.x = -Math.PI / 2;
            this.rangeRing.position.y = 0.05;
            this.group.add(this.rangeRing);
        }

        this.scene.add(this.group);
    }

    update(dt, enemies, currentTime, hasPower, buffs) {
        // Apply buffs
        this.applyBuffs(buffs);

        if (this.range === 0) return;
        if (!hasPower) {
            this.head.material.emissiveIntensity = 0;
            return;
        }
        this.head.material.emissiveIntensity = 0.5 + Math.sin(currentTime * 0.005) * 0.2;

        if (currentTime - this.lastAttack > 1000 / this.attackSpeed) {
            const target = this.findTarget(enemies);
            if (target) {
                this.attack(target);
                this.lastAttack = currentTime;
            }
        }
    }

    applyBuffs(buffs) {
        if (!buffs) return;

        let d = this.config.damage || 0;
        let r = this.config.range || 0;
        let s = this.config.attackSpeed || 1;
        let f = this.config.repelForce || 0;

        if (this.type === 'LaserTower') {
            d += (buffs.laserDamage || 0);
            r += (buffs.laserRange || 0);
        } else if (this.type === 'FreezeTower') {
            d += (buffs.freezeDamage || 0);
            r += (buffs.freezeRange || 0);
        } else if (this.type === 'RepelTower') {
            r += (buffs.repelRange || 0);
            f += (buffs.repelForce || 0);
        }

        this.damage = d;
        this.range = r;
        this.attackSpeed = s;
        this.repelForce = f;

        if (this.rangeRing) {
            this.rangeRing.scale.setScalar(this.range / this.config.range);
        }
    }

    findTarget(enemies) {
        let bestTarget = null;
        let minDistSq = this.range * this.range;
        for (const e of enemies) {
            if (!e.alive) continue;
            const distSq = this.position.distanceToSquared(e.getPosition());
            if (distSq < minDistSq) {
                minDistSq = distSq;
                bestTarget = e;
            }
        }
        return bestTarget;
    }

    attack(target) {
        const start = this.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const end = target.getPosition();

        if (this.type === 'LaserTower') {
            this.effects.spawnLaser(start, end, this.config.color);
            target.takeDamage(this.damage);
        } else if (this.type === 'FreezeTower') {
            this.effects.spawnLaser(start, end, this.config.color, 0.2);
            target.takeDamage(this.damage);
            target.applySlow(this.config.slowFactor, 1.5);
        } else if (this.type === 'RepelTower') {
            this.effects.spawnBurst(end, this.config.color, 20);
            target.takeDamage(this.damage);
            // Repel logic: push back from center
            const pushDir = target.getPosition().clone().normalize();
            target.group.position.addScaledVector(pushDir, this.repelForce);
        }
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    }
}
