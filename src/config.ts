import type { Settings, SettingsCategory, PowerUpDef, ConfigValues } from './types';
import { desktopDefaults } from './defaults.desktop';
import { mobileDefaults } from './defaults.mobile';

export const isMobile: boolean = typeof navigator !== 'undefined'
  && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches));

const defaults: ConfigValues = isMobile ? mobileDefaults : desktopDefaults;

export const settings: Settings = {
  turret: {
    rotationSpeed: { val: defaults.turret!.rotationSpeed!, min: 0.01, max: 0.1, step: 0.005, label: 'Rotation Speed' },
    bulletSpeed: { val: defaults.turret!.bulletSpeed!, min: 2, max: 20, step: 0.5, label: 'Bullet Speed' },
    bulletSpread: { val: defaults.turret!.bulletSpread!, min: 0, max: 15, step: 0.5, label: 'Bullet Spread (deg)' },
    fireRate: { val: defaults.turret!.fireRate!, min: 2, max: 30, step: 1, label: 'Fire Rate (frames)' },
    heatPerShot: { val: defaults.turret!.heatPerShot!, min: 1, max: 25, step: 1, label: 'Heat Per Shot' },
    heatDecay: { val: defaults.turret!.heatDecay!, min: 0.1, max: 2, step: 0.1, label: 'Heat Decay' },
    overheatCooldown: { val: defaults.turret!.overheatCooldown!, min: 30, max: 300, step: 10, label: 'Overheat Cooldown' },
  },
  helicopter: {
    speed: { val: defaults.helicopter!.speed!, min: 0.3, max: 5, step: 0.1, label: 'Speed' },
    waveSpeedBonus: { val: defaults.helicopter!.waveSpeedBonus!, min: 0, max: 0.5, step: 0.05, label: 'Speed +/Wave' },
  },
  paratrooper: {
    fallSpeed: { val: defaults.paratrooper!.fallSpeed!, min: 0.1, max: 2, step: 0.05, label: 'Fall Speed' },
    maxDrift: { val: defaults.paratrooper!.maxDrift!, min: 0.3, max: 4, step: 0.1, label: 'Max Drift' },
    maxLanded: { val: defaults.paratrooper!.maxLanded!, min: 1, max: 10, step: 1, label: 'Max Landed (per side)' },
  },
  jet: {
    speed: { val: defaults.jet!.speed!, min: 1, max: 10, step: 0.5, label: 'Speed' },
    waveSpeedBonus: { val: defaults.jet!.waveSpeedBonus!, min: 0, max: 1, step: 0.1, label: 'Speed +/Wave' },
  },
  bomb: {
    fallSpeed: { val: defaults.bomb!.fallSpeed!, min: 0.2, max: 3, step: 0.1, label: 'Fall Speed' },
    maxDrift: { val: defaults.bomb!.maxDrift!, min: 0.2, max: 3, step: 0.1, label: 'Max Drift' },
  },
  game: {
    gravity: { val: defaults.game!.gravity!, min: 0.01, max: 0.15, step: 0.005, label: 'Gravity' },
    comboWindow: { val: defaults.game!.comboWindow!, min: 10, max: 120, step: 5, label: 'Combo Window (frames)' },
    powerupInterval: { val: defaults.game!.powerupInterval!, min: 200, max: 1500, step: 50, label: 'Powerup Interval' },
    godMode: { val: defaults.game!.godMode!, min: 0, max: 1, step: 1, label: 'God Mode' },
  },
  powerups: {
    duration: { val: defaults.powerups!.duration!, min: 120, max: 1200, step: 60, label: 'Duration (frames)' },
    missileRate: { val: defaults.powerups!.missileRate!, min: 30, max: 300, step: 10, label: 'Missile Fire Rate' },
    missileSpeed: { val: defaults.powerups!.missileSpeed!, min: 3, max: 12, step: 0.5, label: 'Missile Speed' },
  },
};

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
  { type: 'laser', label: 'LASER AIM', color: '#f22', symbol: 'L' },
  { type: 'missile', label: 'MISSILES', color: '#fa0', symbol: 'M' },
] as const;

/** Dump current config values to console as pasteable JSON */
export function dumpConfig(): void {
  const dump: ConfigValues = {};
  for (const cat of settingsCategories) {
    dump[cat] = {};
    const params = settings[cat] as Record<string, { val: number }>;
    for (const [key, param] of Object.entries(params)) {
      dump[cat]![key] = param.val;
    }
  }
  console.log(`// Current config (${isMobile ? 'mobile' : 'desktop'})`);
  console.log(JSON.stringify(dump, null, 2));
}
