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

        const geometry = new THREE.SphereGeometry(1.5, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPos);
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
        
        const baseGeom = new THREE.CylinderGeometry(8, 10, 5, 8);
        const baseMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
        const base = new THREE.Mesh(baseGeom, baseMat);
        base.position.y = 2.5;
        group.add(base);

        const turretGeom = new THREE.ConeGeometry(6, 12, 8);
        const turretMat = new THREE.MeshPhongMaterial({ color: this.config.color });
        this.turret = new THREE.Mesh(turretGeom, turretMat);
        this.turret.position.y = 10;
        group.add(this.turret);

        this.mesh = group;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        const rangeGeom = new THREE.RingGeometry(this.config.range - 1, this.config.range, 32);
        const rangeMat = new THREE.MeshBasicMaterial({ color: 0x00FF00, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
        this.rangeIndicator = new THREE.Mesh(rangeGeom, rangeMat);
        this.rangeIndicator.rotation.x = Math.PI / 2;
        this.rangeIndicator.position.y = 0.5;
        this.mesh.add(this.rangeIndicator);
    }

    // Gemini Feedback: Return a single projectile instead of an array to reduce allocations
    update(deltaTime, enemies, currentTime) {
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
