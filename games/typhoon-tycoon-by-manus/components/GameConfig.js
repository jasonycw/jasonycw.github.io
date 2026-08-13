export const GameConfig = {
    // World settings
    world: {
        mapSize: 30,
        gridSize: 15, // 15x15 grid
        cellSize: 2,
        islandRadius: 5
    },

    // Camera settings
    camera: {
        fov: 45,
        position: { x: 20, y: 20, z: 20 },
        lookAt: { x: 0, y: 0, z: 0 }
    },

    // Enemy (Typhoon) settings
    enemy: {
        baseHP: 100,
        baseSpeed: 4,
        baseDamage: 500, // Damage to HSI
        reward: 100,
        spawnInterval: 1.5 // seconds
    },

    // Wave (Year) settings
    wave: {
        initialDelay: 5,
        yearDuration: 30,
        maxYears: 10,
        enemyCountPerYear: (year) => 3 + year * 2,
        healthMultiplier: (year) => 1 + (year - 1) * 0.5,
        speedMultiplier: (year) => 1 + (year - 1) * 0.1
    },

    // Player settings
    player: {
        initialHSI: 5000,
        initialMoney: 2000,
        initialPower: 10,
        passiveIncome: 5 // per second
    },

    // Structure settings
    structures: {
        PowerPlant: {
            name: 'Power Plant',
            cost: 1000,
            powerGen: 15,
            powerUsage: 0,
            isLandOnly: true,
            color: 0x4caf50,
            description: 'Generates power for your towers.'
        },
        LaserTower: {
            name: 'Laser Tower',
            cost: 500,
            powerGen: 0,
            powerUsage: 3,
            isLandOnly: false,
            range: 8,
            damage: 30,
            attackSpeed: 2, // attacks per second
            color: 0x2196f3,
            description: 'Standard defense. Shoots rapid lasers.'
        },
        FreezeTower: {
            name: 'Freeze Tower',
            cost: 800,
            powerGen: 0,
            powerUsage: 5,
            isLandOnly: false,
            range: 6,
            damage: 10,
            attackSpeed: 3,
            slowFactor: 0.5,
            color: 0x00bcd4,
            description: 'Slows down incoming typhoons.'
        },
        RepelTower: {
            name: 'Repel Tower',
            cost: 2500,
            powerGen: 0,
            powerUsage: 10,
            isLandOnly: false,
            range: 12,
            damage: 150,
            attackSpeed: 0.5,
            color: 0xff9800,
            description: 'High damage and long range.'
        }
    }
};
