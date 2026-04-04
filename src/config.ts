import type { Settings, SettingsCategory, PowerUpDef } from './types';

export const isMobile: boolean = typeof navigator !== 'undefined'
  && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches));

export const settings: Settings = {
  turret: {
    rotationSpeed: { val: 0.03, min: 0.01, max: 0.1, step: 0.005, label: 'Rotation Speed' },
    bulletSpeed: { val: 8, min: 2, max: 20, step: 0.5, label: 'Bullet Speed' },
    bulletSpread: { val: 5, min: 0, max: 15, step: 0.5, label: 'Bullet Spread (deg)' },
    fireRate: { val: 8, min: 2, max: 30, step: 1, label: 'Fire Rate (frames)' },
    heatPerShot: { val: 8, min: 1, max: 25, step: 1, label: 'Heat Per Shot' },
    heatDecay: { val: 0.4, min: 0.1, max: 2, step: 0.1, label: 'Heat Decay' },
    overheatCooldown: { val: 120, min: 30, max: 300, step: 10, label: 'Overheat Cooldown' },
  },
  helicopter: {
    speed: { val: 1.5, min: 0.3, max: 5, step: 0.1, label: 'Speed' },
    waveSpeedBonus: { val: 0.1, min: 0, max: 0.5, step: 0.05, label: 'Speed +/Wave' },
  },
  paratrooper: {
    fallSpeed: { val: 0.5, min: 0.1, max: 2, step: 0.05, label: 'Fall Speed' },
    maxDrift: { val: 1.5, min: 0.3, max: 4, step: 0.1, label: 'Max Drift' },
    maxLanded: { val: 4, min: 1, max: 10, step: 1, label: 'Max Landed (per side)' },
  },
  jet: {
    speed: { val: 4, min: 1, max: 10, step: 0.5, label: 'Speed' },
    waveSpeedBonus: { val: 0.3, min: 0, max: 1, step: 0.1, label: 'Speed +/Wave' },
  },
  bomb: {
    fallSpeed: { val: 0.8, min: 0.2, max: 3, step: 0.1, label: 'Fall Speed' },
    maxDrift: { val: 1, min: 0.2, max: 3, step: 0.1, label: 'Max Drift' },
  },
  game: {
    gravity: { val: 0.04, min: 0.01, max: 0.15, step: 0.005, label: 'Gravity' },
    comboWindow: { val: 45, min: 10, max: 120, step: 5, label: 'Combo Window (frames)' },
    powerupInterval: { val: 600, min: 200, max: 1500, step: 50, label: 'Powerup Interval' },
  },
};

// Apply mobile difficulty adjustments
if (isMobile) {
  settings.turret.bulletSpeed.val = 5.5;
  settings.turret.bulletSpread.val = 9;
  settings.turret.fireRate.val = 10;
  settings.turret.heatPerShot.val = 10;
  settings.turret.heatDecay.val = 0.3;
  settings.paratrooper.fallSpeed.val = 0.8;
}

export function S<C extends SettingsCategory>(category: C, key: keyof Settings[C]): number {
  return (settings[category][key] as { val: number }).val;
}

export const settingsCategories: SettingsCategory[] = Object.keys(settings) as SettingsCategory[];

export const GUN_LENGTH: number = 30;
export const MAX_HEAT: number = 100;
export const POWERUP_DURATION: number = 480;
export const POWERUP_TYPES: readonly PowerUpDef[] = [
  { type: 'triple', label: 'TRIPLE SHOT', color: '#4af', symbol: '3' },
  { type: 'explosive', label: 'EXPLOSIVE', color: '#f84', symbol: 'E' },
  { type: 'rapid', label: 'RAPID FIRE', color: '#4f4', symbol: 'R' },
  { type: 'freeze', label: 'FREEZE', color: '#aef', symbol: 'F' },
  { type: 'nuke', label: 'NUKE!', color: '#f4f', symbol: 'N' },
] as const;
