import type { ConfigValues } from './types';

export const mobileDefaults: ConfigValues = {
  turret: {
    rotationSpeed: 0.03,
    bulletSpeed: 5.5,
    bulletSpread: 9,
    fireRate: 10,
    heatPerShot: 10,
    heatDecay: 0.3,
    overheatCooldown: 120,
  },
  helicopter: {
    speed: 1.5,
    waveSpeedBonus: 0.1,
  },
  paratrooper: {
    fallSpeed: 0.8,
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
