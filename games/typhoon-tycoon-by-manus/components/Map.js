import * as THREE from 'three';
import { GameConfig } from './GameConfig.js';

export class Map {
    constructor(scene) {
        this.scene = scene;
        this.path = GameConfig.map.path.map(p => new THREE.Vector3(p.x, 0, p.z));
        this.createGround();
        this.createPath();
    }

    createGround() {
        // Ground with high-quality material
        const geometry = new THREE.PlaneGeometry(GameConfig.map.width, GameConfig.map.height);
        const material = new THREE.MeshStandardMaterial({ 
            color: GameConfig.map.groundColor,
            roughness: 0.8,
            metalness: 0.1
        });
        this.ground = new THREE.Mesh(geometry, material);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Add a futuristic grid
        const grid = new THREE.GridHelper(GameConfig.map.width, 40, 0x00ffcc, 0x00ffcc);
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        grid.position.y = 0.2;
        this.scene.add(grid);
        
        // Add outer "Sea" area
        const seaGeom = new THREE.PlaneGeometry(GameConfig.map.width * 2, GameConfig.map.height * 2);
        const seaMat = new THREE.MeshStandardMaterial({ color: GameConfig.map.seaColor });
        const sea = new THREE.Mesh(seaGeom, seaMat);
        sea.rotation.x = -Math.PI / 2;
        sea.position.y = -2;
        this.scene.add(sea);
    }

    createPath() {
        // Path line (Glow effect)
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(this.path);
        const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 5 });
        const pathLine = new THREE.Line(pathGeometry, pathMaterial);
        pathLine.position.y = 0.5;
        this.scene.add(pathLine);

        // Path segments (Visual road)
        for (let i = 0; i < this.path.length - 1; i++) {
            const start = this.path[i];
            const end = this.path[i+1];
            const direction = end.clone().sub(start);
            const length = direction.length();
            const geometry = new THREE.PlaneGeometry(GameConfig.map.pathWidth, length);
            const material = new THREE.MeshStandardMaterial({ 
                color: 0x111111, 
                roughness: 0.5,
                metalness: 0.5
            });
            const segment = new THREE.Mesh(geometry, material);
            
            const center = start.clone().add(direction.clone().multiplyScalar(0.5));
            segment.position.set(center.x, 0.1, center.z);
            segment.rotation.x = -Math.PI / 2;
            segment.rotation.z = -Math.atan2(direction.x, direction.z);
            segment.receiveShadow = true;
            this.scene.add(segment);
        }
    }

    isValidTowerPlacement(x, z) {
        const point = new THREE.Vector3(x, 0, z);
        for (let i = 0; i < this.path.length - 1; i++) {
            const start = this.path[i];
            const end = this.path[i+1];
            const dist = this.pointToSegmentDistance(point, start, end);
            if (dist < GameConfig.map.pathWidth) return false;
        }
        return Math.abs(x) < GameConfig.map.width / 2 && Math.abs(z) < GameConfig.map.height / 2;
    }

    pointToSegmentDistance(p, a, b) {
        const ab = b.clone().sub(a);
        const ap = p.clone().sub(a);
        const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
        const projection = a.clone().add(ab.multiplyScalar(t));
        return p.distanceTo(projection);
    }
}
