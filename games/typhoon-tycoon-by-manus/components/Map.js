import * as THREE from 'three';
import { GameConfig } from './GameConfig.js';

export class Map {
    constructor(scene) {
        this.scene = scene;
        this.grid = [];
        this.isReady = false;
        
        this.createWorld();
    }

    async createWorld() {
        const textureLoader = new THREE.TextureLoader();
        
        // Map Plane
        const mapTexture = await textureLoader.loadAsync('assets/map.png');
        const mapGeom = new THREE.PlaneGeometry(GameConfig.world.mapSize, GameConfig.world.mapSize);
        const mapMat = new THREE.MeshStandardMaterial({ 
            map: mapTexture,
            roughness: 0.8,
            metalness: 0.1
        });
        this.mapMesh = new THREE.Mesh(mapGeom, mapMat);
        this.mapMesh.rotation.x = -Math.PI / 2;
        this.mapMesh.receiveShadow = true;
        this.scene.add(this.mapMesh);

        // Danger Zone Rings
        const rings = [5, 10, 15];
        rings.forEach(r => {
            const ringGeom = new THREE.RingGeometry(r - 0.05, r + 0.05, 64);
            const ringMat = new THREE.MeshBasicMaterial({ 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0.1,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.01;
            this.scene.add(ring);
        });

        // Initialize Grid and Hitarea
        await this.initializeGrid();
        this.createScenery();
    }

    createScenery() {
        const treeGeom = new THREE.ConeGeometry(0.2, 0.5, 8);
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
        const trunkGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.2);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });

        const buildingGeom = new THREE.BoxGeometry(0.4, 0.8, 0.4);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x78909c });

        // Randomly place trees and buildings on land
        this.grid.forEach(cell => {
            if (cell.isLand && Math.random() > 0.6) {
                const count = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < count; i++) {
                    const ox = (Math.random() - 0.5) * 1.5;
                    const oz = (Math.random() - 0.5) * 1.5;
                    
                    if (Math.random() > 0.3) {
                        const tree = new THREE.Group();
                        const leaves = new THREE.Mesh(treeGeom, treeMat);
                        leaves.position.y = 0.35;
                        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
                        trunk.position.y = 0.1;
                        tree.add(leaves);
                        tree.add(trunk);
                        tree.position.set(cell.wx + ox, 0, cell.wz + oz);
                        this.scene.add(tree);
                    } else {
                        const b = new THREE.Mesh(buildingGeom, buildingMat);
                        b.position.set(cell.wx + ox, 0.4, cell.wz + oz);
                        this.scene.add(b);
                    }
                }
            }
        });
    }

    async initializeGrid() {
        const hitareaImg = new Image();
        hitareaImg.src = 'assets/map-hitarea.png';
        
        await new Promise((resolve) => {
            hitareaImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = hitareaImg.width;
                canvas.height = hitareaImg.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(hitareaImg, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

                const size = GameConfig.world.gridSize;
                const half = Math.floor(size / 2);
                const cellS = GameConfig.world.cellSize;

                for (let x = -half; x <= half; x++) {
                    for (let z = -half; z <= half; z++) {
                        const wx = x * cellS;
                        const wz = z * cellS;
                        
                        // Sample hitarea
                        const uvx = (wx + GameConfig.world.mapSize / 2) / GameConfig.world.mapSize;
                        const uvy = (wz + GameConfig.world.mapSize / 2) / GameConfig.world.mapSize;
                        
                        let isLand = false;
                        if (uvx >= 0 && uvx <= 1 && uvy >= 0 && uvy <= 1) {
                            const px = Math.floor(uvx * hitareaImg.width);
                            const py = Math.floor((1 - uvy) * hitareaImg.height);
                            const idx = (py * hitareaImg.width + px) * 4;
                            isLand = imageData[idx] > 128;
                        }

                        this.grid.push({
                            x, z, wx, wz, isLand, occupied: null
                        });
                    }
                }
                this.isReady = true;
                resolve();
            };
            hitareaImg.onerror = () => {
                console.warn("Hitarea failed to load, falling back to circular island.");
                // Fallback logic
                const size = GameConfig.world.gridSize;
                const half = Math.floor(size / 2);
                for (let x = -half; x <= half; x++) {
                    for (let z = -half; z <= half; z++) {
                        const wx = x * GameConfig.world.cellSize;
                        const wz = z * GameConfig.world.cellSize;
                        const isLand = Math.sqrt(wx*wx + wz*wz) < GameConfig.world.islandRadius;
                        this.grid.push({ x, z, wx, wz, isLand, occupied: null });
                    }
                }
                this.isReady = true;
                resolve();
            };
        });
    }

    getGridCell(wx, wz) {
        const cellS = GameConfig.world.cellSize;
        const x = Math.round(wx / cellS);
        const z = Math.round(wz / cellS);
        return this.grid.find(c => c.x === x && c.z === z);
    }

    isValidPlacement(wx, wz, type) {
        const cell = this.getGridCell(wx, wz);
        if (!cell || cell.occupied) return false;
        
        const config = GameConfig.structures[type];
        if (config.isLandOnly && !cell.isLand) return false;
        if (!config.isLandOnly && cell.isLand) return false;
        
        return true;
    }
}
