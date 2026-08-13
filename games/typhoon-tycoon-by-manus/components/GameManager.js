import { GameConfig } from './GameConfig.js';
import { Enemy } from './Enemy.js';
import { Tower } from './Tower.js';
import { VisualEffects } from './VisualEffects.js';
import * as THREE from 'three';

export class GameManager {
    constructor(scene, map) {
        this.scene = scene;
        this.map = map;
        this.effects = new VisualEffects(scene);
        
        this.state = 'idle';
        this.year = 0;
        this.hsi = GameConfig.player.initialHSI;
        this.money = GameConfig.player.initialMoney;
        this.powerMax = GameConfig.player.initialPower;
        this.powerUsed = 0;
        
        this.enemies = [];
        this.towers = [];
        
        this.yearTimer = 0;
        this.spawnTimer = 0;
        this.enemiesSpawnedInYear = 0;
        
        this.incomeTimer = 0;
    }

    startGame() {
        this.state = 'playing';
        this.year = 1;
        this.yearTimer = GameConfig.wave.yearDuration;
        this.updateUI();
    }

    update(dt, currentTime, camera) {
        this.effects.update(dt);
        if (this.state !== 'playing') return;

        // Passive Income
        this.incomeTimer += dt;
        if (this.incomeTimer >= 1) {
            let income = Math.floor(this.hsi / 1000) * 2 + GameConfig.player.passiveIncome;
            
            // Bonuses from buildings
            const uniCount = this.towers.filter(t => t.type === 'Uni').length;
            const researchCount = this.towers.filter(t => t.type === 'Research').length;
            income += uniCount * 10;
            this.money += income;
            
            this.incomeTimer = 0;
            this.updateUI();
        }

        // Year/Wave Logic
        this.yearTimer -= dt;
        if (this.yearTimer <= 0) {
            this.nextYear();
        }

        // Spawning
        if (this.enemiesSpawnedInYear < GameConfig.wave.enemyCountPerYear(this.year)) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy();
                this.enemiesSpawnedInYear++;
                this.spawnTimer = GameConfig.enemy.spawnInterval;
            }
        }

        // Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const reachedCenter = this.enemies[i].update(dt, camera);
            if (reachedCenter) {
                this.hsi -= GameConfig.enemy.baseDamage;
                this.enemies.splice(i, 1);
                if (this.hsi <= 0) {
                    this.hsi = 0;
                    this.gameOver('lost');
                }
                this.updateUI();
            } else if (!this.enemies[i].alive) {
                this.money += GameConfig.enemy.reward;
                this.enemies.splice(i, 1);
                this.updateUI();
            }
        }

        // Update Towers
        const hasPower = this.powerUsed <= this.powerMax;
        for (const tower of this.towers) {
            tower.update(dt, this.enemies, currentTime, hasPower);
        }
    }

    spawnEnemy() {
        const enemy = new Enemy(this.scene, this.effects, this.year);
        this.enemies.push(enemy);
    }

    nextYear() {
        if (this.year >= GameConfig.wave.maxYears) {
            this.gameOver('won');
            return;
        }
        this.year++;
        this.yearTimer = GameConfig.wave.yearDuration;
        this.enemiesSpawnedInYear = 0;
        this.updateUI();
    }

    placeStructure(wx, wz, type) {
        if (!this.map.isReady) return false;
        if (!this.map.isValidPlacement(wx, wz, type)) return false;
        
        const config = GameConfig.structures[type];
        if (this.money < config.cost) return false;

        const cell = this.map.getGridCell(wx, wz);
        const pos = new THREE.Vector3(cell.wx, 0, cell.wz);
        
        const tower = new Tower(this.scene, pos, type, config, this.effects);
        this.towers.push(tower);
        cell.occupied = tower;
        
        this.money -= config.cost;
        if (config.powerGen) this.powerMax += config.powerGen;
        if (config.powerUsage) this.powerUsed += config.powerUsage;
        
        this.updateUI();
        return true;
    }

    updateUI() {
        document.getElementById('year-val').textContent = this.year;
        document.getElementById('hsi-val').textContent = this.hsi;
        document.getElementById('money-val').textContent = this.money;
        
        const powerFill = document.getElementById('power-fill');
        const powerText = document.getElementById('power-text');
        const ratio = Math.min(1, this.powerUsed / this.powerMax);
        powerFill.style.width = `${ratio * 100}%`;
        powerText.textContent = `${this.powerUsed} / ${this.powerMax}`;
        
        if (this.powerUsed > this.powerMax) {
            powerFill.style.backgroundColor = '#ff4444';
        } else {
            powerFill.style.backgroundColor = '#00ffcc';
        }
    }

    gameOver(status) {
        this.state = status;
        const overlay = document.getElementById('game-over-overlay');
        const title = document.getElementById('game-over-title');
        overlay.style.display = 'flex';
        title.textContent = status === 'won' ? 'VICTORY' : 'CITY DESTROYED';
    }

    restart() {
        this.towers.forEach(t => t.remove());
        this.enemies.forEach(e => e.die(false));
        this.effects.clear();
        this.map.grid.forEach(c => c.occupied = null);
        
        this.state = 'idle';
        this.year = 0;
        this.hsi = GameConfig.player.initialHSI;
        this.money = GameConfig.player.initialMoney;
        this.powerMax = GameConfig.player.initialPower;
        this.powerUsed = 0;
        this.enemies = [];
        this.towers = [];
        
        document.getElementById('game-over-overlay').style.display = 'none';
        this.startGame();
    }
}
