import * as THREE from 'three';

/**
 * Visual Effects System (particles, lasers, and hazard rings).
 * LLM-Model: deepseek-v4-flash-free
 */
export class Effects {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.beams = [];
        this.rings = [];
        this.particleGeom = new THREE.SphereGeometry(0.1, 4, 4);
    }

    spawnBurst(position, color, count = 15) {
        for (let i = 0; i < count; i++) {
            const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
            const mesh = new THREE.Mesh(this.particleGeom, material);
            mesh.position.copy(position);
            this.scene.add(mesh);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                Math.random() * 0.4,
                (Math.random() - 0.5) * 0.4
            );
            this.particles.push({ mesh, material, velocity, life: 1.0 });
        }
    }

    spawnLaser(start, end, color) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.beams.push({ line, material, life: 0.15 });
    }

    spawnQuake(position) {
        const geometry = new THREE.RingGeometry(0.4, 0.56, 48);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffd166,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(position.x, 0.06, position.z);
        this.scene.add(ring);
        this.rings.push({ ring, material, life: 1.2, maxScale: 7 });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.life -= dt;
            if (particle.life <= 0) {
                this.scene.remove(particle.mesh);
                particle.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            particle.mesh.position.addScaledVector(particle.velocity, dt * 60);
            particle.velocity.y -= 0.015;
            particle.material.opacity = particle.life;
            particle.mesh.scale.setScalar(particle.life);
        }

        for (let i = this.beams.length - 1; i >= 0; i--) {
            const beam = this.beams[i];
            beam.life -= dt;
            if (beam.life <= 0) {
                this.scene.remove(beam.line);
                beam.material.dispose();
                beam.line.geometry.dispose();
                this.beams.splice(i, 1);
                continue;
            }
            beam.material.opacity = beam.life * 6;
        }

        for (let i = this.rings.length - 1; i >= 0; i--) {
            const quake = this.rings[i];
            quake.life -= dt;
            if (quake.life <= 0) {
                this.scene.remove(quake.ring);
                quake.material.dispose();
                quake.ring.geometry.dispose();
                this.rings.splice(i, 1);
                continue;
            }
            const progress = 1 - quake.life / 1.2;
            quake.ring.scale.setScalar(1 + progress * quake.maxScale);
            quake.material.opacity = quake.life / 1.2;
        }
    }

    clear() {
        this.particles.forEach(particle => {
            this.scene.remove(particle.mesh);
            particle.material.dispose();
        });
        this.beams.forEach(beam => {
            this.scene.remove(beam.line);
            beam.material.dispose();
            beam.line.geometry.dispose();
        });
        this.rings.forEach(quake => {
            this.scene.remove(quake.ring);
            quake.material.dispose();
            quake.ring.geometry.dispose();
        });
        this.particles = [];
        this.beams = [];
        this.rings = [];
    }
}
