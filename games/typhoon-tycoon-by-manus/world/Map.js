import * as THREE from 'three';
import { Config } from '../core/Config.js';

/**
 * World map with pixel-classified placement and non-overlapping scenery.
 * LLM-Model: deepseek-v4-flash-free
 */
export class Map {
    constructor(scene, assets) {
        this.scene = scene;
        this.assets = assets;
        this.grid = [];
        this.foams = [];
        this.isReady = false;

        this.createBase();
        this.initializeGrid();
    }

    createBase() {
        const mapTexture = this.assets.get('map');
        if (mapTexture) {
            mapTexture.colorSpace = THREE.SRGBColorSpace;
            mapTexture.anisotropy = 8;
        }

        const mapGeometry = new THREE.PlaneGeometry(Config.WORLD.SIZE, Config.WORLD.SIZE);
        const mapMaterial = new THREE.MeshStandardMaterial({
            map: mapTexture,
            color: 0xffffff,
            emissive: 0x112233,
            emissiveIntensity: 0.4,
            roughness: 0.7,
            metalness: 0.1
        });
        this.mesh = new THREE.Mesh(mapGeometry, mapMaterial);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        const waterGeometry = new THREE.PlaneGeometry(Config.WORLD.SIZE * 3, Config.WORLD.SIZE * 3);
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a2a44,
            transparent: true,
            opacity: 0.6,
            roughness: 0.1,
            metalness: 0.8
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.2;
        water.receiveShadow = true;
        this.scene.add(water);
    }

    initializeGrid() {
        const hitareaTexture = this.assets.get('hitarea');
        if (!hitareaTexture || !hitareaTexture.image) {
            console.error("Hitarea texture not loaded correctly.");
            return;
        }

        const image = hitareaTexture.image;
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

        const half = Math.floor(Config.WORLD.GRID_SIZE / 2);
        const cellSize = Config.WORLD.CELL_SIZE;

        for (let x = -half; x <= half; x += 1) {
            for (let z = -half; z <= half; z += 1) {
                const worldX = x * cellSize;
                const worldZ = z * cellSize;

                const u = (worldX + Config.WORLD.SIZE / 2) / Config.WORLD.SIZE;
                const v = (worldZ + Config.WORLD.SIZE / 2) / Config.WORLD.SIZE;

                let isLand = false;
                if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
                    const pixelX = Math.min(image.width - 1, Math.floor(u * image.width));
                    const pixelY = Math.min(image.height - 1, Math.floor((1 - v) * image.height));
                    const index = (pixelY * image.width + pixelX) * 4;
                    isLand = pixels[index] > 128;
                }

                this.grid.push({ x, z, wx: worldX, wz: worldZ, isLand, occupied: null, scenery: null });
            }
        }

        this.createScenery();
        this.createCityLandmark();
        this.createSeaFoam();
        this.isReady = true;
    }

    createScenery() {
        const treeTrunkGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 8);
        const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4d331f });
        const treeLeafGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
        const treeLeafMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
        
        const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x99aabb, roughness: 0.4 });
        const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });

        const cityPoint = new THREE.Vector2(-4, 4.5);

        this.grid.forEach(cell => {
            if (!cell.isLand) return;
            if (new THREE.Vector2(cell.wx, cell.wz).distanceTo(cityPoint) < 3.0) return;

            // Seed based on grid position for determinism
            const seed = Math.abs(Math.sin(cell.x * 12.98 + cell.z * 78.23));
            if (seed < 0.7) return;

            const group = new THREE.Group();
            group.position.set(cell.wx, 0, cell.wz);

            if (seed > 0.9) {
                // Tree
                const trunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
                trunk.position.y = 0.2;
                const leaves = new THREE.Mesh(treeLeafGeometry, treeLeafMaterial);
                leaves.position.y = 0.6;
                group.add(trunk, leaves);
            } else {
                // Building
                const h = 0.8 + seed * 2.0;
                const w = 0.6;
                const bGeom = new THREE.BoxGeometry(w, h, w);
                const bMesh = new THREE.Mesh(bGeom, buildingMaterial);
                bMesh.position.y = h / 2;
                bMesh.castShadow = true;
                group.add(bMesh);

                // Add windows
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), windowMaterial);
                win.position.set(w / 2 + 0.01, h * 0.6, 0);
                win.rotation.y = Math.PI / 2;
                bMesh.add(win);
            }

            this.scene.add(group);
            cell.scenery = group;
        });
    }

    createCityLandmark() {
        const city = new THREE.Group();
        city.position.set(-4, 0, 4.5);

        const baseGeom = new THREE.CylinderGeometry(2, 2.2, 0.4, 32);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x556677 });
        const base = new THREE.Mesh(baseGeom, baseMat);
        base.position.y = 0.2;
        city.add(base);

        const towerGeom = new THREE.BoxGeometry(1.2, 5.0, 1.2);
        const towerMat = new THREE.MeshStandardMaterial({ color: 0xccddee, metalness: 0.6, roughness: 0.2 });
        const tower = new THREE.Mesh(towerGeom, towerMat);
        tower.position.y = 2.5;
        tower.castShadow = true;
        city.add(tower);

        const antGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.5);
        const ant = new THREE.Mesh(antGeom, towerMat);
        ant.position.y = 5.75;
        city.add(ant);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        beacon.position.y = 6.5;
        city.add(beacon);
        this.beacon = beacon;

        const light = new THREE.PointLight(0xff0000, 2, 10);
        light.position.y = 6.5;
        city.add(light);

        this.scene.add(city);
        this.cityLandmark = city;
    }

    createSeaFoam() {
        const geometry = new THREE.PlaneGeometry(2.0, 0.4);
        for (let i = 0; i < 60; i++) {
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const foam = new THREE.Mesh(geometry, material);
            foam.position.set(
                (Math.random() - 0.5) * Config.WORLD.SIZE,
                0.02,
                (Math.random() - 0.5) * Config.WORLD.SIZE
            );
            foam.rotation.x = -Math.PI / 2;
            foam.rotation.z = Math.random() * Math.PI;
            this.scene.add(foam);
            this.foams.push({
                mesh: foam,
                material: material,
                speed: 0.3 + Math.random() * 0.7,
                offset: Math.random() * Math.PI * 2
            });
        }
    }

    update(dt, time) {
        this.foams.forEach(foam => {
            foam.mesh.position.x += foam.speed * dt;
            if (foam.mesh.position.x > Config.WORLD.SIZE / 2) foam.mesh.position.x = -Config.WORLD.SIZE / 2;
            foam.material.opacity = 0.1 + Math.sin(time * 0.002 + foam.offset) * 0.05;
        });

        if (this.beacon) {
            this.beacon.material.opacity = 0.5 + Math.sin(time * 0.005) * 0.5;
        }
    }

    getGridCell(worldX, worldZ) {
        const x = Math.round(worldX / Config.WORLD.CELL_SIZE);
        const z = Math.round(worldZ / Config.WORLD.CELL_SIZE);
        return this.grid.find(cell => cell.x === x && cell.z === z);
    }

    isValidPlacement(worldX, worldZ, type) {
        const cell = this.getGridCell(worldX, worldZ);
        if (!cell || cell.occupied) return false;
        const config = Config.STRUCTURES[type];
        if (!config) return false;
        if (config.isLandOnly && !cell.isLand) return false;
        if (!config.isLandOnly && cell.isLand) return false;
        return true;
    }
}
