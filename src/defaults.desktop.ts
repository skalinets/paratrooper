import type { ConfigValues } from './types';

export const desktopDefaults: ConfigValues = {
  turret: {
    rotationSpeed: 0.03,
    bulletSpeed: 8,
    bulletSpread: 5,
    fireRate: 8,
    heatPerShot: 8,
    heatDecay: 0.4,
    overheatCooldown: 120,
  },
  helicopter: {
    speed: 1.5,
    waveSpeedBonus: 0.1,
  },
  paratrooper: {
    fallSpeed: 0.5,
    maxDrift: 1.5,
    maxLanded: 4,
  },
  jet: {
    speed: 4,
    waveSpeedBonus: 0.3,
  },
  bomb: {
    fallSpeed: 0.8,
    maxDrift: 1,
  },
  game: {
    gravity: 0.04,
    comboWindow: 45,
    powerupInterval: 600,
    godMode: 0,
  },
  powerups: {
    duration: 720,
    missileRate: 120,
    missileSpeed: 6,
  },
};
