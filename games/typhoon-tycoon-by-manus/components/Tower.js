import * as THREE from 'three';

const _direction = new THREE.Vector3(); 
const _firePos = new THREE.Vector3(); 

export class Projectile {
    constructor(scene, startPos, target, damage, speed, color) {
        this.scene = scene;
        this.target = target;
        this.damage = damage;
        this.speed = speed;
        this.alive = true;

        const geometry = new THREE.SphereGeometry(2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPos);
        
        // Add glow to projectile
        this.light = new THREE.PointLight(color, 1, 20);
        this.mesh.add(this.light);
        
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.alive) return;

        if (!this.target || !this.target.isAlive()) {
            this.die();
            return;
        }

        const targetPos = this.target.getPosition();
        _direction.subVectors(targetPos, this.mesh.position).normalize();
        const moveDistance = this.speed * deltaTime;

        const distSq = this.mesh.position.distanceToSquared(targetPos);
        if (distSq < moveDistance * moveDistance) {
            this.target.takeDamage(this.damage);
            this.die();
        } else {
            this.mesh.position.addScaledVector(_direction, moveDistance);
        }
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.scene.remove(this.mesh);
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
    }

    isAlive() {
        return this.alive;
    }
}

export class Tower {
    constructor(scene, position, type, config) {
        this.scene = scene;
        this.position = position;
        this.type = type;
        this.config = config;
        
        this.lastFireTime = 0;
        this.rangeSq = this.config.range * this.config.range;

        this.createMesh();
    }

    createMesh() {
        const group = new THREE.Group();
        
        // Base
        const baseGeom = new THREE.BoxGeometry(16, 8, 16);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
        const base = new THREE.Mesh(baseGeom, baseMat);
        base.position.y = 4;
        group.add(base);

        // Turret / Head
        let turretGeom;
        if (this.type === 'PowerPlant') {
            turretGeom = new THREE.CylinderGeometry(6, 6, 20, 16);
        } else {
            turretGeom = new THREE.OctahedronGeometry(6);
        }
        
        const turretMat = new THREE.MeshStandardMaterial({ 
            color: this.config.color, 
            emissive: this.config.color,
            emissiveIntensity: 0.5
        });
        this.turret = new THREE.Mesh(turretGeom, turretMat);
        this.turret.position.y = 15;
        group.add(this.turret);

        this.mesh = group;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Range indicator
        if (this.type !== 'PowerPlant') {
            const rangeGeom = new THREE.RingGeometry(this.config.range - 1, this.config.range, 64);
            const rangeMat = new THREE.MeshBasicMaterial({ color: this.config.color, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
            this.rangeIndicator = new THREE.Mesh(rangeGeom, rangeMat);
            this.rangeIndicator.rotation.x = Math.PI / 2;
            this.rangeIndicator.position.y = 0.5;
            this.mesh.add(this.rangeIndicator);
        }
    }

    update(deltaTime, enemies, currentTime, hasPower) {
        if (this.type === 'PowerPlant') {
            this.turret.rotation.y += deltaTime * 2;
            return null;
        }

        this.turret.rotation.y += deltaTime * 1;

        if (!hasPower) return null;

        if (currentTime - this.lastFireTime > 1000 / this.config.attackSpeed) {
            const target = this.findTarget(enemies);
            if (target) {
                _firePos.set(this.position.x, 15, this.position.z);
                this.lastFireTime = currentTime;
                return new Projectile(
                    this.scene,
                    _firePos,
                    target,
                    this.config.damage,
                    this.config.projectileSpeed || 100,
                    this.config.color
                );
            }
        }
        return null;
    }

    findTarget(enemies) {
        let closestEnemy = null;
        let minDistanceSq = this.rangeSq;

        for (const enemy of enemies) {
            if (enemy.isAlive()) {
                const distSq = this.mesh.position.distanceToSquared(enemy.getPosition());
                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestEnemy = enemy;
                }
            }
        }

        return closestEnemy;
    }

    remove() {
        this.scene.remove(this.mesh);
        this.mesh.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    }
}
