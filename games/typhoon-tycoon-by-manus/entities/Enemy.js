import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * Realistic Typhoon Enemy with Volumetric Vortex Effect
 * Addressing: Visual quality, Billboard health bars, Resource disposal
 * LLM-Model: gpt-4.1-mini
 */
export class Enemy {
    constructor(scene, assets, effects, year) {
        this.scene = scene;
        this.assets = assets;
        this.effects = effects;
        this.year = year;
        this.alive = true;
        
        this.maxHP = Config.ENEMY.BASE_HP * Config.WAVE.HP_MULT_FUNC(year);
        this.hp = this.maxHP;
        this.speed = Config.ENEMY.BASE_SPEED * Config.WAVE.SPEED_MULT_FUNC(year);
        
        // Spawn at random edge
        const angle = Math.random() * Math.PI * 2;
        const radius = Config.WORLD.SIZE / 2;
        this.spawnPos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        
        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();
        this.group.position.copy(this.spawnPos);
        
        // Vortex Layers: Multiple rotating planes with typhoon texture
        const typhoonTex = this.assets.get('typhoon');
        const layers = 6;
        this.vortexLayers = [];
        
        for (let i = 0; i < layers; i++) {
            const size = 1.5 + i * 0.4;
            const geom = new THREE.PlaneGeometry(size, size);
            const mat = new THREE.MeshBasicMaterial({
                map: typhoonTex,
                transparent: true,
                opacity: 0.7 - (i * 0.1),
                depthWrite: false,
                side: THREE.DoubleSide,
                color: 0x88ccff
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = 0.2 + (i * 0.15);
            
            const layerData = {
                mesh,
                rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3)
            };
            
            this.vortexLayers.push(layerData);
            this.group.add(mesh);
        }

        // Central glowing core
        const coreGeom = new THREE.SphereGeometry(0.3, 8, 8);
        const coreMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 2 
        });
        this.core = new THREE.Mesh(coreGeom, coreMat);
        this.core.position.y = 0.5;
        this.group.add(this.core);

        // Point light for illumination
        this.light = new THREE.PointLight(0x00ffff, 1, 5);
        this.light.position.y = 1;
        this.group.add(this.light);

        this.scene.add(this.group);
        this.createHealthBar();
    }

    createHealthBar() {
        const barGeom = new THREE.PlaneGeometry(1.5, 0.15);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.8 });
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
        if (!this.alive) return false;

        // Move towards center
        const dir = new THREE.Vector3(0, 0, 0).sub(this.group.position).normalize();
        this.group.position.addScaledVector(dir, this.speed * dt);
        
        // Vortex animation
        this.vortexLayers.forEach(layer => {
            layer.mesh.rotation.z += layer.rotationSpeed * dt;
        });
        this.core.rotation.y += dt * 5;

        // Billboard health bar (Addressing Gemini Feedback)
        if (camera) {
            this.healthBg.quaternion.copy(camera.quaternion);
            this.healthFg.quaternion.copy(camera.quaternion);
        }

        // Reached center check
        if (this.group.position.length() < 0.5) {
            this.die(false);
            return true;
        }
        return false;
    }

    takeDamage(amount) {
        this.hp -= amount;
        const ratio = Math.max(0, this.hp / this.maxHP);
        
        // Correct positioning (Addressing Gemini Feedback)
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
            this.effects.spawnBurst(this.group.position, 0x00ffff, 25);
        }
        
        this.scene.remove(this.group);
        this.dispose();
    }

    dispose() {
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
