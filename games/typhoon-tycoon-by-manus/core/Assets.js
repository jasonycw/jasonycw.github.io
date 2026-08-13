import * as THREE from 'three';

/**
 * Asset Management System
 * LLM-Model: gpt-4.1-mini
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
            typhoon: 'assets/typhoon.png'
        };

        const promises = Object.entries(paths).map(async ([key, path]) => {
            try {
                this.textures[key] = await this.loader.loadAsync(path);
                console.log(`Asset loaded: ${key}`);
            } catch (e) {
                console.error(`Failed to load asset: ${key}`, e);
            }
        });

        await Promise.all(promises);
    }

    get(key) {
        return this.textures[key];
    }
}
