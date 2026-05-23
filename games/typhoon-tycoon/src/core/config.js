// ==================== CONFIGURATION ====================
export const WIN_YEAR = 20; // Survive this many years to win

export const CONFIG = {
  // Map
  mapSize: 30, // world units
  cellSize: 2,
  islandRadius: 4.5, // center island radius
  groundY: 0, // ground plane Y
  islandHeight: 0.8, // building placement Y offset

  // HSI (currency + health)
  hsiInit: 5000,
  hsiPassiveRate: 150, // per second
  hsiRandomMin: -10,
  hsiRandomMax: 10,
  hsiDamagePerTyphoon: 150,
  hsiTyphoonEffectRadius: 8,

  // Enemies
  enemyBaseHP: 100,
  enemyBaseSpeed: 1.2, // slower base speed
  enemyReward: 50,
  enemySpawnRadius: 16, // beyond grid bounds → guaranteed sea spawn (|cx|>7 returns sea)
  enemyHitRange: 1.2,
  killRewardHSI: 80,

  // Waves
  waveInitDelay: 10, // seconds before first wave
  waveSpawnInterval: 5,

  // Structures
  structures: {
    LaserTower: {
      title: 'Laser Tower', power: -3, cost: 500, range: 8, damage: 25,
      req: null, builtOn: 'sea', attackInterval: 0.5, color: 0x4fc3f7, radius: 0.8
    },
    FreezeTower: {
      title: 'Freeze Tower', power: -6, cost: 700, range: 5, damage: 0,
      req: 'University', builtOn: 'sea', slowAmount: 0.5, slowDuration: 2,
      attackInterval: 1.2, color: 0x81d4fa, radius: 0.8
    },
    RepelTower: {
      title: 'Repel Tower', power: -10, cost: 2500, range: 6.5, damage: 0,
      req: 'ResearchCenter', builtOn: 'sea', repelForce: 6,
      attackInterval: 1.5, color: 0xff8a65, radius: 0.8
    },
    PowerPlant: {
      title: 'Power Plant', power: 10, cost: 1000, req: null, builtOn: 'land',
      color: 0x66bb6a, radius: 1.0
    },
    NuclearPlant: {
      title: 'Nuclear Power Plant', power: 40, cost: 5000, req: 'ResearchCenter',
      builtOn: 'land', color: 0x43a047, radius: 1.2
    },
    University: {
      title: 'University', power: -20, cost: 2500, req: null, builtOn: 'land',
      color: 0x7e57c2, radius: 1.0
    },
    ResearchCenter: {
      title: 'Research Center', power: -30, cost: 4000, req: 'University',
      builtOn: 'land', color: 0xab47bc, radius: 1.0
    },
    CheungKong: {
      title: "Li's Enterprise HQ", power: -50, cost: 7000, req: 'ResearchCenter',
      builtOn: 'land', color: 0xffd54f, radius: 1.2
    }
  }
};
