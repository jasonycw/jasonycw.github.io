import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * Typhoon enemy rendered as layered cloud and rain-band sprites.
 * The storm stays readable in a 2.5D camera without relying on torus-knot geometry.
 * LLM-Model: deepseek-v4-flash-free
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
        this.baseSpeed = Config.ENEMY.BASE_SPEED * Config.WAVE.SPEED_MULT_FUNC(year);
        this.speed = this.baseSpeed;
        this.slowTimer = 0;
        this.slowFactor = 1;

        const angle = Math.random() * Math.PI * 2;
        const radius = Config.WORLD.SIZE / 1.5;
        this.spawnPos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();
        this.group.position.copy(this.spawnPos);
        this.group.scale.setScalar(1.18);
        this.cloudLayers = [];
        this.createStormLayers();
        this.createHealthBar();
        this.scene.add(this.group);
    }

    createStormLayers() {
        const texture = new THREE.CanvasTexture(this.createStormCanvas());
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;

        const outerMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.86,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending
        });
        const outer = new THREE.Sprite(outerMaterial);
        outer.position.y = 2.05;
        outer.scale.set(9.4, 6.0, 1);
        this.group.add(outer);
        this.cloudLayers.push({ sprite: outer, speed: 0.045 });

        const coreMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.54,
            depthWrite: false,
            depthTest: true,
            blending: THREE.NormalBlending
        });
        const core = new THREE.Sprite(coreMaterial);
        core.position.set(0, 2.18, 0.02);
        core.scale.set(5.4, 3.45, 1);
        this.group.add(core);
        this.cloudLayers.push({ sprite: core, speed: -0.075 });

        const underbelly = new THREE.Mesh(
            new THREE.CircleGeometry(2.2, 48),
            new THREE.MeshBasicMaterial({
                color: 0x10283e,
                transparent: true,
                opacity: 0.34,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        underbelly.rotation.x = -Math.PI / 2;
        underbelly.position.y = 0.16;
        underbelly.scale.set(1.4, 0.72, 1);
        this.group.add(underbelly);

        this.light = new THREE.PointLight(0x76c9e8, 0.65, 8);
        this.light.position.y = 1.25;
        this.group.add(this.light);
    }

    createStormCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 320;
        const context = canvas.getContext('2d');
        const centerX = 256;
        const centerY = 160;

        const cloudGradient = context.createRadialGradient(centerX, centerY, 10, centerX, centerY, 235);
        cloudGradient.addColorStop(0, 'rgba(5, 14, 25, 0.98)');
        cloudGradient.addColorStop(0.22, 'rgba(13, 32, 50, 0.97)');
        cloudGradient.addColorStop(0.58, 'rgba(36, 67, 91, 0.83)');
        cloudGradient.addColorStop(0.82, 'rgba(66, 100, 123, 0.38)');
        cloudGradient.addColorStop(1, 'rgba(66, 100, 123, 0)');
        context.fillStyle = cloudGradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Uneven cloud-wall puffs create the ragged structure of a real storm canopy.
        for (let index = 0; index < 26; index += 1) {
            const angle = index / 26 * Math.PI * 2;
            const radius = 114 + Math.sin(index * 7.4) * 22;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius * 0.5;
            const blob = context.createRadialGradient(x, y, 2, x, y, 44 + (index % 4) * 7);
            blob.addColorStop(0, 'rgba(92, 128, 148, 0.42)');
            blob.addColorStop(0.7, 'rgba(48, 82, 105, 0.28)');
            blob.addColorStop(1, 'rgba(32, 58, 78, 0)');
            context.fillStyle = blob;
            context.beginPath();
            context.ellipse(x, y, 52 + (index % 3) * 8, 24 + (index % 4) * 5, angle, 0, Math.PI * 2);
            context.fill();
        }

        context.save();
        context.translate(centerX, centerY);
        context.scale(1, 0.56);
        context.lineCap = 'round';
        context.shadowBlur = 12;
        for (let arm = 0; arm < 6; arm += 1) {
            context.beginPath();
            for (let step = 0; step <= 80; step += 1) {
                const progress = step / 80;
                const angle = arm * (Math.PI * 2 / 6) + progress * Math.PI * 1.32;
                const radius = 25 + progress * 190;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (step === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            }
            context.strokeStyle = arm % 2 === 0 ? 'rgba(163, 199, 216, 0.42)' : 'rgba(87, 137, 164, 0.48)';
            context.shadowColor = 'rgba(135, 197, 224, 0.32)';
            context.lineWidth = arm % 2 === 0 ? 13 : 19;
            context.stroke();
        }
        context.restore();

        const eye = context.createRadialGradient(centerX, centerY, 4, centerX, centerY, 52);
        eye.addColorStop(0, 'rgba(1, 5, 10, 1)');
        eye.addColorStop(0.44, 'rgba(4, 14, 24, 0.98)');
        eye.addColorStop(0.72, 'rgba(31, 71, 92, 0.6)');
        eye.addColorStop(1, 'rgba(48, 88, 108, 0)');
        context.fillStyle = eye;
        context.beginPath();
        context.ellipse(centerX, centerY, 50, 27, 0, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = 'rgba(205, 239, 246, 0.72)';
        context.lineWidth = 3;
        context.beginPath();
        context.ellipse(centerX, centerY, 43, 23, 0, 0, Math.PI * 2);
        context.stroke();
        return canvas;
    }

    createHealthBar() {
        const barGeometry = new THREE.PlaneGeometry(2.5, 0.16);
        const backgroundMaterial = new THREE.MeshBasicMaterial({
            color: 0x02070d,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        this.healthBg = new THREE.Mesh(barGeometry, backgroundMaterial);
        this.healthBg.position.y = 4.05;
        this.group.add(this.healthBg);

        const foregroundMaterial = new THREE.MeshBasicMaterial({ color: 0xff4968, side: THREE.DoubleSide });
        this.healthFg = new THREE.Mesh(barGeometry.clone(), foregroundMaterial);
        this.healthFg.position.set(0, 4.05, 0.01);
        this.group.add(this.healthFg);
    }

    update(dt, camera) {
        if (!this.alive) return false;
        if (this.slowTimer > 0) this.slowTimer -= dt;
        else this.slowFactor = 1;
        this.speed = this.baseSpeed * this.slowFactor;

        const toCenter = new THREE.Vector3(-this.group.position.x, 0, -this.group.position.z);
        const distance = toCenter.length();
        const direction = toCenter.normalize();
        const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
        const movement = direction.addScaledVector(tangent, 0.2).normalize();
        this.group.position.addScaledVector(movement, this.speed * dt);

        this.cloudLayers.forEach(layer => {
            layer.sprite.material.rotation += layer.speed * dt;
        });
        this.group.rotation.y += dt * 0.08;

        if (camera) {
            this.healthBg.quaternion.copy(camera.quaternion);
            this.healthFg.quaternion.copy(camera.quaternion);
        }
        if (distance < 1.0) {
            this.die(false);
            return true;
        }
        return false;
    }

    applySlow(factor = 0.5, duration = 2.0) {
        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    takeDamage(amount) {
        this.hp -= amount;
        const ratio = Math.max(0, this.hp / this.maxHP);
        this.healthFg.scale.x = ratio;
        this.healthFg.position.x = (ratio - 1) * 1.25;
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
        if (killed) this.effects.spawnBurst(this.group.position, 0x86e7ff, 40);
        this.scene.remove(this.group);
        this.dispose();
    }

    dispose() {
        this.group.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => {
                    if (material.map) material.map.dispose();
                    material.dispose();
                });
            }
        });
    }

    getPosition() {
        return this.group.position;
    }
}
