import * as THREE from 'three';
import { Config } from './Config.js';
import { Enemy } from '../entities/Enemy.js';
import { Tower } from '../entities/Tower.js';
import { Effects } from '../entities/Effects.js';

/**
 * Main Game Controller with wave economy and hazard events.
 * LLM-Model: deepseek-v4-flash-free
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
        this.marketTimer = 3;
        this.earthquakeTimer = 18;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.buffs = this.createEmptyBuffs();
    }

    createEmptyBuffs() {
        return {
            laserDamage: 0,
            laserRange: 0,
            freezeDamage: 0,
            freezeRange: 0,
            repelRange: 0,
            repelForce: 0,
            incomeMult: 1
        };
    }

    start() {
        this.state = 'playing';
        this.year = 1;
        this.yearTimer = Config.WAVE.DURATION;
        this.spawnTimer = 1.5;
        this.enemiesSpawnedInYear = 0;
        this.marketTimer = 3;
        this.earthquakeTimer = 18;
        this.ui.showEvent('DEFENSE WINDOW OPEN', 'Build on land and sea before the first wave reaches Hong Kong.');
        this.updateHUD();
    }

    update(dt, currentTime) {
        this.effects.update(dt);
        this.map.update(dt, currentTime);
        if (this.state !== 'playing') return;

        this.updateEconomy(dt);
        this.updateEvents(dt);
        this.updateWave(dt);
        this.updateEnemies(dt);

        const hasPower = this.powerUsed <= this.powerMax;
        this.towers.forEach(tower => tower.update(dt, this.enemies, currentTime, hasPower, this.buffs));
    }

    updateEconomy(dt) {
        this.incomeTimer += dt;
        if (this.incomeTimer >= 1) {
            const baseIncome = Math.floor(Math.max(0, this.hsi) / 1000) * 2 + Config.PLAYER.PASSIVE_INCOME_BASE;
            this.funds += Math.floor(baseIncome * this.buffs.incomeMult);
            this.incomeTimer = 0;
            this.updateHUD();
        }

        this.marketTimer -= dt;
        if (this.marketTimer <= 0) {
            const marketDelta = (Math.floor(Math.random() * 21) - 10) * 15;
            this.hsi = Math.max(0, Math.min(10000, this.hsi + marketDelta));
            const direction = marketDelta >= 0 ? 'market rally' : 'market correction';
            this.ui.showEvent(direction.toUpperCase(), `${marketDelta >= 0 ? '+' : ''}${marketDelta} HSI from live market movement.`);
            this.marketTimer = 8 + Math.random() * 5;
            this.updateHUD();
        }
    }

    updateEvents(dt) {
        this.earthquakeTimer -= dt;
        if (this.earthquakeTimer > 0) return;

        this.effects.spawnQuake(new THREE.Vector3(0, 0, 0));
        const candidates = this.towers.filter(tower => tower.config.isLandOnly);
        if (candidates.length > 0 && Math.random() < 0.45) {
            const victim = candidates[Math.floor(Math.random() * candidates.length)];
            this.destroyStructure(victim, 'EARTHQUAKE');
        } else {
            this.ui.showEvent('EARTHQUAKE WARNING', 'The ground shook, but your infrastructure held.');
        }
        this.earthquakeTimer = 26 + Math.random() * 16;
    }

    updateWave(dt) {
        this.yearTimer -= dt;
        if (this.yearTimer <= 0) this.nextYear();

        if (this.enemiesSpawnedInYear >= Config.WAVE.COUNT_FUNC(this.year)) return;
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.enemies.push(new Enemy(this.engine.scene, this.assets, this.effects, this.year));
            this.enemiesSpawnedInYear += 1;
            this.spawnTimer = Config.ENEMY.SPAWN_INTERVAL;
        }
    }

    updateEnemies(dt) {
        let hsiChanged = false;
        for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
            const enemy = this.enemies[index];
            const reachedCenter = enemy.update(dt, this.engine.camera);
            if (reachedCenter) {
                this.hsi = Math.max(0, this.hsi - Config.ENEMY.BASE_DAMAGE);
                this.enemies.splice(index, 1);
                hsiChanged = true;
                if (this.hsi <= 0) {
                    this.gameOver('lost');
                    return;
                }
            } else if (!enemy.alive) {
                this.funds += Config.ENEMY.REWARD;
                this.enemies.splice(index, 1);
                hsiChanged = true;
            }
        }
        if (hsiChanged) this.updateHUD();
    }

    nextYear() {
        if (this.year >= Config.WAVE.MAX_YEARS) {
            this.gameOver('won');
            return;
        }
        this.year += 1;
        this.hsi = Math.min(10000, this.hsi + 150);
        this.yearTimer = Config.WAVE.DURATION;
        this.spawnTimer = 3;
        this.enemiesSpawnedInYear = 0;
        this.ui.showEvent(`YEAR ${this.year}`, 'Hong Kong receives a recovery dividend. New storm systems are forming.');
        this.updateHUD();
    }

    handleInteraction(event) {
        if (this.state !== 'playing') return;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.engine.camera);
        const intersects = this.raycaster.intersectObject(this.map.mesh);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.placeStructure(point.x, point.z);
        }
    }

    placeStructure(worldX, worldZ) {
        const type = this.ui.selectedStructure;
        const config = Config.STRUCTURES[type];
        if (!config) return;

        if (config.req && !this.towers.some(tower => tower.type === config.req)) {
            this.ui.showEvent('LOCKED BLUEPRINT', `${config.name} requires ${Config.STRUCTURES[config.req].name}.`);
            return;
        }
        if (!this.map.isValidPlacement(worldX, worldZ, type)) {
            this.ui.showEvent('INVALID SITE', config.isLandOnly ? 'This structure needs a clear land cell.' : 'This tower needs a clear sea cell.');
            return;
        }
        if (this.funds < config.cost) {
            this.ui.showEvent('INSUFFICIENT FUNDS', `${config.name} requires $${config.cost}.`);
            return;
        }

        const cell = this.map.getGridCell(worldX, worldZ);
        const position = new THREE.Vector3(cell.wx, 0, cell.wz);
        const tower = new Tower(this.engine.scene, position, type, this.assets, this.effects);
        tower.cell = cell;
        this.towers.push(tower);
        cell.occupied = tower;
        this.funds -= config.cost;
        this.powerMax += config.powerGen || 0;
        this.powerUsed += config.powerUsage || 0;
        this.updateBuffs();
        this.ui.showEvent('STRUCTURE ONLINE', `${config.name} deployed at grid ${cell.x}, ${cell.z}.`);
        this.updateHUD();
    }

    destroyStructure(tower, reason) {
        const index = this.towers.indexOf(tower);
        if (index < 0) return;
        if (tower.cell) tower.cell.occupied = null;
        this.towers.splice(index, 1);
        this.powerMax -= tower.config.powerGen || 0;
        this.powerUsed -= tower.config.powerUsage || 0;
        this.powerMax = Math.max(0, this.powerMax);
        this.powerUsed = Math.max(0, this.powerUsed);
        this.effects.spawnBurst(tower.group.position, 0xffd166, 22);
        tower.dispose();
        this.updateBuffs();
        this.ui.showEvent(`${reason} DAMAGE`, `${tower.config.name} was destroyed. Rebuild the grid.`);
        this.updateHUD();
    }

    updateBuffs() {
        this.buffs = this.createEmptyBuffs();
        this.towers.forEach(tower => {
            if (tower.type === 'University') {
                this.buffs.laserDamage += 5;
                this.buffs.laserRange += 5;
            } else if (tower.type === 'ResearchCenter') {
                this.buffs.laserDamage += 3;
                this.buffs.laserRange += 10;
                this.buffs.freezeDamage += 0.5;
                this.buffs.freezeRange += 10;
            } else if (tower.type === 'CheungKong') {
                this.buffs.incomeMult = 1.5;
                this.buffs.repelRange += 20;
                this.buffs.repelForce += 7;
            }
        });
    }

    updateHUD() {
        this.ui.updateStats({
            year: this.year,
            hsi: Math.round(this.hsi),
            funds: Math.round(this.funds),
            powerUsed: Math.round(this.powerUsed),
            powerMax: Math.round(this.powerMax)
        });
        const locks = {};
        Object.keys(Config.STRUCTURES).forEach(type => {
            const requirement = Config.STRUCTURES[type].req;
            locks[type] = requirement ? !this.towers.some(tower => tower.type === requirement) : false;
        });
        this.ui.updateLocks(locks);
    }

    gameOver(status) {
        this.state = status;
        this.ui.showGameOver(status === 'won' ? 'VICTORY' : 'CITY DESTROYED');
    }

    restart() {
        this.towers.forEach(tower => tower.dispose());
        this.enemies.forEach(enemy => enemy.die(false));
        this.effects.clear();
        this.map.grid.forEach(cell => { cell.occupied = null; });
        this.hsi = Config.PLAYER.INITIAL_HSI;
        this.funds = Config.PLAYER.INITIAL_FUNDS;
        this.powerMax = Config.PLAYER.INITIAL_POWER;
        this.powerUsed = 0;
        this.enemies = [];
        this.towers = [];
        this.year = 0;
        this.buffs = this.createEmptyBuffs();
        this.start();
    }
}
