import * as THREE from 'three';
import { GameConfig } from './GameConfig.js';

export class Enemy {
    constructor(scene, effects, year) {
        this.scene = scene;
        this.effects = effects;
        this.year = year;
        this.alive = true;
        
        this.maxHP = GameConfig.enemy.baseHP * GameConfig.wave.healthMultiplier(year);
        this.hp = this.maxHP;
        this.speed = GameConfig.enemy.baseSpeed * GameConfig.wave.speedMultiplier(year);
        
        // Spawn at random edge point
        const angle = Math.random() * Math.PI * 2;
        const radius = GameConfig.world.mapSize / 2;
        this.position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        
        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        // Vortex effect: multiple rotating rings
        this.vortex = new THREE.Group();
        const ringGeom = new THREE.TorusGeometry(0.8, 0.05, 8, 32);
        for(let i=0; i<5; i++) {
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x88ccff, 
                transparent: true, 
                opacity: 0.6,
                emissive: 0x00ffff,
                emissiveIntensity: 0.5
            });
            const ring = new THREE.Mesh(ringGeom, mat);
            ring.rotation.x = Math.random() * Math.PI;
            ring.rotation.y = Math.random() * Math.PI;
            ring.scale.setScalar(0.5 + i * 0.3);
            this.vortex.add(ring);
        }
        this.group.add(this.vortex);
        
        // Central core: A spinning diamond with glow
        const coreGeom = new THREE.OctahedronGeometry(0.5);
        const coreMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0x00ffff,
            emissiveIntensity: 2,
            metalness: 1,
            roughness: 0
        });
        this.core = new THREE.Mesh(coreGeom, coreMat);
        this.group.add(this.core);
        
        // Add a point light to the typhoon
        this.light = new THREE.PointLight(0x00ffff, 2, 5);
        this.light.position.y = 1;
        this.group.add(this.light);

        this.scene.add(this.group);
        this.createHealthBar();
    }

    createHealthBar() {
        const barGeom = new THREE.PlaneGeometry(1.5, 0.2);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
        this.healthBg = new THREE.Mesh(barGeom, bgMat);
        this.healthBg.position.y = 2.5;
        this.group.add(this.healthBg);

        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        this.healthFg = new THREE.Mesh(barGeom, fgMat);
        this.healthFg.position.y = 2.5;
        this.healthFg.position.z = 0.01;
        this.group.add(this.healthFg);
    }

    update(dt, camera) {
        if (!this.alive) return;

        // Move towards center (0,0,0)
        const dir = new THREE.Vector3(0, 0, 0).sub(this.group.position).normalize();
        this.group.position.add(dir.multiplyScalar(this.speed * dt));
        
        // Vortex rotation
        this.vortex.children.forEach((ring, i) => {
            ring.rotation.y += dt * (i + 1) * 2;
            ring.rotation.z += dt * (i + 1) * 1.5;
        });
        this.core.rotation.x += dt * 5;

        // Billboard health bar
        if (camera) {
            this.healthBg.quaternion.copy(camera.quaternion);
            this.healthFg.quaternion.copy(camera.quaternion);
        }

        // Check if reached center
        if (this.group.position.length() < 0.5) {
            this.die(false);
            return true; // Reached center
        }
        return false;
    }

    takeDamage(amount) {
        this.hp -= amount;
        const ratio = Math.max(0, this.hp / this.maxHP);
        this.healthFg.scale.x = ratio;
        this.healthFg.position.x = (ratio - 1) * 0.75;
        this.healthFg.visible = ratio > 0;

        if (this.hp <= 0) {
            this.die(true);
            return true;
        }
        return false;
    }

    die(killed) {
        if (!this.alive) return;
        this.alive = false;
        if (killed) {
            this.effects.spawnBurst(this.group.position, 0x00ffff, 20);
        }
        this.scene.remove(this.group);
        // Disposal
        this.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    }

    getPosition() {
        return this.group.position;
    }
}
