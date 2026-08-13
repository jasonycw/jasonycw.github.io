import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * World Map with Terrain Classification
 * Addressing: Clean declarations, Procedural scenery
 * LLM-Model: gpt-4.1-mini
 */
export class Map {
    constructor(scene, assets) {
        this.scene = scene;
        this.assets = assets;
        this.grid = [];
        this.isReady = false;
        
        this.createWorld();
    }

    createWorld() {
        // Map Plane
        const mapTex = this.assets.get('map');
        const mapGeom = new THREE.PlaneGeometry(Config.WORLD.SIZE, Config.WORLD.SIZE);
        const mapMat = new THREE.MeshStandardMaterial({ 
            map: mapTex,
            roughness: 0.85,
            metalness: 0.05
        });
        this.mapMesh = new THREE.Mesh(mapGeom, mapMat);
        this.mapMesh.rotation.x = -Math.PI / 2;
        this.mapMesh.receiveShadow = true;
        this.scene.add(this.mapMesh);

        // Grid classification using hitarea
        this.initializeGrid();
    }

    initializeGrid() {
        const hitareaTex = this.assets.get('hitarea');
        const img = hitareaTex.image;
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        const size = Config.WORLD.GRID_SIZE;
        const half = Math.floor(size / 2);
        const cellS = Config.WORLD.CELL_SIZE;

        for (let x = -half; x <= half; x++) {
            for (let z = -half; z <= half; z++) {
                const wx = x * cellS;
                const wz = z * cellS;
                
                // Map world to UV
                const uvx = (wx + Config.WORLD.SIZE / 2) / Config.WORLD.SIZE;
                const uvy = (wz + Config.WORLD.SIZE / 2) / Config.WORLD.SIZE;
                
                let isLand = false;
                if (uvx >= 0 && uvx <= 1 && uvy >= 0 && uvy <= 1) {
                    const px = Math.floor(uvx * img.width);
                    const py = Math.floor((1 - uvy) * img.height);
                    const idx = (py * img.width + px) * 4;
                    isLand = imageData[idx] > 128; // Red channel check
                }

                this.grid.push({ x, z, wx, wz, isLand, occupied: null });
            }
        }
        
        this.createScenery();
        this.createSeaFoam();
        this.isReady = true;
    }

    createSeaFoam() {
        this.foams = [];
        const foamGeom = new THREE.PlaneGeometry(2, 2);
        const foamMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
            depthWrite: false
        });

        for (let i = 0; i < 50; i++) {
            const foam = new THREE.Mesh(foamGeom, foamMat);
            const x = (Math.random() - 0.5) * Config.WORLD.SIZE;
            const z = (Math.random() - 0.5) * Config.WORLD.SIZE;
            foam.position.set(x, 0.02, z);
            foam.rotation.x = -Math.PI / 2;
            foam.scale.setScalar(0.5 + Math.random());
            this.scene.add(foam);
            this.foams.push({
                mesh: foam,
                speed: 0.5 + Math.random(),
                offset: Math.random() * Math.PI * 2
            });
        }
    }

    update(dt, time) {
        if (!this.foams) return;
        this.foams.forEach(f => {
            f.mesh.position.x += f.speed * dt * 0.2;
            if (f.mesh.position.x > Config.WORLD.SIZE / 2) f.mesh.position.x = -Config.WORLD.SIZE / 2;
            f.mesh.material.opacity = 0.1 + Math.sin(time * 0.002 + f.offset) * 0.1;
        });
    }

    createScenery() {
        const treeGeom = new THREE.ConeGeometry(0.15, 0.4, 6);
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20 });
        const trunkGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.15);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });

        const buildingGeom = new THREE.BoxGeometry(0.3, 0.6, 0.3);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x455a64 });

        this.grid.forEach(cell => {
            if (cell.isLand && Math.random() > 0.65) {
                const count = Math.floor(Math.random() * 2) + 1;
                for (let i = 0; i < count; i++) {
                    const ox = (Math.random() - 0.5) * 1.2;
                    const oz = (Math.random() - 0.5) * 1.2;
                    
                    if (Math.random() > 0.4) {
                        const tree = new THREE.Group();
                        const leaves = new THREE.Mesh(treeGeom, treeMat);
                        leaves.position.y = 0.25;
                        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
                        trunk.position.y = 0.07;
                        tree.add(leaves);
                        tree.add(trunk);
                        tree.position.set(cell.wx + ox, 0, cell.wz + oz);
                        this.scene.add(tree);
                    } else {
                        const b = new THREE.Mesh(buildingGeom, buildingMat);
                        b.position.set(cell.wx + ox, 0.3, cell.wz + oz);
                        this.scene.add(b);
                    }
                }
            }
        });
    }

    getGridCell(wx, wz) {
        const cellS = Config.WORLD.CELL_SIZE;
        const x = Math.round(wx / cellS);
        const z = Math.round(wz / cellS);
        return this.grid.find(c => c.x === x && c.z === z);
    }

    isValidPlacement(wx, wz, type) {
        const cell = this.getGridCell(wx, wz);
        if (!cell || cell.occupied) return false;
        
        const config = Config.STRUCTURES[type];
        if (config.isLandOnly && !cell.isLand) return false;
        if (!config.isLandOnly && cell.isLand) return false;
        
        return true;
    }
}
