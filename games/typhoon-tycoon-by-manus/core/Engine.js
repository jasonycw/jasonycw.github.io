import * as THREE from 'three';
import { Config } from './Config.js';

/**
 * Three.js Rendering Engine
 * Addressing: Event listeners, performance.now, clean setup
 * LLM-Model: gpt-4.1-mini
 */
export class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a1628);
        this.scene.fog = new THREE.Fog(0x0a1628, 20, 60);

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
        this.camera.position.set(Config.CAMERA.POSITION.x, Config.CAMERA.POSITION.y, Config.CAMERA.POSITION.z);
        this.camera.lookAt(0, 0, 0);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            canvas: document.getElementById('game-canvas'),
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0x4466aa, 0.8);
        this.scene.add(ambient);

        const dir = new THREE.DirectionalLight(0xffeedd, 1.5);
        dir.position.set(15, 25, 10);
        dir.castShadow = true;
        dir.shadow.mapSize.setScalar(2048);
        this.scene.add(dir);

        const hemi = new THREE.HemisphereLight(0x8888ff, 0x444422, 0.5);
        this.scene.add(hemi);
    }

    initListeners() {
        window.addEventListener('resize', () => this.onResize());
        
        // Addressing Gemini Feedback: Attach to domElement
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (this.onInteraction) this.onInteraction(e);
        });
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        const loop = (currentTime) => {
            requestAnimationFrame(loop);
            
            const dt = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;

            if (this.onUpdate) this.onUpdate(Math.min(dt, 0.1), currentTime);
            this.renderer.render(this.scene, this.camera);
        };
        requestAnimationFrame(loop);
    }
}
