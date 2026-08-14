import * as THREE from 'three';

/**
 * Asset Management System
 * LLM-Model: deepseek-v4-flash-free
 */
export class Assets {
    constructor() {
        this.loader = new THREE.TextureLoader();
        this.textures = {};
    }

    async loadAll() {
        const paths = {
            map: 'assets/map.png',
            hitarea: 'assets/map-hitarea.png',
            typhoon: 'assets/typhoon.png',
            'sprite-laser': 'assets/sprites/laser-tower.png',
            'sprite-freeze': 'assets/sprites/freeze-tower.png',
            'sprite-repel': 'assets/sprites/repel-tower.png',
            'sprite-power': 'assets/sprites/power-plant.png',
            'sprite-nuclear': 'assets/sprites/nuclear.png',
            'sprite-university': 'assets/sprites/university.png',
            'sprite-research': 'assets/sprites/research-center.png',
            'sprite-ckh': 'assets/sprites/ckh.png'
        };

        const promises = Object.entries(paths).map(async ([key, path]) => {
            this.textures[key] = await this.loader.loadAsync(path);
            console.log(`Asset loaded: ${key}`);
        });

        await Promise.all(promises);
    }

    get(key) {
        return this.textures[key];
    }
}
