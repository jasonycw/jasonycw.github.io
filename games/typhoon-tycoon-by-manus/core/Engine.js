import * as THREE from 'three';
import { Config } from './Config.js';

/**
 * Three.js Rendering Engine
 * LLM-Model: deepseek-v4-flash-free
 */
export class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x123a55);
        this.scene.fog = new THREE.Fog(0x123a55, 55, 150);

        this.initCamera();
        this.initRenderer();
        this.initLights();
        this.lastTime = performance.now();
        this.onUpdate = null;
        this.onInteraction = null;
        this.initListeners();
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(
            Config.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            Config.CAMERA.NEAR,
            Config.CAMERA.FAR
        );
        this.camera.position.set(
            Config.CAMERA.POSITION.x,
            Config.CAMERA.POSITION.y,
            Config.CAMERA.POSITION.z
        );
        this.camera.lookAt(0, 0, 0);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: document.getElementById('game-canvas'),
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.7;
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0xb8d8ec, 1.8);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff1d2, 3.0);
        sun.position.set(15, 35, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.setScalar(2048);
        sun.shadow.camera.left = -35;
        sun.shadow.camera.right = 35;
        sun.shadow.camera.top = 35;
        sun.shadow.camera.bottom = -35;
        this.scene.add(sun);

        const sky = new THREE.HemisphereLight(0x9fd8ff, 0x355e55, 1.25);
        this.scene.add(sky);
    }

    initListeners() {
        window.addEventListener('resize', () => this.onResize());
        this.renderer.domElement.addEventListener('mousedown', event => {
            if (this.onInteraction) this.onInteraction(event);
        });
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        const loop = currentTime => {
            requestAnimationFrame(loop);
            const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
            this.lastTime = currentTime;
            if (this.onUpdate) this.onUpdate(dt, currentTime);
            this.renderer.render(this.scene, this.camera);
        };
        requestAnimationFrame(loop);
    }
}
