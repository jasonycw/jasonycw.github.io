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
            mapTexture.anisotropy = 4;
        }
        const mapGeometry = new THREE.PlaneGeometry(Config.WORLD.SIZE, Config.WORLD.SIZE);
        const mapMaterial = new THREE.MeshStandardMaterial({
            map: mapTexture,
            color: 0xffffff,
            emissive: 0x173b55,
            emissiveIntensity: 0.55,
            roughness: 0.8,
            metalness: 0.05
        });
        this.mesh = new THREE.Mesh(mapGeometry, mapMaterial);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        const waterGeometry = new THREE.PlaneGeometry(Config.WORLD.SIZE * 2, Config.WORLD.SIZE * 2);
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x1d5674,
            transparent: true,
            opacity: 0.18,
            roughness: 0.12,
            metalness: 0.6
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.14;
        water.receiveShadow = true;
        this.scene.add(water);
    }

    initializeGrid() {
        const hitareaTexture = this.assets.get('hitarea');
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
        const treeTrunkGeometry = new THREE.CylinderGeometry(0.045, 0.06, 0.28, 6);
        const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x543b2a, roughness: 1 });
        const treeLeafGeometry = new THREE.ConeGeometry(0.25, 0.62, 7);
        const treeLeafMaterial = new THREE.MeshStandardMaterial({ color: 0x286548, roughness: 0.95 });
        const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x708696, roughness: 0.65, metalness: 0.15 });
        const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffe6a1 });
        const cityPoint = new THREE.Vector2(-4, 4.5);

        this.grid.forEach(cell => {
            if (!cell.isLand) return;
            if (new THREE.Vector2(cell.wx, cell.wz).distanceTo(cityPoint) < 2.25) return;

            // Exactly one centered object per selected classified cell; no random jitter crosses a coastline.
            const seed = Math.abs(Math.sin(cell.x * 17.37 + cell.z * 41.91));
            if (seed < 0.78) return;
            const group = new THREE.Group();
            group.position.set(cell.wx, 0, cell.wz);

            if (seed > 0.9) {
                const trunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
                trunk.position.y = 0.14;
                const leaves = new THREE.Mesh(treeLeafGeometry, treeLeafMaterial);
                leaves.position.y = 0.5;
                group.add(trunk, leaves);
            } else {
                const height = 0.55 + (seed - 0.78) * 3.0;
                const buildingGeometry = new THREE.BoxGeometry(0.56, height, 0.56);
                const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
                building.position.y = height / 2;
                building.castShadow = true;
                group.add(building);
                if (height > 0.7) {
                    const window = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), windowMaterial);
                    window.position.set(0.286, height * 0.62, 0);
                    window.rotation.y = Math.PI / 2;
                    building.add(window);
                }
            }
            this.scene.add(group);
            cell.scenery = group;
        });
    }

    createCityLandmark() {
        const city = new THREE.Group();
        city.position.set(-4, 0.05, 4.5);
        const islandMaterial = new THREE.MeshStandardMaterial({ color: 0xd6ad54, roughness: 0.92 });
        const island = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.05, 0.22, 10), islandMaterial);
        island.position.y = 0.12;
        island.receiveShadow = true;
        city.add(island);

        const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x8ca9b9, metalness: 0.45, roughness: 0.3 });
        const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffe28b });
        const skyline = [
            [-0.8, 0.9, 0.55], [-0.25, 1.6, 0.48], [0.3, 1.1, 0.6],
            [0.78, 0.72, 0.5], [0.05, 2.05, 0.32], [-1.12, 0.5, 0.45]
        ];
        skyline.forEach(([x, height, width]) => {
            const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), buildingMaterial);
            building.position.set(x, 0.25 + height / 2, Math.sin(x * 4) * 0.35);
            building.castShadow = true;
            city.add(building);
            const window = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.35, 0.09), windowMaterial);
            window.position.set(width / 2 + 0.006, building.position.y + height * 0.14, building.position.z);
            window.rotation.y = Math.PI / 2;
            building.add(window);
        });

        const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0xffd166 })
        );
        beacon.position.set(0.05, 2.55, 0);
        city.add(beacon);
        const light = new THREE.PointLight(0xffc857, 1.8, 7);
        light.position.set(0, 2.2, 0);
        city.add(light);
        this.scene.add(city);
        this.cityLandmark = city;
    }

    createSeaFoam() {
        const geometry = new THREE.PlaneGeometry(1.6, 0.35);
        const material = new THREE.MeshBasicMaterial({
            color: 0xe5f6ff,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        for (let index = 0; index < 58; index += 1) {
            const foam = new THREE.Mesh(geometry, material);
            foam.position.set(
                (Math.random() - 0.5) * Config.WORLD.SIZE,
                0.015,
                (Math.random() - 0.5) * Config.WORLD.SIZE
            );
            foam.rotation.x = -Math.PI / 2;
            foam.rotation.z = Math.random() * Math.PI;
            foam.scale.setScalar(0.5 + Math.random() * 1.5);
            this.scene.add(foam);
            this.foams.push({ mesh: foam, speed: 0.2 + Math.random() * 0.5, offset: Math.random() * Math.PI * 2 });
        }
    }

    update(dt, time) {
        this.foams.forEach(foam => {
            foam.mesh.position.x += foam.speed * dt * 0.25;
            if (foam.mesh.position.x > Config.WORLD.SIZE / 2) foam.mesh.position.x = -Config.WORLD.SIZE / 2;
            foam.mesh.material.opacity = 0.1 + Math.sin(time * 0.001 + foam.offset) * 0.06;
        });
        if (this.cityLandmark) this.cityLandmark.rotation.y = Math.sin(time * 0.0002) * 0.012;
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
