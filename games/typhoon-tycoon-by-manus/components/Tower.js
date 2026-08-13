import * as THREE from 'three';

export class Tower {
    constructor(scene, pos, type, config, effects) {
        this.scene = scene;
        this.position = pos;
        this.type = type;
        this.config = config;
        this.effects = effects;
        this.lastAttack = 0;
        
        this.createMesh();
    }

    createMesh() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);

        // Base
        const baseGeom = new THREE.CylinderGeometry(0.8, 1, 0.4, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
        const base = new THREE.Mesh(baseGeom, baseMat);
        base.position.y = 0.2;
        this.group.add(base);

        // Body
        let headGeom;
        if (this.type === 'PowerPlant') {
            headGeom = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        } else if (this.type === 'LaserTower') {
            headGeom = new THREE.CylinderGeometry(0.2, 0.4, 1, 8);
        } else if (this.type === 'FreezeTower') {
            headGeom = new THREE.OctahedronGeometry(0.5);
        } else {
            headGeom = new THREE.TorusGeometry(0.4, 0.1, 8, 16);
        }

        const headMat = new THREE.MeshStandardMaterial({ 
            color: this.config.color, 
            emissive: this.config.color,
            emissiveIntensity: 0.5
        });
        this.head = new THREE.Mesh(headGeom, headMat);
        this.head.position.y = 1;
        this.group.add(this.head);

        // Range indicator (hidden by default)
        if (this.type !== 'PowerPlant') {
            const rangeGeom = new THREE.RingGeometry(this.config.range - 0.1, this.config.range + 0.1, 64);
            const rangeMat = new THREE.MeshBasicMaterial({ color: this.config.color, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
            this.rangeRing = new THREE.Mesh(rangeGeom, rangeMat);
            this.rangeRing.rotation.x = -Math.PI / 2;
            this.rangeRing.position.y = 0.05;
            this.group.add(this.rangeRing);
        }

        this.scene.add(this.group);
    }

    update(dt, enemies, currentTime, hasPower) {
        if (this.type === 'PowerPlant') {
            this.head.rotation.y += dt * 2;
            return;
        }

        this.head.rotation.y += dt;

        if (!hasPower) return;

        if (currentTime - this.lastAttack > 1000 / this.config.attackSpeed) {
            const target = this.findTarget(enemies);
            if (target) {
                this.attack(target);
                this.lastAttack = currentTime;
            }
        }
    }

    findTarget(enemies) {
        let bestTarget = null;
        let minDistSq = this.config.range * this.config.range;

        for (const e of enemies) {
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
        
        this.effects.spawnLaser(start, end, this.config.color);
        target.takeDamage(this.config.damage);
        
        if (this.type === 'FreezeTower') {
            // Apply slow (simplified)
            target.speed *= 0.95; 
        }
    }

    remove() {
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
