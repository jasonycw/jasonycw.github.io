// Enhanced Game configuration and constants
export const GameConfig = {
    // Map and path configuration
    map: {
        width: 400,
        height: 400,
        groundColor: 0x228B22,
        seaColor: 0x006994,
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
        maxHP: 100,
        speed: 35, 
        damage: 1, 
        reward: 50,
        spawnInterval: 1200 // ms
    },

    // Wave/Year configuration
    wave: {
        initialDelay: 5,
        waveInterval: 10,
        maxWaves: 20,
        enemyCountPerWave: (waveNumber) => 3 + Math.floor(waveNumber * 1.5),
        enemyHealthMultiplier: (waveNumber) => 1 + (waveNumber * 0.3),
    },

    // Player configuration
    player: {
        initialLives: 10,
        initialMoney: 1500,
        initialPower: 50,
        maxPower: 100,
    },

    // Tower configuration
    tower: {
        basicTower: {
            name: 'Laser Tower',
            type: 'LaserTower',
            cost: 500,
            powerUsage: 3,
            range: 70,
            damage: 25,
            attackSpeed: 2.0,
            color: 0xFF3333,
            projectileSpeed: 200,
            description: 'Shoots rapid lasers at typhoons.'
        },
        rapidTower: {
            name: 'Freeze Tower',
            type: 'FreezeTower',
            cost: 800,
            powerUsage: 5,
            range: 60,
            damage: 8,
            attackSpeed: 4.0,
            color: 0x33FFFF,
            projectileSpeed: 250,
            description: 'High fire rate, slows down targets.'
        },
        heavyTower: {
            name: 'Repel Tower',
            type: 'RepelTower',
            cost: 2000,
            powerUsage: 12,
            range: 120,
            damage: 150,
            attackSpeed: 0.6,
            color: 0xFFAA33,
            projectileSpeed: 120,
            description: 'Massive damage with long range.'
        },
        powerPlant: {
            name: 'Power Plant',
            type: 'PowerPlant',
            cost: 1000,
            powerGen: 15,
            color: 0x33FF33,
            description: 'Generates power for your towers.'
        }
    },

    // Game win/lose conditions
    gameEnd: {
        waveToWin: 20,
    },
};
