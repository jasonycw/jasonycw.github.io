import * as THREE from 'three';

// ============================================================================
// GAME CONFIGURATION
// ============================================================================
const CONFIG = {
    // Game state
    startMoney: 500,
    startLives: 20,
    waveCount: 5,

    // Map settings
    mapWidth: 40,
    mapHeight: 30,
    tileSize: 1,

    // Enemy settings
    enemyRadius: 0.4,
    enemySpacing: 0.8,
    enemyTypes: {
        fast: { speed: 3.5, health: 15, reward: 10 },
        strong: { speed: 1.5, health: 40, reward: 30 },
        default: { speed: 2.5, health: 20, reward: 15 }
    },

    // Tower settings
    towers: {
        gun: { name: 'Gun Tower', cost: 100, range: 8, fireRate: 1, damage: 5 },
        slow: { name: 'Slow Tower', cost: 150, range: 10, fireRate: 0.5, damage: 2, slowFactor: 0.5 },
        heavy: { name: 'Heavy Tower', cost: 200, range: 6, fireRate: 0.7, damage: 10 }
    },
    towerRadius: 0.6,

    // Wave settings
    waveConfigs: [
        { count: 10, enemyType: 'fast', delay: 0.2 },
        { count: 15, enemyType: 'fast', delay: 0.15 },
        { count: 20, enemyType: 'strong', delay: 0.15 },
        { count: 25, enemyType: 'mixed', delay: 0.1 },
        { count: 30, enemyType: 'mixed', delay: 0.1 }
    ]
};

// ============================================================================
// MATH & VECTOR UTILITIES
// ============================================================================
function distance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Distance from point (px,pz) to segment a->b in XZ plane
function pointToSegmentDistance(px, pz, a, b) {
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const wx = px - a.x;
    const wz = pz - a.z;
    const c1 = vx * wx + vz * wz;
    if (c1 <= 0) return Math.sqrt(wx * wx + wz * wz);
    const c2 = vx * vx + vz * vz;
    if (c2 <= c1) return Math.sqrt((px - b.x) * (px - b.x) + (pz - b.z) * (pz - b.z));
    const t = c1 / c2;
    const projx = a.x + t * vx;
    const projz = a.z + t * vz;
    const dx = px - projx;
    const dz = pz - projz;
    return Math.sqrt(dx * dx + dz * dz);
}

// Shared projectile geometry/material to avoid repeated allocations
const PROJECTILE_GEOMETRY = new THREE.SphereGeometry(0.15, 8, 8);
const PROJECTILE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffff00 });

// ============================================================================
// GAME STATE
// ============================================================================
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.money = CONFIG.startMoney;
        this.lives = CONFIG.startLives;
        this.waveIndex = 0;
        this.isGameOver = false;
        this.isWon = false;
        this.currentWaveActive = false;
        this.enemiesSpawned = 0;
        this.enemiesDefeated = 0;
    }

    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            return true;
        }
        return false;
    }

    earnMoney(amount) {
        this.money += amount;
    }

    damageBase(amount) {
        this.lives -= amount;
        if (this.lives <= 0) {
            this.lives = 0;
            this.isGameOver = true;
        }
    }

    nextWave() {
        this.waveIndex++;
        if (this.waveIndex >= CONFIG.waveConfigs.length) {
            this.isWon = true;
            this.isGameOver = true;
        }
    }
}

// ============================================================================
// ENEMY SYSTEM
// ============================================================================
class Enemy {
    constructor(pathWaypoints, type = 'fast') {
        this.pathWaypoints = pathWaypoints;
        this.type = type;
        const tcfg = CONFIG.enemyTypes[type] || CONFIG.enemyTypes.default;
        this.speed = tcfg.speed;
        this.maxHealth = tcfg.health;
        this.health = this.maxHealth;
        this.reward = tcfg.reward;

        this.pathProgress = 0;
        this.isAlive = true;
        this.reachedEnd = false;

        this.mesh = this.createMesh();
        this.position = { x: pathWaypoints[0].x, z: pathWaypoints[0].z };
        this.mesh.position.set(this.position.x, 0.4, this.position.z);

        this.slowSpeed = 1;
        this.slowEndTime = 0;
        this.rewardGiven = false; // prevent multiple reward grants for the same enemy
    }

    createMesh() {
        // Use original typhoon sprite for enemies (texture/material preloaded and reused)
        // The texture and spriteMaterial are created once above and reused across instances.
        const map = Enemy.texture || (Enemy.texture = new THREE.TextureLoader().load('assets/typhoon.png'));
        const material = Enemy.spriteMaterial || (Enemy.spriteMaterial = new THREE.SpriteMaterial({ map: map, color: 0xffffff }));
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.6, 1.6, 1);
        return sprite;
    }

    update(deltaTime) {
        if (!this.isAlive) return;

        const effectiveSpeed = this.slowSpeed * this.speed;
        this.pathProgress += effectiveSpeed * deltaTime;

        if (this.pathProgress >= 1) {
            this.reachedEnd = true;
            this.isAlive = false;
            return;
        }

        this.updatePosition();

        if (this.slowEndTime > 0) {
            this.slowEndTime -= deltaTime;
            if (this.slowEndTime <= 0) {
                this.slowSpeed = 1;
            }
        }
    }

    updatePosition() {
        const waypoints = this.pathWaypoints;
        const segs = waypoints._segmentDistances || [];
        const totalDist = waypoints._totalDist || this.getTotalPathDistance();
        const targetDist = totalDist * this.pathProgress;

        let dist = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const segmentDist = segs[i] || distance(waypoints[i], waypoints[i + 1]);
            if (dist + segmentDist >= targetDist) {
                const t = (targetDist - dist) / segmentDist;
                this.position.x = lerp(waypoints[i].x, waypoints[i + 1].x, t);
                this.position.z = lerp(waypoints[i].z, waypoints[i + 1].z, t);
                this.mesh.position.set(this.position.x, 0.4, this.position.z);
                return;
            }
            dist += segmentDist;
        }

        const lastWaypoint = waypoints[waypoints.length - 1];
        this.position.x = lastWaypoint.x;
        this.position.z = lastWaypoint.z;
        this.mesh.position.set(this.position.x, 0.4, this.position.z);
    }

    getTotalPathDistance() {
        if (!this._totalPathDist) {
            this._totalPathDist = 0;
            for (let i = 0; i < this.pathWaypoints.length - 1; i++) {
                this._totalPathDist += distance(this.pathWaypoints[i], this.pathWaypoints[i + 1]);
            }
        }
        return this._totalPathDist;
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
        }
    }

    applySlow(slowFactor, duration) {
        this.slowSpeed = slowFactor;
        this.slowEndTime = duration;
    }
}

// Ensure enemy sprite texture/material are loaded once and reused
Enemy.texture = Enemy.texture || new THREE.TextureLoader().load('assets/typhoon.png');
Enemy.spriteMaterial = Enemy.spriteMaterial || new THREE.SpriteMaterial({ map: Enemy.texture, color: 0xffffff });

class WaveManager {
    constructor(pathWaypoints) {
        this.pathWaypoints = pathWaypoints;
        this.enemies = [];
        this.currentWave = -1;
        this.spawnTimer = 0;
        this.spawnIndex = 0;

        // Precompute segment distances for the static path once (cached on the waypoints array)
        // This avoids recomputing segment distances every frame for each enemy.
        if (!this.pathWaypoints._segmentDistances) {
            const segs = [];
            let total = 0;
            for (let i = 0; i < pathWaypoints.length - 1; i++) {
                const d = distance(pathWaypoints[i], pathWaypoints[i + 1]);
                segs.push(d);
                total += d;
            }
            this.pathWaypoints._segmentDistances = segs;
            this.pathWaypoints._totalDist = total;
        }
    }

    startWave(waveIndex) {
        if (waveIndex >= CONFIG.waveConfigs.length) return false;

        this.currentWave = waveIndex;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnIndex = 0;
        return true;
    }

    update(deltaTime, scene, gameState) {
        if (this.currentWave < 0) return;

        const waveConfig = CONFIG.waveConfigs[this.currentWave];
        
        // Spawn enemies
        if (this.spawnIndex < waveConfig.count) {
            this.spawnTimer -= deltaTime;
            if (this.spawnTimer <= 0) {
                const enemyType = waveConfig.enemyType === 'mixed'
                    ? (Math.random() > 0.6 ? 'fast' : 'strong')
                    : waveConfig.enemyType;
                const enemy = new Enemy(this.pathWaypoints, enemyType);
                this.enemies.push(enemy);
                scene.add(enemy.mesh);
                this.spawnIndex++;
                this.spawnTimer = waveConfig.delay;
                if (gameState) gameState.enemiesSpawned++;
            }
        }

        // Update enemies and apply side-effects (rewards/damage) here
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(deltaTime);
            if (!enemy.isAlive) {
                if (enemy.reachedEnd) {
                    if (gameState) gameState.damageBase(1);
                } else if (!enemy.rewardGiven) {
                    if (gameState) gameState.earnMoney(enemy.reward);
                    enemy.rewardGiven = true;
                }
                scene.remove(enemy.mesh);
                this.enemies.splice(i, 1);
            }
        }
    }

    getActiveEnemies() {
        return this.enemies.filter(e => e.isAlive);
    }

    isWaveComplete() {
        return this.spawnIndex >= CONFIG.waveConfigs[this.currentWave].count && this.enemies.length === 0;
    }
}

// ============================================================================
// TOWER SYSTEM
// ============================================================================
class Tower {
    constructor(x, z, type, scene) {
        this.x = x;
        this.z = z;
        this.type = type;
        this.config = CONFIG.towers[type];

        this.fireTimer = 0;
        this.lastTargetId = null;

        this.mesh = this.createMesh();
        this.mesh.position.set(x, 0.5, z);
        scene.add(this.mesh);

        this.rangeIndicator = this.createRangeIndicator();
        this.rangeIndicator.position.set(x, 0.01, z);
        scene.add(this.rangeIndicator);
    }

    createMesh() {
        const geometry = new THREE.CylinderGeometry(0.4, 0.5, 0.8, 12);
        const material = new THREE.MeshPhongMaterial({ color: 0x00aa00 });
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    createRangeIndicator() {
        const geometry = new THREE.CircleGeometry(this.config.range, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.1,
            wireframe: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    update(deltaTime, enemies, projectiles, scene) {
        this.fireTimer -= deltaTime;

        const targets = this.getTargetsInRange(enemies);
        if (targets.length > 0 && this.fireTimer <= 0) {
            const target = targets[0];
            this.fire(target, projectiles, scene);
            this.fireTimer = 1 / this.config.fireRate;
        }
    }

    getTargetsInRange(enemies) {
        const rangeSq = this.config.range * this.config.range;
        return enemies.filter(e => {
            const dx = this.x - e.position.x;
            const dz = this.z - e.position.z;
            // Compare squared distances to avoid costly Math.sqrt and allocations
            return (dx * dx + dz * dz) <= rangeSq;
        });
    }

    fire(target, projectiles, scene) {
        projectiles.push({
            startX: this.x,
            startZ: this.z,
            targetX: target.position.x,
            targetZ: target.position.z,
            targetEnemy: target,
            damage: this.config.damage,
            speed: 15,
            travelled: 0,
            slow: this.type === 'slow',
            mesh: null
        });
    }

    showRange() {
        this.rangeIndicator.material.opacity = 0.2;
    }

    hideRange() {
        this.rangeIndicator.material.opacity = 0.1;
    }

    remove(scene) {
        scene.remove(this.mesh);
        scene.remove(this.rangeIndicator);
    }
}

// ============================================================================
// PROJECTILE SYSTEM
// ============================================================================
function updateProjectiles(projectiles, scene, deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const dist = distance({ x: p.startX, z: p.startZ }, { x: p.targetX, z: p.targetZ });
        const totalTravelDist = dist;
        const maxTravelDist = p.speed * deltaTime;

        p.travelled += maxTravelDist;

        if (p.travelled >= totalTravelDist) {
            if (p.targetEnemy.isAlive) {
                p.targetEnemy.takeDamage(p.damage);
                if (p.slow) {
                    p.targetEnemy.applySlow(CONFIG.towers.slow.slowFactor, 1.5);
                }
            }
            if (p.mesh) scene.remove(p.mesh);
            projectiles.splice(i, 1);
        } else {
            const t = p.travelled / totalTravelDist;
            const x = lerp(p.startX, p.targetX, t);
            const z = lerp(p.startZ, p.targetZ, t);

            if (!p.mesh) {
                // Reuse shared geometry/material to avoid per-projectile allocations
                p.mesh = new THREE.Mesh(PROJECTILE_GEOMETRY, PROJECTILE_MATERIAL);
                scene.add(p.mesh);
            }
            p.mesh.position.set(x, 0.5, z);
        }
    }
}

// ============================================================================
// THREE.JS SCENE SETUP
// ============================================================================
class GameScene {
    constructor(container) {
        this.container = container;
        this.pathWaypoints = [];
        this.towers = [];
        this.projectiles = [];

        this.setupScene();
        this.createGround();
        this.createPath();
        this.createLighting();

        // Raycasting helpers reused to avoid allocating per click (single plane and raycaster)
        this.raycaster = new THREE.Raycaster();
        const planeGeometry = new THREE.PlaneGeometry(CONFIG.mapWidth + 10, CONFIG.mapHeight + 10);
        this.raycastPlane = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ visible: false }));
        this.raycastPlane.rotation.x = -Math.PI / 2;
        this.raycastPlane.position.y = -0.1;
        this.scene.add(this.raycastPlane);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        // Use background image from original assets for atmosphere
        this.scene.background = new THREE.TextureLoader().load('assets/bg.png');
        this.scene.fog = new THREE.Fog(0x1a3a52, 80, 100);

        const canvas = document.getElementById('canvas');
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(20, 25, 25);
        this.camera.lookAt(20, 0, 15);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e));
    }

    createGround() {
        const texture = new THREE.TextureLoader().load('assets/map.png');
        const geometry = new THREE.PlaneGeometry(CONFIG.mapWidth, CONFIG.mapHeight);
        const material = new THREE.MeshLambertMaterial({ map: texture });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // Grid
        const gridHelper = new THREE.GridHelper(
            CONFIG.mapWidth,
            CONFIG.mapWidth / CONFIG.tileSize,
            0x444444,
            0x222222
        );
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    createPath() {
        // Waypoints for the enemy path
        this.pathWaypoints = [
            { x: 0, z: 15 },
            { x: 10, z: 15 },
            { x: 10, z: 5 },
            { x: 20, z: 5 },
            { x: 20, z: 25 },
            { x: 35, z: 25 }
        ];

        // Draw path
        const pathGeometry = new THREE.BufferGeometry();
        const pathPoints = this.pathWaypoints.map(p => new THREE.Vector3(p.x, 0.05, p.z));
        pathGeometry.setFromPoints(pathPoints);

        const pathMaterial = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 3 });
        const path = new THREE.Line(pathGeometry, pathMaterial);
        this.scene.add(path);

        // Draw waypoint spheres
        for (let wp of this.pathWaypoints) {
            const geometry = new THREE.SphereGeometry(0.4, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0xff6600 });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(wp.x, 0.4, wp.z);
            this.scene.add(sphere);
        }
    }

    createLighting() {
        const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
        light1.position.set(30, 50, 30);
        light1.castShadow = true;
        light1.shadow.mapSize.width = 2048;
        light1.shadow.mapSize.height = 2048;
        this.scene.add(light1);

        const light2 = new THREE.AmbientLight(0x808080, 0.6);
        this.scene.add(light2);
    }

    addTower(type, x, z) {
        const tower = new Tower(x, z, type, this.scene);
        this.towers.push(tower);
        return tower;
    }

    removeTower(tower) {
        tower.remove(this.scene);
        this.towers = this.towers.filter(t => t !== tower);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const canvas = document.getElementById('canvas');
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    onCanvasClick(event) {
        const gameInstance = window.gameInstance;
        if (!gameInstance) return;

        const mouse = new THREE.Vector2();

        const rect = this.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(mouse, this.camera);

        const intersects = this.raycaster.intersectObject(this.raycastPlane);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Constrain to map bounds
            const x = Math.max(0, Math.min(CONFIG.mapWidth, point.x));
            const z = Math.max(0, Math.min(CONFIG.mapHeight, point.z));
            gameInstance.selectPlacementLocation(x, z);
        }
    }
}

// ============================================================================
// UI MANAGEMENT
// ============================================================================
class UIManager {
    constructor() {
        this.waveCountEl = document.getElementById('wave-count');
        this.moneyEl = document.getElementById('money');
        this.livesEl = document.getElementById('lives');
        this.towerInfoEl = document.getElementById('tower-info');
        this.towerNameEl = document.getElementById('tower-name');
        this.towerCostEl = document.getElementById('tower-cost');
        this.placeTowerBtn = document.getElementById('place-tower-btn');
        this.gameStateEl = document.getElementById('game-state');
        this.stateMessageEl = document.getElementById('state-message');
        this.restartBtn = document.getElementById('restart-btn');
        this.fpsEl = document.getElementById('fps');
        this.startScreenEl = document.getElementById('start-screen');
        this.startBtn = document.getElementById('start-btn');

        this.selectedTower = null;
        this.selectedLocation = null;

        this.placeTowerBtn.addEventListener('click', () => this.onPlaceTowerClick());
        this.restartBtn.addEventListener('click', () => this.onRestartClick());
        this.startBtn.addEventListener('click', () => this.onStartClick());
    }

    // Simple non-blocking notification shown in the UI overlay (avoids blocking alerts)
    showNotification(message, duration = 2000) {
        if (!this._notifEl) {
            this._notifEl = document.createElement('div');
            this._notifEl.className = 'notification';
            document.getElementById('ui-overlay').appendChild(this._notifEl);
        }
        this._notifEl.textContent = message;
        this._notifEl.classList.add('visible');
        if (this._notifTimeout) clearTimeout(this._notifTimeout);
        this._notifTimeout = setTimeout(() => this._notifEl.classList.remove('visible'), duration);
    }

    updateStats(money, lives, wave) {
        this.moneyEl.textContent = money;
        this.livesEl.textContent = lives;
        this.waveCountEl.textContent = (wave + 1);
    }

    selectTower(towerType) {
        this.selectedTower = towerType;
        const config = CONFIG.towers[towerType];
        this.towerNameEl.textContent = config.name;
        this.towerCostEl.textContent = `Cost: ${config.cost}`;
        this.towerInfoEl.classList.remove('hidden');
    }

    selectLocation(x, z) {
        this.selectedLocation = { x, z };
    }

    updateTowerButtonState(canPlace) {
        this.placeTowerBtn.disabled = !canPlace;
    }

    showStartScreen() {
        this.startScreenEl.classList.remove('hidden');
    }

    hideStartScreen() {
        this.startScreenEl.classList.add('hidden');
    }

    showGameOver(isWon) {
        this.stateMessageEl.textContent = isWon ? 'YOU WIN!' : 'GAME OVER';
        this.stateMessageEl.style.color = isWon ? '#00ff00' : '#ff4444';
        this.gameStateEl.classList.remove('hidden');
    }

    hideGameOverScreen() {
        this.gameStateEl.classList.add('hidden');
    }

    updateFPS(fps) {
        this.fpsEl.textContent = Math.round(fps);
    }

    onPlaceTowerClick() {
        if (window.gameInstance) {
            window.gameInstance.placeTowerAtSelectedLocation();
        }
    }

    onRestartClick() {
        if (window.gameInstance) {
            window.gameInstance.restart();
        }
    }

    onStartClick() {
        if (window.gameInstance) {
            window.gameInstance.startGame();
        }
    }
}

// ============================================================================
// MAIN GAME CLASS
// ============================================================================
class TyphoonTycoonGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.gameState = new GameState();
        this.scene = new GameScene(this.container);
        this.waveManager = new WaveManager(this.scene.pathWaypoints);
        this.ui = new UIManager();

        // Wire up simple callbacks so WaveManager can notify about kills/reaches
        this.waveManager.onEnemyReached = (enemy) => { this.gameState.damageBase(1); };
        this.waveManager.onEnemyKilled = (enemy) => { this.gameState.earnMoney(enemy.reward); };

        this.towerPlacementMode = false;
        this.selectedPlacementLocation = null;
        this.isRunning = false;

        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fpsTime = 0;

        this.initializeAnimation();
    }

    initializeAnimation() {
        this.ui.showStartScreen();
        this.animate();
    }

    startGame() {
        this.isRunning = true;
        this.ui.hideStartScreen();
        this.gameState.reset();
        this.ui.updateStats(this.gameState.money, this.gameState.lives, this.gameState.waveIndex);
        this.ui.hideGameOverScreen();
        this.startNextWave();

        // Play background audio from original game (may require user interaction in some browsers)
        try {
            if (!this.bgAudio) {
                this.bgAudio = new Audio('assets/sound.mp3');
                this.bgAudio.loop = true;
                this.bgAudio.volume = 0.25;
                this.bgAudio.play().catch(e => console.warn('Audio playback blocked:', e));
            }
        } catch (e) {
            console.warn('Audio init failed', e);
        }
    }

    restart() {
        // Clear scene
        for (let tower of this.scene.towers) {
            tower.remove(this.scene.scene);
        }
        this.scene.towers = [];

        // Remove any projectile meshes
        this.scene.projectiles.forEach(p => { if (p.mesh) this.scene.scene.remove(p.mesh); });
        this.scene.projectiles = [];

        // Remove remaining enemies
        this.waveManager.enemies.forEach(e => this.scene.scene.remove(e.mesh));
        this.waveManager.enemies = [];

        // Clear pending next-wave timeout if present
        if (this.nextWaveTimeout) { clearTimeout(this.nextWaveTimeout); this.nextWaveTimeout = null; }

        // Stop background audio if playing
        if (this.bgAudio) { try { this.bgAudio.pause(); this.bgAudio.currentTime = 0; } catch (e) {} this.bgAudio = null; }

        this.startGame();
    }

    startNextWave() {
        if (this.waveManager.startWave(this.gameState.waveIndex)) {
            this.gameState.currentWaveActive = true;
            this.gameState.enemiesSpawned = 0;
        }
    }

    selectPlacementLocation(x, z) {
        if (this.gameState.isGameOver || !this.isRunning) return;

        // Round to grid
        const gridX = Math.round(x / 1) * 1;
        const gridZ = Math.round(z / 1) * 1;

        // Check if too close to path (check distance to segments, not just waypoints)
        const minDistToPath = 2;
        let tooCloseToPath = false;
        for (let i = 0; i < this.scene.pathWaypoints.length - 1; i++) {
            const a = this.scene.pathWaypoints[i];
            const b = this.scene.pathWaypoints[i + 1];
            const distToSeg = pointToSegmentDistance(gridX, gridZ, a, b);
            if (distToSeg < minDistToPath) {
                tooCloseToPath = true;
                break;
            }
        }

        if (tooCloseToPath) {
            console.log('Too close to path');
            return;
        }

        // Check if overlaps with existing tower
        for (let tower of this.scene.towers) {
            if (distance({ x: gridX, z: gridZ }, { x: tower.x, z: tower.z }) < 2) {
                console.log('Too close to existing tower');
                return;
            }
        }

        this.selectedPlacementLocation = { x: gridX, z: gridZ };

        // Show tower info and enter placement mode
        this.selectTowerForPlacement(this.ui.selectedTower || 'gun');
    }

    selectTowerForPlacement(towerType) {
        if (!this.selectedPlacementLocation) return;
        this.towerPlacementMode = true;
        this.ui.selectTower(towerType);
        this.ui.selectLocation(this.selectedPlacementLocation.x, this.selectedPlacementLocation.z);

        const config = CONFIG.towers[towerType];
        const canPlace = this.gameState.money >= config.cost;
        this.ui.updateTowerButtonState(canPlace);
    }

    placeTowerAtSelectedLocation() {
        if (!this.selectedPlacementLocation || !this.towerPlacementMode) return;

        // Use selected tower type from UI; default to 'gun' if none selected
        const towerType = this.ui.selectedTower || 'gun';
        const config = CONFIG.towers[towerType];

        if (!this.gameState.spendMoney(config.cost)) {
            // Non-blocking notification instead of alert
            this.ui.showNotification('Not enough money!');
            return;
        }

        const tower = this.scene.addTower(towerType, this.selectedPlacementLocation.x, this.selectedPlacementLocation.z);
        
        this.towerPlacementMode = false;
        this.selectedPlacementLocation = null;
        this.ui.towerInfoEl.classList.add('hidden');
        this.ui.updateStats(this.gameState.money, this.gameState.lives, this.gameState.waveIndex);
    }

    update(deltaTime) {
        if (!this.isRunning) return;

        // Update wave
        this.waveManager.update(deltaTime, this.scene.scene, this.gameState);

        // Update towers (compute active enemies once per frame)
        const activeEnemies = this.waveManager.getActiveEnemies();
        for (let tower of this.scene.towers) {
            tower.update(deltaTime, activeEnemies, this.scene.projectiles, this.scene.scene);
        }

        // Update projectiles
        updateProjectiles(this.scene.projectiles, this.scene.scene, deltaTime);

        // Check for wave completion
        if (this.gameState.currentWaveActive && this.waveManager.isWaveComplete()) {
            this.gameState.currentWaveActive = false;
            this.gameState.nextWave();

            if (!this.gameState.isGameOver) {
                this.nextWaveTimeout = setTimeout(() => this.startNextWave(), 1000);
            }
        }

        // Update UI
        this.ui.updateStats(this.gameState.money, this.gameState.lives, this.gameState.waveIndex);

        // Check game over
        if (this.gameState.isGameOver) {
            this.isRunning = false;
            this.ui.showGameOver(this.gameState.isWon);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        if (this.isRunning) {
            this.update(deltaTime);
        }

        this.scene.render();

        // FPS calculation
        this.frameCount++;
        this.fpsTime += deltaTime;
        if (this.fpsTime >= 1) {
            this.ui.updateFPS(this.frameCount / this.fpsTime);
            this.frameCount = 0;
            this.fpsTime = 0;
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new TyphoonTycoonGame();
});

// Allow restart from console
window.restartGame = () => {
    if (window.gameInstance) window.gameInstance.restart();
};
