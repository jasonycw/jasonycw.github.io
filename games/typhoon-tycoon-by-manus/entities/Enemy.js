import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * Map-aware typhoon enemy.
 * The storm is built from layered cyclone rings, asymmetric spiral rainbands,
 * a readable eye wall, a restrained satellite texture, and animated particles.
 * LLM-Model: deepseek-v4-flash-free
 */
let sharedStormTexture = null;
const sharedCanopyGeometry = new THREE.RingGeometry(0.28, 3.35, 64);
const sharedMidCloudGeometry = new THREE.RingGeometry(0.22, 2.55, 56);
const sharedEyeWallGeometry = new THREE.RingGeometry(0.18, 0.52, 48);
const sharedInnerEyeGeometry = new THREE.RingGeometry(0.22, 0.34, 40);
const sharedTexturePlaneGeometry = new THREE.PlaneGeometry(5.6, 5.6);
const sharedWindParticleGeometry = new THREE.SphereGeometry(0.035, 5, 5);
const sharedWispParticleGeometry = new THREE.SphereGeometry(0.07, 6, 6);
const sharedRainParticleGeometry = new THREE.SphereGeometry(0.018, 4, 4);
const CITY_TARGET = new THREE.Vector3(-4, 0, -4.5);

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function angleDelta(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class Enemy {
    constructor(scene, assets, effects, year, map) {
        this.scene = scene;
        this.assets = assets;
        this.effects = effects;
        this.year = year;
        this.map = map;

        this.alive = true;
        this.maxHP = Config.ENEMY.BASE_HP * Config.WAVE.HP_MULT_FUNC(year);
        this.hp = this.maxHP;
        this.baseSpeed = Config.ENEMY.BASE_SPEED * Config.WAVE.SPEED_MULT_FUNC(year) * 0.72;
        this.speed = this.baseSpeed;
        this.slowFactor = 1;
        this.slowTimer = 0;
        this.elapsed = Math.random() * 20;
        this.turnRate = 0.18 + Math.random() * 0.14;
        this.curveSign = Math.random() > 0.5 ? 1 : -1;
        this.heading = 0;
        this.dynamicGeometries = [];
        this.dynamicMaterials = [];

        const spawn = this.findSeaSpawn();
        this.group = new THREE.Group();
        this.group.position.set(spawn.x, 1.15, spawn.z);
        this.heading = Math.atan2(CITY_TARGET.z - spawn.z, CITY_TARGET.x - spawn.x);
        this.group.userData.hitRadius = 3.3;

        this.initVisuals();
        this.createHealthBar();
        this.scene.add(this.group);
    }

    findSeaSpawn() {
        const half = Config.WORLD.SIZE / 2;
        const edge = half - Config.WORLD.CELL_SIZE * 0.5;
        const candidates = [];

        if (this.map && this.map.grid) {
            this.map.grid.forEach(cell => {
                const onEdge = Math.abs(cell.wx) >= edge || Math.abs(cell.wz) >= edge;
                if (onEdge && !cell.isLand) candidates.push({ x: cell.wx, z: cell.wz });
            });
        }

        if (candidates.length > 0) {
            const preferred = candidates.filter(point => point.x > 0 || point.z > 0);
            const pool = preferred.length > 0 ? preferred : candidates;
            return pool[Math.floor(Math.random() * pool.length)];
        }

        // Defensive fallback: select the farthest classified sea cell rather than
        // ever placing a storm directly on the city or a land cell.
        let fallback = { x: half - 1, z: half - 1 };
        let farthest = -Infinity;
        if (this.map && this.map.grid) {
            this.map.grid.forEach(cell => {
                if (cell.isLand) return;
                const distance = cell.wx * cell.wx + cell.wz * cell.wz;
                if (distance > farthest) {
                    farthest = distance;
                    fallback = { x: cell.wx, z: cell.wz };
                }
            });
        }
        return fallback;
    }

    static getStormTexture(assets) {
        if (sharedStormTexture) return sharedStormTexture;

        const assetTexture = assets?.get('typhoon');
        if (assetTexture) {
            assetTexture.colorSpace = THREE.SRGBColorSpace;
            assetTexture.anisotropy = 4;
            sharedStormTexture = assetTexture;
            return sharedStormTexture;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        const center = 256;
        const glow = context.createRadialGradient(center, center, 24, center, center, 250);
        glow.addColorStop(0, 'rgba(220, 240, 255, 0.20)');
        glow.addColorStop(0.42, 'rgba(76, 132, 186, 0.15)');
        glow.addColorStop(1, 'rgba(8, 28, 58, 0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, 512, 512);

        context.save();
        context.translate(center, center);
        context.lineCap = 'round';
        for (let arm = 0; arm < 4; arm += 1) {
            context.beginPath();
            for (let step = 0; step <= 120; step += 1) {
                const theta = step * 0.075;
                const radius = 30 + step * 1.65;
                const angle = arm * Math.PI * 0.5 + theta;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (step === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            }
            context.strokeStyle = 'rgba(214, 236, 255, 0.23)';
            context.lineWidth = 9;
            context.stroke();
        }
        context.restore();

        sharedStormTexture = new THREE.CanvasTexture(canvas);
        sharedStormTexture.colorSpace = THREE.SRGBColorSpace;
        sharedStormTexture.anisotropy = 4;
        return sharedStormTexture;
    }

    createMaterial(parameters) {
        const material = new THREE.MeshBasicMaterial(parameters);
        this.dynamicMaterials.push(material);
        return material;
    }

    addStormMesh(mesh, geometryIsDynamic = false) {
        mesh.renderOrder = 5;
        mesh.material.depthTest = false;
        mesh.material.depthWrite = false;
        this.group.add(mesh);
        if (geometryIsDynamic) this.dynamicGeometries.push(mesh.geometry);
        return mesh;
    }

    initVisuals() {
        const texture = Enemy.getStormTexture(this.assets);
        this.spiralBands = [];
        this.particles = [];

        const canopy = this.addStormMesh(new THREE.Mesh(
            sharedCanopyGeometry,
            this.createMaterial({ color: 0x8ba3b9, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
        ));
        canopy.rotation.x = -Math.PI / 2;
        canopy.position.y = -0.27;

        const midCloud = this.addStormMesh(new THREE.Mesh(
            sharedMidCloudGeometry,
            this.createMaterial({ color: 0xd4e3ee, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
        ));
        midCloud.rotation.x = -Math.PI / 2;
        midCloud.position.y = -0.08;

        const eyeWall = this.addStormMesh(new THREE.Mesh(
            sharedEyeWallGeometry,
            this.createMaterial({ color: 0xe8f3ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
        ));
        eyeWall.rotation.x = -Math.PI / 2;
        eyeWall.position.y = 0.03;
        this.eyeWall = eyeWall;
        this.eyeWallMaterial = eyeWall.material;

        const innerEye = this.addStormMesh(new THREE.Mesh(
            sharedInnerEyeGeometry,
            this.createMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
        ));
        innerEye.rotation.x = -Math.PI / 2;
        innerEye.position.y = 0.045;
        this.innerEye = innerEye;
        this.innerEyeMaterial = innerEye.material;

        // Four uneven, open spiral arms are the key readable cyclone silhouette.
        const armConfigs = [
            { start: 0.12, turns: 1.25, length: 2.95, width: 0.13, opacity: 0.40 },
            { start: 1.76, turns: 1.05, length: 2.55, width: 0.10, opacity: 0.30 },
            { start: 3.28, turns: 1.38, length: 3.15, width: 0.15, opacity: 0.36 },
            { start: 4.88, turns: 0.92, length: 2.40, width: 0.09, opacity: 0.26 }
        ];

        armConfigs.forEach(config => {
            const segments = 15;
            for (let segment = 0; segment < segments; segment += 1) {
                const progress = segment / segments;
                const radius = 0.48 + progress * config.length;
                const angle = config.start + progress * Math.PI * 2 * config.turns;
                const arc = 0.26 + progress * 0.18;
                const geometry = new THREE.TorusGeometry(radius, config.width * (1 - progress * 0.28), 5, 12, arc);
                const material = this.createMaterial({
                    color: 0xf4f9ff,
                    transparent: true,
                    opacity: config.opacity * (1 - progress * 0.28),
                    side: THREE.DoubleSide
                });
                const mesh = this.addStormMesh(new THREE.Mesh(geometry, material), true);
                mesh.rotation.x = Math.PI / 2;
                mesh.rotation.z = angle;
                mesh.position.set(Math.cos(angle) * radius, -0.08 + progress * 0.06, Math.sin(angle) * radius);
                mesh.userData.baseOpacity = material.opacity;
                this.spiralBands.push(mesh);
            }
        });

        const texturePlane = this.addStormMesh(new THREE.Mesh(
            sharedTexturePlaneGeometry,
            this.createMaterial({
                map: texture,
                color: 0x9ec5e6,
                transparent: true,
                opacity: 0.18,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            })
        ));
        texturePlane.rotation.x = -Math.PI / 2;
        texturePlane.position.y = 0.075;

        for (let index = 0; index < 28; index += 1) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.45 + Math.random() * 2.7;
            const particleType = index < 14 ? 'wind' : index < 22 ? 'wisp' : 'rain';
            const geometry = particleType === 'wind'
                ? sharedWindParticleGeometry
                : particleType === 'wisp' ? sharedWispParticleGeometry : sharedRainParticleGeometry;
            const material = this.createMaterial({
                color: particleType === 'rain' ? 0x9bc9ef : 0xf2f8ff,
                transparent: true,
                opacity: particleType === 'rain' ? 0.28 : 0.18 + Math.random() * 0.18
            });
            const mesh = this.addStormMesh(new THREE.Mesh(geometry, material));
            mesh.scale.setScalar(0.7 + Math.random() * 1.4);
            mesh.position.set(Math.cos(angle) * radius, particleType === 'rain' ? -0.38 : (Math.random() - 0.5) * 0.3, Math.sin(angle) * radius);
            this.particles.push({
                mesh,
                type: particleType,
                angle,
                radius,
                speed: particleType === 'rain' ? 1.8 + Math.random() * 1.0 : 0.5 + Math.random() * 1.2,
                phase: Math.random() * Math.PI * 2
            });
        }

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(3.7, 48),
            this.createMaterial({ color: 0x06111d, transparent: true, opacity: 0.48, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.56;
        shadow.renderOrder = 4;
        this.group.add(shadow);
        this.dynamicGeometries.push(shadow.geometry);
    }

    createHealthBar() {
        const barGeometry = new THREE.PlaneGeometry(3.0, 0.24);
        const bgMaterial = this.createMaterial({ color: 0x07121e, transparent: true, opacity: 0.82, depthTest: false, depthWrite: false });
        const fgMaterial = this.createMaterial({ color: 0x61d6ff, depthTest: false, depthWrite: false });
        this.healthBg = new THREE.Mesh(barGeometry, bgMaterial);
        this.healthFg = new THREE.Mesh(barGeometry, fgMaterial);
        this.healthBg.position.y = 5.7;
        this.healthFg.position.y = 5.7;
        this.healthFg.position.z = 0.03;
        this.healthBg.renderOrder = 12;
        this.healthFg.renderOrder = 13;
        this.group.add(this.healthBg, this.healthFg);
        this.healthGeometry = barGeometry;
    }

    update(dt, camera) {
        if (!this.alive) return false;
        this.elapsed += dt;

        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            this.speed = this.baseSpeed * this.slowFactor;
        } else {
            this.speed = this.baseSpeed;
            this.slowFactor = 1;
        }

        const position = this.group.position;
        const toTargetX = CITY_TARGET.x - position.x;
        const toTargetZ = CITY_TARGET.z - position.z;
        const distanceToCity = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ);
        const desiredHeading = Math.atan2(toTargetZ, toTargetX);
        const turn = clamp(angleDelta(this.heading, desiredHeading), -this.turnRate * dt, this.turnRate * dt);
        const curve = Math.sin(this.elapsed * 0.7 + this.curveSign) * 0.035 * dt;
        this.heading += turn + curve;

        const moveDistance = this.speed * dt;
        position.x += Math.cos(this.heading) * moveDistance;
        position.z += Math.sin(this.heading) * moveDistance;

        const cell = this.map?.getGridCell(position.x, position.z);
        const onLand = Boolean(cell?.isLand);
        if (onLand) {
            this.hp -= (10 + this.maxHP * 0.015) * dt;
        } else {
            this.hp = Math.min(this.maxHP, this.hp + this.maxHP * 0.01 * dt);
        }

        if (this.hp <= 0) {
            this.die(true);
            return false;
        }

        const ratio = clamp(this.hp / this.maxHP, 0, 1);
        this.group.scale.setScalar(0.72 + ratio * 0.42);
        this.group.userData.hitRadius = 3.3 * this.group.scale.x;
        this.healthFg.scale.x = Math.max(0.01, ratio);
        this.healthFg.position.x = (ratio - 1) * 1.5;
        this.healthFg.material.color.setHex(ratio > 0.5 ? 0x61d6ff : ratio > 0.25 ? 0xffc857 : 0xff6b6b);

        this.group.rotation.y += dt * (this.slowTimer > 0 ? 1.3 : 2.4);
        this.spiralBands.forEach((band, index) => {
            band.material.opacity = band.userData.baseOpacity * (0.55 + ratio * 0.45);
            band.rotation.z += dt * (index % 2 === 0 ? 0.18 : -0.12);
        });
        this.particles.forEach(particle => {
            const direction = particle.type === 'rain' ? 1.35 : particle.type === 'wind' ? 0.9 : 0.55;
            particle.angle += dt * particle.speed * direction;
            const wobble = particle.type === 'wisp' ? Math.sin(this.elapsed * 2 + particle.phase) * 0.08 : 0;
            const radius = particle.radius + wobble;
            particle.mesh.position.x = Math.cos(particle.angle) * radius;
            particle.mesh.position.z = Math.sin(particle.angle) * radius;
            if (particle.type === 'rain') {
                particle.mesh.position.y = -0.38 - Math.abs(Math.sin(this.elapsed * 3 + particle.phase)) * 0.28;
            }
        });
        this.eyeWallMaterial.opacity = 0.48 + ratio * 0.24;
        this.innerEyeMaterial.opacity = 0.56 + ratio * 0.24;

        if (camera) {
            this.healthBg.quaternion.copy(camera.quaternion);
            this.healthFg.quaternion.copy(camera.quaternion);
        }

        if (distanceToCity < 1.35) {
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
        if (this.hp <= 0) {
            this.die(true);
            return true;
        }
        return false;
    }

    die(killed) {
        if (!this.alive) return;
        this.alive = false;
        if (killed) this.effects.spawnBurst(this.group.position, 0x78d7ff, 40);
        this.scene.remove(this.group);
        this.dispose();
    }

    getPosition() {
        return this.group.position;
    }

    dispose() {
        this.dynamicGeometries.forEach(geometry => geometry.dispose());
        this.dynamicMaterials.forEach(material => material.dispose());
        this.dynamicGeometries = [];
        this.dynamicMaterials = [];
    }
}

export function disposeSharedEnemyResources() {
    // Shared resources intentionally live for the page lifetime because waves
    // can spawn many enemies and disposing them per enemy would break later waves.
}
