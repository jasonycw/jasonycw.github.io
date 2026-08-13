import * as THREE from 'three';

export class VisualEffects {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.beams = [];
    }

    spawnBurst(pos, color, count = 20) {
        const geom = new THREE.SphereGeometry(0.1, 4, 4);
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(pos);
            this.scene.add(mesh);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 0.5
            );

            this.particles.push({
                mesh, mat, velocity, life: 1.0
            });
        }
    }

    spawnLaser(start, end, color) {
        const points = [start, end];
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, linewidth: 2 });
        const line = new THREE.Line(geom, mat);
        this.scene.add(line);
        
        this.beams.push({
            line, mat, life: 0.2
        });
    }

    update(dt) {
        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mat.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            p.mesh.position.add(p.velocity);
            p.velocity.y -= 0.01; // Gravity
            p.mat.opacity = p.life;
            p.mesh.scale.setScalar(p.life);
        }

        // Update Beams
        for (let i = this.beams.length - 1; i >= 0; i--) {
            const b = this.beams[i];
            b.life -= dt;
            if (b.life <= 0) {
                this.scene.remove(b.line);
                b.mat.dispose();
                this.beams.splice(i, 1);
                continue;
            }
            b.mat.opacity = b.life * 5;
        }
    }

    clear() {
        this.particles.forEach(p => { this.scene.remove(p.mesh); p.mat.dispose(); });
        this.beams.forEach(b => { this.scene.remove(b.line); b.mat.dispose(); });
        this.particles = [];
        this.beams = [];
    }
}
