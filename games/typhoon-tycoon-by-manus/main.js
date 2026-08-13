import * as THREE from 'three';
import { Map } from './components/Map.js';
import { GameManager } from './components/GameManager.js';
import { GameConfig } from './components/GameConfig.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050a0f);
scene.fog = new THREE.FogExp2(0x050a0f, 0.0015);

const aspectRatio = window.innerWidth / window.innerHeight;
const frustumSize = 250;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspectRatio / -2,
    frustumSize * aspectRatio / 2,
    frustumSize / 2,
    frustumSize / -2,
    1,
    2000
);
camera.position.set(400, 400, 400);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    canvas: document.getElementById('game-canvas'),
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Enhanced Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(200, 500, 200);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.left = -300;
mainLight.shadow.camera.right = 300;
mainLight.shadow.camera.top = 300;
mainLight.shadow.camera.bottom = -300;
scene.add(mainLight);

const map = new Map(scene);
const gameManager = new GameManager(scene, map);

let selectedTowerType = 'basicTower';
let lastFrameTime = performance.now();

function initializeUI() {
    const toolbar = document.getElementById('tower-toolbar');
    toolbar.innerHTML = '';

    for (const [key, config] of Object.entries(GameConfig.tower)) {
        const button = document.createElement('button');
        button.className = 'tower-btn';
        if (key === selectedTowerType) button.classList.add('active');
        
        button.innerHTML = `
            <span class="name">${config.name}</span>
            <span class="cost">$${config.cost}</span>
        `;
        
        button.onclick = () => {
            selectedTowerType = key;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
        };
        toolbar.appendChild(button);
    }

    const startButton = document.getElementById('start-button');
    const statusContainer = document.getElementById('game-status-container');
    
    startButton.onclick = () => {
        gameManager.restart(scene);
        gameManager.startGame();
        statusContainer.style.display = 'none';
    };
}

// Observe game state to show/hide start menu
function updateGameStateUI() {
    const statusContainer = document.getElementById('game-status-container');
    const statusText = document.getElementById('game-status');
    const startButton = document.getElementById('start-button');

    if (gameManager.state === 'won' || gameManager.state === 'lost') {
        statusContainer.style.display = 'block';
        statusText.textContent = gameManager.state === 'won' ? 'VICTORY SURVIVED' : 'CITY DESTROYED';
        startButton.textContent = 'RETRY DEFENSE';
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('mousedown', (event) => {
    if (gameManager.state !== 'playing') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(map.ground);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        gameManager.placeTower(point.x, point.z, selectedTowerType);
    }
});

window.addEventListener('resize', () => {
    const newAspectRatio = window.innerWidth / window.innerHeight;
    camera.left = frustumSize * newAspectRatio / -2;
    camera.right = frustumSize * newAspectRatio / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    const cappedDeltaTime = Math.min(deltaTime, 0.1);

    gameManager.update(cappedDeltaTime, currentTime, camera);
    updateGameStateUI();
    renderer.render(scene, camera);
}

initializeUI();
requestAnimationFrame(animate);
