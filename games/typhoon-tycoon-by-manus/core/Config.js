/**
 * Game Configuration Constants
 * LLM-Model: gpt-4.1-mini
 */
export const Config = {
    WORLD: {
        SIZE: 30,
        GRID_SIZE: 15,
        CELL_SIZE: 2,
        ISLAND_RADIUS: 5
    },
    CAMERA: {
        FOV: 45,
        NEAR: 0.1,
        FAR: 1000,
        POSITION: { x: 22, y: 22, z: 22 }
    },
    PLAYER: {
        INITIAL_HSI: 5000,
        INITIAL_FUNDS: 2000,
        INITIAL_POWER: 10,
        PASSIVE_INCOME_BASE: 5
    },
    ENEMY: {
        BASE_HP: 100,
        BASE_SPEED: 4,
        BASE_DAMAGE: 500,
        REWARD: 100,
        SPAWN_INTERVAL: 1.5
    },
    WAVE: {
        DURATION: 30,
        MAX_YEARS: 10,
        COUNT_FUNC: (year) => 3 + year * 2,
        HP_MULT_FUNC: (year) => 1 + (year - 1) * 0.5,
        SPEED_MULT_FUNC: (year) => 1 + (year - 1) * 0.1
    },
    STRUCTURES: {
        PowerPlant: {
            name: 'Power Plant',
            cost: 1000,
            powerGen: 15,
            powerUsage: 0,
            isLandOnly: true,
            color: 0x4caf50,
            description: 'Generates electricity.'
        },
        LaserTower: {
            name: 'Laser Tower',
            cost: 500,
            powerGen: 0,
            powerUsage: 3,
            isLandOnly: false,
            range: 8,
            damage: 35,
            attackSpeed: 2.5,
            color: 0x2196f3,
            description: 'Rapid fire lasers.'
        },
        FreezeTower: {
            name: 'Freeze Tower',
            cost: 800,
            powerGen: 0,
            powerUsage: 5,
            isLandOnly: false,
            range: 6,
            damage: 10,
            attackSpeed: 3.0,
            slowFactor: 0.6,
            color: 0x00bcd4,
            description: 'Slows down typhoons.'
        },
        RepelTower: {
            name: 'Repel Tower',
            cost: 2500,
            powerGen: 0,
            powerUsage: 10,
            isLandOnly: false,
            range: 12,
            damage: 180,
            attackSpeed: 0.6,
            color: 0xff9800,
            description: 'High damage repulsion.'
        }
    }
};
