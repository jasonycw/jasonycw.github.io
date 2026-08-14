import { Config } from '../core/Config.js';

/**
 * Professional Game UI Manager with event feedback.
 * LLM-Model: deepseek-v4-flash-free
 */
export class HUD {
    constructor(onStart, onRestart) {
        this.selectedStructure = 'LaserTower';
        this.locks = {};
        this.initToolbar();
        this.initOverlays(onStart, onRestart);
    }

    initToolbar() {
        const toolbar = document.getElementById('toolbar');
        toolbar.innerHTML = '';
        Object.entries(Config.STRUCTURES).forEach(([key, config]) => {
            const button = document.createElement('button');
            button.className = 'tool-btn';
            button.id = `btn-${key}`;
            if (key === this.selectedStructure) button.classList.add('active');

            const spriteFile = {
                PowerPlant: 'power-plant.png',
                LaserTower: 'laser-tower.png',
                University: 'university.png',
                FreezeTower: 'freeze-tower.png',
                ResearchCenter: 'research-center.png',
                RepelTower: 'repel-tower.png',
                NuclearPlant: 'nuclear.png',
                CheungKong: 'ckh.png'
            }[key];

            button.innerHTML = `
                <div class="icon-container">
                    <img src="assets/sprites/${spriteFile}" class="icon-img" alt="${config.name}">
                    <div class="lock-overlay" aria-hidden="true">LOCK</div>
                </div>
                <div class="details">
                    <span class="name">${config.name}</span>
                    <span class="cost">$${config.cost}</span>
                </div>
                <div class="tooltip">
                    <strong>${config.name}</strong><br>
                    ${config.description}<br>
                    ${config.req ? `<span class="req">Requires: ${Config.STRUCTURES[config.req].name}</span>` : ''}
                </div>
            `;

            button.addEventListener('click', () => {
                if (this.locks[key]) {
                    this.showEvent('BLUEPRINT LOCKED', `Build ${Config.STRUCTURES[config.req].name} first.`);
                    return;
                }
                this.selectedStructure = key;
                document.querySelectorAll('.tool-btn').forEach(tool => tool.classList.remove('active'));
                button.classList.add('active');
                this.showEvent('BUILD MODE', `${config.name} selected. Click a valid ${config.isLandOnly ? 'land' : 'sea'} cell.`);
            });
            toolbar.appendChild(button);
        });
    }

    initOverlays(onStart, onRestart) {
        document.getElementById('start-btn').onclick = () => {
            document.getElementById('start-overlay').style.display = 'none';
            onStart();
        };
        document.getElementById('restart-btn').onclick = () => {
            document.getElementById('game-over-overlay').style.display = 'none';
            onRestart();
        };
    }

    updateLocks(locks) {
        this.locks = locks;
        Object.entries(locks).forEach(([key, isLocked]) => {
            const button = document.getElementById(`btn-${key}`);
            if (button) button.classList.toggle('locked', isLocked);
        });
    }

    updateStats(stats) {
        document.getElementById('year-val').textContent = stats.year;
        document.getElementById('hsi-val').textContent = stats.hsi;
        document.getElementById('money-val').textContent = stats.funds;
        const powerFill = document.getElementById('power-fill');
        const powerText = document.getElementById('power-text');
        const ratio = stats.powerMax > 0 ? Math.min(1, stats.powerUsed / stats.powerMax) : 1;
        powerFill.style.width = `${ratio * 100}%`;
        powerText.textContent = `${stats.powerUsed} / ${stats.powerMax}`;
        const overloaded = stats.powerUsed > stats.powerMax;
        powerFill.style.backgroundColor = overloaded ? '#ff4444' : '#00ffcc';
        powerText.style.color = overloaded ? '#ff4444' : '#00ffcc';
    }

    showEvent(title, message) {
        const titleElement = document.getElementById('event-title');
        const messageElement = document.getElementById('event-message');
        const log = document.getElementById('event-log');
        if (!titleElement || !messageElement || !log) return;
        titleElement.textContent = title;
        messageElement.textContent = message;
        log.classList.remove('pulse');
        void log.offsetWidth;
        log.classList.add('pulse');
    }

    showGameOver(title) {
        const overlay = document.getElementById('game-over-overlay');
        document.getElementById('game-over-title').textContent = title;
        overlay.style.display = 'flex';
    }
}
