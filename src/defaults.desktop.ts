import type { ConfigValues } from "./types";

export const desktopDefaults: ConfigValues = {
  turret: {
    rotationSpeed: 0.015,
    bulletSpeed: 2.5,
    bulletSpread: 4.5,
    fireRate: 14,
    heatPerShot: 13,
    heatDecay: 0.5,
    overheatCooldown: 120,
  },
  helicopter: {
    speed: 0.6,
    waveSpeedBonus: 0.05,
  },
  paratrooper: {
    fallSpeed: 0.6,
    maxDrift: 1.6,
    maxLanded: 4,
  },
  jet: {
    speed: 1,
    waveSpeedBonus: 0.1,
  },
  bomb: {
    fallSpeed: 0.5,
    maxDrift: 1.1,
  },
  game: {
    gravity: 0.035,
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
