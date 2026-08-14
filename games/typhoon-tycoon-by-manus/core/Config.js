/**
 * Game Configuration Constants
 * LLM-Model: deepseek-v4-flash-free
 */
export const Config = {
    WORLD: {
        SIZE: 40,
        GRID_SIZE: 20,
        CELL_SIZE: 2,
        ISLAND_RADIUS: 8
    },
    CAMERA: {
        FOV: 45,
        NEAR: 0.1,
        FAR: 1000,
        POSITION: { x: 30, y: 30, z: 30 }
    },
    PLAYER: {
        INITIAL_HSI: 5000,
        INITIAL_FUNDS: 3000,
        INITIAL_POWER: 20,
        PASSIVE_INCOME_BASE: 10
    },
    ENEMY: {
        BASE_HP: 200,
        BASE_SPEED: 5,
        BASE_DAMAGE: 150,
        REWARD: 150,
        SPAWN_INTERVAL: 4.5
    },
    WAVE: {
        DURATION: 36,
        MAX_YEARS: 20,
        COUNT_FUNC: (year) => 2 + Math.floor(year * 1.5),
        HP_MULT_FUNC: (year) => 1 + (year - 1) * 0.4,
        SPEED_MULT_FUNC: (year) => 1 + (year - 1) * 0.05
    },
    STRUCTURES: {
        PowerPlant: {
            name: 'Power Plant',
            cost: 1000,
            powerGen: 10,
            powerUsage: 0,
            isLandOnly: true,
            color: 0x4caf50,
            sprite: 'sprite-power',
            description: 'Simple power plant.'
        },
        LaserTower: {
            name: 'Laser Tower',
            cost: 500,
            powerGen: 0,
            powerUsage: 3,
            isLandOnly: false,
            range: 10,
            damage: 25,
            attackSpeed: 2.0,
            color: 0x2196f3,
            sprite: 'sprite-laser',
            description: 'Shoots laser beam.'
        },
        University: {
            name: 'University',
            cost: 2500,
            powerGen: 0,
            powerUsage: 20,
            isLandOnly: true,
            color: 0x9c27b0,
            sprite: 'sprite-university',
            description: 'Unlocks Freeze Tower. Buffs Laser Tower.',
            req: null
        },
        FreezeTower: {
            name: 'Freeze Tower',
            cost: 700,
            powerGen: 0,
            powerUsage: 6,
            isLandOnly: false,
            range: 8,
            damage: 5,
            attackSpeed: 1.5,
            slowFactor: 0.5,
            color: 0x00bcd4,
            sprite: 'sprite-freeze',
            description: 'Slows down typhoons.',
            req: 'University'
        },
        ResearchCenter: {
            name: 'Research Center',
            cost: 4000,
            powerGen: 0,
            powerUsage: 30,
            isLandOnly: true,
            color: 0xff9800,
            sprite: 'sprite-research',
            description: 'Unlocks Repel Tower & Nuclear Plant.',
            req: 'University'
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
            repelForce: 5,
            color: 0xff5722,
            sprite: 'sprite-repel',
            description: 'Repels typhoons.',
            req: 'ResearchCenter'
        },
        NuclearPlant: {
            name: 'Nuclear Power Plant',
            cost: 5000,
            powerGen: 40,
            powerUsage: 0,
            isLandOnly: true,
            color: 0x8bc34a,
            sprite: 'sprite-nuclear',
            description: 'Produces lots of power.',
            req: 'ResearchCenter'
        },
        CheungKong: {
            name: 'Li\'s Enterprise',
            cost: 7000,
            powerGen: 0,
            powerUsage: 50,
            isLandOnly: true,
            color: 0xf44336,
            sprite: 'sprite-ckh',
            description: '50% more income. Buffs Repel Tower.',
            req: 'ResearchCenter'
        }
    }
};
