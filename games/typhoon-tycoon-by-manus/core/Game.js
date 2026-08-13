import * as THREE from 'three';
import { Config } from './Config.js';
import { Enemy } from '../entities/Enemy.js';
import { Tower } from '../entities/Tower.js';
import { Effects } from '../entities/Effects.js';

/**
 * Core Game Logic Manager
 * Addressing: Batch UI updates, Strategic depth, Clean logic
 * LLM-Model: gpt-4.1-mini
 */
export class Game {
    constructor(engine, assets, map, ui) {
        this.engine = engine;
        this.assets = assets;
        this.map = map;
        this.ui = ui;
        this.effects = new Effects(engine.scene);
        
        this.state = 'idle';
        this.year = 0;
        this.hsi = Config.PLAYER.INITIAL_HSI;
        this.funds = Config.PLAYER.INITIAL_FUNDS;
        this.powerMax = Config.PLAYER.INITIAL_POWER;
        this.powerUsed = 0;
        
        this.enemies = [];
        this.towers = [];
        
        this.yearTimer = 0;
        this.spawnTimer = 0;
        this.enemiesSpawnedInYear = 0;
        this.incomeTimer = 0;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    start() {
        this.state = 'playing';
        this.year = 1;
        this.yearTimer = Config.WAVE.DURATION;
        this.updateHUD();
    }

    update(dt, currentTime) {
        this.effects.update(dt);
        this.map.update(dt, currentTime);
        if (this.state !== 'playing') return;

        // Passive Income
        this.incomeTimer += dt;
        if (this.incomeTimer >= 1) {
            let income = Math.floor(this.hsi / 1000) * 2 + Config.PLAYER.PASSIVE_INCOME_BASE;
            this.funds += income;
            this.incomeTimer = 0;
            this.updateHUD();
        }

        // Year Progression
        this.yearTimer -= dt;
        if (this.yearTimer <= 0) {
            this.nextYear();
        }

        // Enemy Spawning
        if (this.enemiesSpawnedInYear < Config.WAVE.COUNT_FUNC(this.year)) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.enemies.push(new Enemy(this.engine.scene, this.assets, this.effects, this.year));
                this.enemiesSpawnedInYear++;
                this.spawnTimer = Config.ENEMY.SPAWN_INTERVAL;
            }
        }

        // Update Entities
        let hsiChanged = false;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const reachedCenter = e.update(dt, this.engine.camera);
            if (reachedCenter) {
                this.hsi -= Config.ENEMY.BASE_DAMAGE;
                this.enemies.splice(i, 1);
                hsiChanged = true;
                if (this.hsi <= 0) {
                    this.hsi = 0;
                    this.gameOver('lost');
                }
            } else if (!e.alive) {
                this.funds += Config.ENEMY.REWARD;
                this.enemies.splice(i, 1);
                this.updateHUD();
            }
        }
        if (hsiChanged) this.updateHUD();

        const hasPower = this.powerUsed <= this.powerMax;
        this.towers.forEach(t => t.update(dt, this.enemies, currentTime, hasPower));
    }

    nextYear() {
        if (this.year >= Config.WAVE.MAX_YEARS) {
            this.gameOver('won');
            return;
        }
        this.year++;
        this.yearTimer = Config.WAVE.DURATION;
        this.enemiesSpawnedInYear = 0;
        this.updateHUD();
    }

    handleInteraction(event) {
        if (this.state !== 'playing') return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.engine.camera);
        const intersects = this.raycaster.intersectObject(this.map.mapMesh);
        
        if (intersects.length > 0) {
            const p = intersects[0].point;
            this.placeStructure(p.x, p.z);
        }
    }

    placeStructure(wx, wz) {
        const type = this.ui.selectedStructure;
        if (!this.map.isValidPlacement(wx, wz, type)) return;
        
        const config = Config.STRUCTURES[type];
        if (this.funds < config.cost) return;

        const cell = this.map.getGridCell(wx, wz);
        const pos = new THREE.Vector3(cell.wx, 0, cell.wz);
        
        const tower = new Tower(this.engine.scene, pos, type, this.effects);
        this.towers.push(tower);
        cell.occupied = tower;
        
        this.funds -= config.cost;
        if (config.powerGen) this.powerMax += config.powerGen;
        if (config.powerUsage) this.powerUsed += config.powerUsage;
        
        this.updateHUD();
    }

    updateHUD() {
        this.ui.updateStats({
            year: this.year,
            hsi: this.hsi,
            funds: this.funds,
            powerUsed: this.powerUsed,
            powerMax: this.powerMax
        });
    }

    gameOver(status) {
        this.state = status;
        this.ui.showGameOver(status === 'won' ? 'VICTORY' : 'CITY DESTROYED');
    }

    restart() {
        this.towers.forEach(t => t.dispose());
        this.enemies.forEach(e => e.die(false));
        this.effects.clear();
        this.map.grid.forEach(c => c.occupied = null);
        
        this.hsi = Config.PLAYER.INITIAL_HSI;
        this.funds = Config.PLAYER.INITIAL_FUNDS;
        this.powerMax = Config.PLAYER.INITIAL_POWER;
        this.powerUsed = 0;
        this.enemies = [];
        this.towers = [];
        this.year = 0;
        
        this.start();
    }
}
