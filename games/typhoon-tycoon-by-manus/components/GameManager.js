import { GameConfig } from './GameConfig.js';
import { Enemy } from './Enemy.js';
import { Tower } from './Tower.js';
import * as THREE from 'three';

export class GameManager {
    constructor(scene, map) {
        this.scene = scene;
        this.map = map;
        this.state = 'idle';
        this.wave = 0;
        this.lives = GameConfig.player.initialLives;
        this.money = GameConfig.player.initialMoney;
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.timeSinceLastWave = 0;
        this.enemiesSpawnedThisWave = 0;
        this.timeSinceLastSpawn = 0;
    }

    startGame() {
        this.state = 'playing';
        this.wave = 1;
        this.timeSinceLastWave = 0;
        this.enemiesSpawnedThisWave = 0;
        this.timeSinceLastSpawn = 0;
        this.updateUI();
    }

    update(deltaTime, currentTime, camera) {
        if (this.state !== 'playing') return;

        let stateChanged = false;
        const enemiesThisWave = GameConfig.wave.enemyCountPerWave(this.wave);
        
        if (this.enemiesSpawnedThisWave < enemiesThisWave) {
            this.timeSinceLastSpawn += deltaTime;
            if (this.timeSinceLastSpawn >= GameConfig.enemy.spawnInterval / 1000) {
                this.spawnEnemy();
                this.enemiesSpawnedThisWave++;
                this.timeSinceLastSpawn = 0;
            }
        } else if (this.enemies.length === 0) {
            this.timeSinceLastWave += deltaTime;
            if (this.timeSinceLastWave >= GameConfig.wave.waveInterval) {
                this.nextWave();
                stateChanged = true;
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const reachedEnd = this.enemies[i].update(deltaTime, camera);
            if (reachedEnd) {
                this.lives -= this.enemies[i].damage;
                this.enemies.splice(i, 1);
                stateChanged = true;
                if (this.lives <= 0) {
                    this.lives = 0;
                    this.state = 'lost';
                }
            } else if (!this.enemies[i].isAlive()) {
                this.money += this.enemies[i].reward;
                this.enemies.splice(i, 1);
                stateChanged = true;
            }
        }

        for (const tower of this.towers) {
            const newProjectiles = tower.update(deltaTime, this.enemies, currentTime);
            if (newProjectiles && newProjectiles.length > 0) {
                this.projectiles.push(...newProjectiles);
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].update(deltaTime);
            if (!this.projectiles[i].isAlive()) {
                this.projectiles.splice(i, 1);
            }
        }

        if (stateChanged) {
            this.updateUI();
        }
    }

    spawnEnemy() {
        const enemy = new Enemy(this.scene, this.map.path, this.wave);
        this.enemies.push(enemy);
    }

    nextWave() {
        this.wave++;
        this.enemiesSpawnedThisWave = 0;
        this.timeSinceLastWave = 0;
        if (this.wave > GameConfig.gameEnd.waveToWin) {
            this.state = 'won';
        }
    }

    placeTower(x, z, towerType) {
        if (!this.map.isValidTowerPlacement(x, z)) return false;
        
        const towerConfig = GameConfig.tower[towerType];
        if (this.money < towerConfig.cost) return false;

        // Prevent tower stacking (Gemini Feedback)
        const towerPosition = new THREE.Vector3(x, 0, z);
        const minDistance = 15; 
        for (const existingTower of this.towers) {
            if (existingTower.position.distanceTo(towerPosition) < minDistance) {
                return false;
            }
        }

        const tower = new Tower(this.scene, towerPosition, towerType, towerConfig);
        this.towers.push(tower);
        this.money -= towerConfig.cost;
        this.updateUI();
        return true;
    }

    updateUI() {
        document.getElementById('wave-count').textContent = this.wave;
        document.getElementById('lives-count').textContent = this.lives;
        document.getElementById('money-count').textContent = this.money;
        
        const statusText = document.getElementById('game-status');
        if (this.state === 'won') statusText.textContent = 'VICTORY!';
        else if (this.state === 'lost') statusText.textContent = 'DEFEAT';
        else if (this.state === 'playing') statusText.textContent = 'Wave Active';
        else statusText.textContent = 'Ready?';
    }

    restart(scene) {
        // Cleanup existing entities (Gemini Feedback)
        for (const tower of this.towers) tower.remove();
        for (const enemy of this.enemies) enemy.die();
        for (const proj of this.projectiles) proj.die();

        this.state = 'idle';
        this.wave = 0;
        this.lives = GameConfig.player.initialLives;
        this.money = GameConfig.player.initialMoney;
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.timeSinceLastWave = 0;
        this.enemiesSpawnedThisWave = 0;
        this.timeSinceLastSpawn = 0;
        this.updateUI();
    }
}
