import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * Realistic Typhoon Enemy
 * Shared texture for performance, volumetric cloud layers.
 * LLM-Model: deepseek-v4-flash-free
 */
let sharedStormTexture = null;

export class Enemy {
    constructor(scene, assets, effects, year) {
        this.scene = scene;
        this.assets = assets;
        this.effects = effects;
        this.year = year;

        this.alive = true;
        this.maxHP = Config.ENEMY.BASE_HP * Config.WAVE.HP_MULT_FUNC(year);
        this.hp = this.maxHP;
        this.baseSpeed = Config.ENEMY.BASE_SPEED * Config.WAVE.SPEED_MULT_FUNC(year);
        this.speed = this.baseSpeed;
        this.slowFactor = 1;
        this.slowTimer = 0;

        this.group = new THREE.Group();
        this.initVisuals();
        this.createHealthBar();

        // Spawn at random edge
        const angle = Math.random() * Math.PI * 2;
        const radius = Config.WORLD.SIZE * 0.7;
        this.group.position.set(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius);
        
        this.scene.add(this.group);
    }

    static getStormTexture() {
        if (sharedStormTexture) return sharedStormTexture;

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const cx = 256;
        const cy = 256;

        // Draw spiral rain bands
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 8; i++) {
            ctx.rotate(Math.PI / 4);
            const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, 250);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            grad.addColorStop(0.2, 'rgba(200, 230, 255, 0.7)');
            grad.addColorStop(0.6, 'rgba(100, 160, 220, 0.4)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let a = 0; a < Math.PI * 1.5; a += 0.1) {
                const r = 20 + a * 45;
                const x = Math.cos(a) * r;
                const y = Math.sin(a) * r;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(0, 250);
            ctx.fill();
        }
        ctx.restore();

        // Eye wall highlights
        const eyeWall = ctx.createRadialGradient(cx, cy, 40, cx, cy, 80);
        eyeWall.addColorStop(0, 'rgba(255, 255, 255, 0)');
        eyeWall.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        eyeWall.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = eyeWall;
        ctx.beginPath();
        ctx.arc(cx, cy, 80, 0, Math.PI * 2);
        ctx.fill();

        sharedStormTexture = new THREE.CanvasTexture(canvas);
        sharedStormTexture.colorSpace = THREE.SRGBColorSpace;
        sharedStormTexture.anisotropy = 4;
        return sharedStormTexture;
    }

    initVisuals() {
        const texture = Enemy.getStormTexture();
        this.cloudLayers = [];

        // Create volumetric effect with multiple rotating layers
        for (let i = 0; i < 6; i++) {
            const size = 8 + i * 1.5;
            const opacity = 0.9 - i * 0.12;
            const mat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(size, size, 1);
            sprite.position.y = 1.5 + i * 0.3;
            
            this.group.add(sprite);
            this.cloudLayers.push({
                sprite,
                rotationSpeed: (0.8 + Math.random() * 0.4) * (i % 2 === 0 ? 1 : -0.7)
            });
        }

        // Add a core "eye wall" mesh for more 3D feel
        const eyeWallGeom = new THREE.CylinderGeometry(1.2, 3.2, 3.0, 24, 1, true);
        const eyeWallMat = new THREE.MeshStandardMaterial({
            color: 0x99ccff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            emissive: 0x336699,
            emissiveIntensity: 0.5
        });
        const eyeWall = new THREE.Mesh(eyeWallGeom, eyeWallMat);
        eyeWall.position.y = 1.5;
        this.group.add(eyeWall);
        this.eyeWall = eyeWall;

        // Ground shadow/darkening
        const shadowGeom = new THREE.CircleGeometry(4, 32);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
        });
        const shadow = new THREE.Mesh(shadowGeom, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.05;
        this.group.add(shadow);
    }

    createHealthBar() {
        const barGeom = new THREE.PlaneGeometry(3, 0.25);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 });
        const fgMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });

        this.healthBg = new THREE.Mesh(barGeom, bgMat);
        this.healthFg = new THREE.Mesh(barGeom, fgMat);

        this.healthBg.position.y = 6;
        this.healthFg.position.y = 6;
        this.healthFg.position.z = 0.02;

        this.group.add(this.healthBg);
        this.group.add(this.healthFg);
    }

    update(dt, camera) {
        if (!this.alive) return false;

        // Slow effect
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            this.speed = this.baseSpeed * this.slowFactor;
        } else {
            this.speed = this.baseSpeed;
        }

        // Move towards center with a slight spiral
        const pos = this.group.position;
        const toCenter = new THREE.Vector3(-pos.x, 0, -pos.z);
        const dist = toCenter.length();
        const dir = toCenter.normalize();
        
        // Spiral component
        const tangent = new THREE.Vector3(-dir.z, 0, dir.x);
        const moveDir = dir.clone().addScaledVector(tangent, 0.25).normalize();
        
        this.group.position.addScaledVector(moveDir, this.speed * dt);

        // Rotate cloud layers
        this.cloudLayers.forEach(layer => {
            layer.sprite.material.rotation += layer.rotationSpeed * dt;
        });
        if (this.eyeWall) this.eyeWall.rotation.y += dt * 1.5;

        // Billboard health bar
        if (camera) {
            this.healthBg.quaternion.copy(camera.quaternion);
            this.healthFg.quaternion.copy(camera.quaternion);
        }

        // Check if reached center
        if (dist < 1.2) {
            this.die(false);
            return true;
        }
        return false;
    }

    applySlow(factor, duration) {
        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    takeDamage(amount) {
        this.hp -= amount;
        const ratio = Math.max(0, this.hp / this.maxHP);
        this.healthFg.scale.x = ratio;
        this.healthFg.position.x = (ratio - 1) * 1.5;

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
            this.effects.spawnBurst(this.group.position, 0x88ccff, 40);
        }
        this.scene.remove(this.group);
        this.dispose();
    }

    getPosition() {
        return this.group.position;
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
}
