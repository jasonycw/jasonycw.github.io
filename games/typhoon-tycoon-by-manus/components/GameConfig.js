// Game configuration and constants
export const GameConfig = {
    // Map and path configuration
    map: {
        width: 400,
        height: 400,
        groundColor: 0x228B22,
        path: [
            { x: -180, z: -150 },
            { x: -100, z: -50 },
            { x: 0, z: 50 },
            { x: 100, z: -50 },
            { x: 180, z: 100 }
        ],
        pathWidth: 20
    },

    // Enemy configuration
    enemy: {
        maxHP: 200,
        speed: 40, 
        damage: 1, 
        reward: 50,
        spawnInterval: 1000 // ms
    },

    // Wave configuration
    wave: {
        initialDelay: 5,
        waveInterval: 8,
        maxWaves: 15,
        enemyCountPerWave: (waveNumber) => 5 + waveNumber * 2,
        enemyHealthMultiplier: (waveNumber) => 1 + (waveNumber * 0.25),
    },

    // Player configuration
    player: {
        initialLives: 10,
        initialMoney: 3000,
    },

    // Tower configuration
    tower: {
        basicTower: {
            name: 'Laser Tower',
            cost: 500,
            range: 60,
            damage: 20,
            attackSpeed: 1.5,
            color: 0xFF0000,
            projectileSpeed: 150
        },
        rapidTower: {
            name: 'Freeze Tower',
            cost: 700,
            range: 50,
            damage: 5,
            attackSpeed: 3,
            color: 0x00FFFF,
            projectileSpeed: 200
        },
        heavyTower: {
            name: 'Repel Tower',
            cost: 2500,
            range: 100,
            damage: 100,
            attackSpeed: 0.5,
            color: 0xFFA500,
            projectileSpeed: 100
        },
    },

    // Game win/lose conditions
    gameEnd: {
        waveToWin: 15,
    },
};
