import { Engine } from './core/Engine.js';
import { Game } from './core/Game.js';
import { Map } from './world/Map.js';
import { HUD } from './ui/HUD.js';
import { Assets } from './core/Assets.js';

/**
 * Typhoon Tycoon 2.5D: Superior Edition
 * Main Entry Point
 * LLM-Model: deepseek-v4-flash-free
 */
function initRecordingPointer() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('recording')) return;
    document.body.classList.add('recording-mode');

    const cursor = document.getElementById('recording-cursor');
    const clickRing = document.getElementById('recording-click-ring');
    const label = document.getElementById('recording-action-label');
    if (!cursor || !clickRing || !label) return;

    const describeTarget = target => {
        const button = target.closest('button');
        if (button?.id === 'start-btn') return 'CLICK · INITIALIZE DEFENSE';
        if (button?.id === 'restart-btn') return 'CLICK · RETRY DEFENSE';
        if (button?.classList.contains('tool-btn')) {
            return `CLICK · ${button.querySelector('.name')?.textContent || 'BLUEPRINT'}`;
        }
        if (target.closest('#game-canvas')) return 'CLICK · MAP DEPLOY';
        return 'CLICK · UI';
    };

    const movePointer = event => {
        cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
        label.style.transform = `translate3d(${event.clientX + 18}px, ${event.clientY + 18}px, 0)`;
    };

    window.addEventListener('pointermove', movePointer, { passive: true });
    window.addEventListener('pointerdown', event => {
        clickRing.style.setProperty('--click-x', `${event.clientX}px`);
        clickRing.style.setProperty('--click-y', `${event.clientY}px`);
        clickRing.classList.remove('pulse');
        void clickRing.offsetWidth;
        clickRing.classList.add('pulse');
        label.textContent = describeTarget(event.target);
        label.classList.add('visible');
        window.setTimeout(() => label.classList.remove('visible'), 1200);
    }, { passive: true });
}

async function bootstrap() {
    console.log("Initializing Typhoon Tycoon 2.5D: Superior Edition...");
    initRecordingPointer();

    const assets = new Assets();
    await assets.loadAll();

    const engine = new Engine();
    const map = new Map(engine.scene, assets);
    
    let game;
    const ui = new HUD(
        () => { if (game) game.start(); },
        () => { if (game) game.restart(); }
    );

    game = new Game(engine, assets, map, ui);

    engine.onUpdate = (dt, currentTime) => game.update(dt, currentTime);
    engine.onInteraction = (event) => game.handleInteraction(event);

    if (new URLSearchParams(window.location.search).has('debug')) {
        window.__TYCOON__ = { assets, engine, game, map, ui };
    }

    engine.start();
}

bootstrap().catch(err => {
    console.error("Critical initialization failure:", err);
});
