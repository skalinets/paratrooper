import type { ConfigValues } from './types';

export const desktopDefaults: ConfigValues = {
  turret: {
    rotationSpeed: 0.03,
    bulletSpeed: 5,
    bulletSpread: 5,
    fireRate: 8,
    heatPerShot: 8,
    heatDecay: 0.4,
    overheatCooldown: 120,
  },
  helicopter: {
    speed: 1.3,
    waveSpeedBonus: 0.08,
  },
  paratrooper: {
    fallSpeed: 0.45,
    maxDrift: 1.5,
    maxLanded: 4,
  },
  jet: {
    speed: 3.4,
    waveSpeedBonus: 0.25,
  },
  bomb: {
    fallSpeed: 0.7,
    maxDrift: 1,
  },
  game: {
    gravity: 0.04,
    comboWindow: 45,
    powerupInterval: 600,
    godMode: 0,
    nightOnly: 0,
    dayOnly: 0,
    spotlightWidth: 0.14,
  },
  powerups: {
    duration: 720,
    missileRate: 60,
    missileSpeed: 6,
  },
};
