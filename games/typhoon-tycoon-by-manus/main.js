import { Engine } from './core/Engine.js';
import { Assets } from './core/Assets.js';
import { Game } from './core/Game.js';
import { Map } from './world/Map.js';
import { HUD } from './ui/HUD.js';

/**
 * Typhoon Tycoon 2.5D: Superior Edition
 * Main Entry Point
 * LLM-Model: gpt-4.1-mini
 */
async function bootstrap() {
    console.log("Initializing Typhoon Tycoon 2.5D: Superior Edition...");

    const assets = new Assets();
    await assets.loadAll();

    const engine = new Engine();
    const map = new Map(engine.scene, assets);
    
    const ui = new HUD(
        () => game.start(),
        () => game.restart()
    );

    const game = new Game(engine, assets, map, ui);

    engine.onUpdate = (dt, currentTime) => game.update(dt, currentTime);
    engine.onInteraction = (event) => game.handleInteraction(event);

    engine.start();
}

bootstrap().catch(err => {
    console.error("Critical initialization failure:", err);
});
