import { Config } from '../core/Config.js';

/**
 * Professional Game UI Manager
 * LLM-Model: gpt-4.1-mini
 */
export class HUD {
    constructor(onStart, onRestart) {
        this.selectedStructure = 'LaserTower';
        this.initToolbar();
        this.initOverlays(onStart, onRestart);
    }

    initToolbar() {
        const toolbar = document.getElementById('toolbar');
        toolbar.innerHTML = '';

        Object.entries(Config.STRUCTURES).forEach(([key, config]) => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            if (key === this.selectedStructure) btn.classList.add('active');
            
            btn.innerHTML = `
                <div class="icon" style="background-color: #${config.color.toString(16).padStart(6, '0')}"></div>
                <div class="details">
                    <span class="name">${config.name}</span>
                    <span class="cost">$${config.cost}</span>
                </div>
            `;
            
            btn.onclick = () => {
                this.selectedStructure = key;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            toolbar.appendChild(btn);
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

    updateStats(stats) {
        document.getElementById('year-val').textContent = stats.year;
        document.getElementById('hsi-val').textContent = stats.hsi;
        document.getElementById('money-val').textContent = stats.funds;
        
        const powerFill = document.getElementById('power-fill');
        const powerText = document.getElementById('power-text');
        const ratio = Math.min(1, stats.powerUsed / stats.powerMax);
        
        powerFill.style.width = `${ratio * 100}%`;
        powerText.textContent = `${stats.powerUsed} / ${stats.powerMax}`;
        powerFill.style.backgroundColor = stats.powerUsed > stats.powerMax ? '#ff4444' : '#00ffcc';
    }

    showGameOver(title) {
        const overlay = document.getElementById('game-over-overlay');
        document.getElementById('game-over-title').textContent = title;
        overlay.style.display = 'flex';
    }
}
