import * as THREE from 'three';
import { Map } from './components/Map.js';
import { GameManager } from './components/GameManager.js';
import { GameConfig } from './components/GameConfig.js';

const scene = new THREE.Scene();

const aspectRatio = window.innerWidth / window.innerHeight;
const frustumSize = 200;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspectRatio / -2,
    frustumSize * aspectRatio / 2,
    frustumSize / 2,
    frustumSize / -2,
    1,
    1000
);
camera.position.set(200, 200, 200);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game-canvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB);

const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);

const map = new Map(scene);
const gameManager = new GameManager(scene, map);

let selectedTowerType = 'basicTower';
let lastFrameTime = performance.now();

function initializeUI() {
    const towerSelection = document.getElementById('tower-selection');
    towerSelection.innerHTML = '';

    for (const [key, config] of Object.entries(GameConfig.tower)) {
        const button = document.createElement('button');
        button.textContent = `${config.name} ($${config.cost})`;
        button.className = 'tower-btn';
        if (key === selectedTowerType) button.classList.add('active');
        button.onclick = () => {
            selectedTowerType = key;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
        };
        towerSelection.appendChild(button);
    }

    const infoPanel = document.getElementById('info-panel');
    const statusDisplay = document.createElement('p');
    statusDisplay.id = 'game-status';
    statusDisplay.textContent = 'Press Start to begin';
    infoPanel.appendChild(statusDisplay);

    const startButton = document.createElement('button');
    startButton.id = 'start-button';
    startButton.textContent = 'Start Game';
    startButton.style.marginTop = '10px';
    startButton.style.padding = '8px 16px';
    startButton.style.background = '#00AA00';
    startButton.style.color = '#fff';
    startButton.style.border = 'none';
    startButton.style.borderRadius = '4px';
    startButton.style.cursor = 'pointer';
    startButton.onclick = () => {
        gameManager.restart(scene);
        gameManager.startGame();
        startButton.textContent = 'Restart Game';
        startButton.style.background = '#AA0000';
    };
    infoPanel.appendChild(startButton);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Gemini Feedback: Attach listener to domElement to prevent UI clicks from placing towers
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
    renderer.render(scene, camera);
}

initializeUI();
requestAnimationFrame(animate);
