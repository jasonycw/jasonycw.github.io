import * as THREE from 'three';

const burstGeom = new THREE.SphereGeometry(1, 4, 4);
const _tempVec = new THREE.Vector3();

export class VisualEffects {
    constructor(scene) {
        this.scene = scene;
        this.effects = [];
    }

    spawnBurst(x, y, z, color, count = 8) {
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ 
                color, 
                transparent: true, 
                opacity: 1 
            });
            const mesh = new THREE.Mesh(burstGeom, mat);
            mesh.scale.setScalar(0.2 + Math.random() * 0.3);
            mesh.position.set(x, y, z);
            this.scene.add(mesh);

            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            
            this.effects.push({
                mesh,
                mat,
                life: 0.5,
                maxLife: 0.5,
                vx: Math.cos(angle) * speed,
                vy: 2 + Math.random() * 2,
                vz: Math.sin(angle) * speed,
                gravity: -9.8
            });
        }
    }

    update(deltaTime) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life -= deltaTime;

            if (effect.life <= 0) {
                this.scene.remove(effect.mesh);
                effect.mat.dispose();
                this.effects.splice(i, 1);
                continue;
            }

            effect.vy += effect.gravity * deltaTime;
            effect.mesh.position.x += effect.vx * deltaTime * 10;
            effect.mesh.position.y += effect.vy * deltaTime * 10;
            effect.mesh.position.z += effect.vz * deltaTime * 10;
            
            effect.mat.opacity = effect.life / effect.maxLife;
            effect.mesh.scale.multiplyScalar(0.95);
        }
    }
    
    clear() {
        for (const effect of this.effects) {
            this.scene.remove(effect.mesh);
            effect.mat.dispose();
        }
        this.effects = [];
    }
}
