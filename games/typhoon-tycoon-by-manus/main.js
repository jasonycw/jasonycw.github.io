import * as THREE from 'three';
import { Map } from './components/Map.js';
import { GameManager } from './components/GameManager.js';
import { GameConfig } from './components/GameConfig.js';

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1628);
scene.fog = new THREE.Fog(0x0a1628, 20, 60);

// Camera Setup
const camera = new THREE.PerspectiveCamera(
    GameConfig.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

// Renderer Setup
const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    canvas: document.getElementById('game-canvas'),
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// Lighting
const ambientLight = new THREE.AmbientLight(0x4466aa, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5);
dirLight.position.set(15, 25, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar(2048);
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

const hemiLight = new THREE.HemisphereLight(0x8888ff, 0x444422, 0.5);
scene.add(hemiLight);

// Game Objects
const map = new Map(scene);
const gameManager = new GameManager(scene, map);

let selectedStructure = 'LaserTower';
let lastTime = performance.now();

function initUI() {
    const toolbar = document.getElementById('toolbar');
    toolbar.innerHTML = '';

    for (const [key, config] of Object.entries(GameConfig.structures)) {
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        if (key === selectedStructure) btn.classList.add('active');
        
        btn.innerHTML = `
            <div class="icon" style="background-color: #${config.color.toString(16).padStart(6, '0')}"></div>
            <div class="details">
                <span class="name">${config.name}</span>
                <span class="cost">$${config.cost}</span>
            </div>
        `;
        
        btn.onclick = () => {
            selectedStructure = key;
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        toolbar.appendChild(btn);
    }

    document.getElementById('start-btn').onclick = () => {
        document.getElementById('start-overlay').style.display = 'none';
        gameManager.startGame();
    };

    document.getElementById('restart-btn').onclick = () => {
        gameManager.restart();
    };
}

// Interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('mousedown', (event) => {
    if (gameManager.state !== 'playing') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(map.mapMesh);
    
    if (intersects.length > 0) {
        const p = intersects[0].point;
        gameManager.placeStructure(p.x, p.z, selectedStructure);
    }
});

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main Loop
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    gameManager.update(Math.min(dt, 0.1), currentTime, camera);
    renderer.render(scene, camera);
}

initUI();
requestAnimationFrame(animate);
