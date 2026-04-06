import { S, GUN_LENGTH, MAX_HEAT } from './config';
import type { GameState, Gun } from './types';

export function addExplosion(state: GameState, x: number, y: number, size: number): void {
  state.explosions.push({ x, y, size, life: 1 });
}

const DEBRIS_COLORS = ['#888', '#666', '#aaa', '#555', '#999', '#774', '#997'];

export function spawnDebris(state: GameState, x: number, y: number, count: number, colors?: string[], scale: number = 1): void {
  const palette = colors ?? DEBRIS_COLORS;
  for (let i = 0; i < count; i++) {
    state.debris.push({
      x: x + (Math.random() - 0.5) * 10 * scale,
      y: y + (Math.random() - 0.5) * 6 * scale,
      vx: (Math.random() - 0.5) * 6 * scale,
      vy: -Math.random() * 5 * scale - 1.5,
      size: (5 + Math.random() * 10) * scale,
      color: palette[Math.floor(Math.random() * palette.length)]!,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
    });
  }
}

export function addFloatingText(state: GameState, text: string, x: number, y: number, color: string): void {
  state.floatingTexts.push({ text, x, y, life: 1, color });
}

export function addKill(state: GameState, points: number, x: number, y: number): void {
  state.comboTimer = S('game', 'comboWindow');
  state.combo++;
  const multiplier = Math.min(state.combo, 8);
  const total = points * multiplier;
  state.score += total;
  if (multiplier > 1) {
    addFloatingText(state, `${total} x${multiplier}`, x, y, '#ff0');
  } else {
    addFloatingText(state, `+${total}`, x, y, '#fff');
  }
}

export function explosiveBlast(state: GameState, x: number, y: number): void {
  const radius = 60;
  addExplosion(state, x, y, 40);
  for (let i = state.helicopters.length - 1; i >= 0; i--) {
    const h = state.helicopters[i];
    if (Math.hypot(h.x - x, h.y - y) < radius) {
      addExplosion(state, h.x, h.y, 25);
      addKill(state, 50, h.x, h.y);
      state.helicopters.splice(i, 1);
    }
  }
  for (let i = state.jets.length - 1; i >= 0; i--) {
    const j = state.jets[i];
    if (Math.hypot(j.x - x, j.y - y) < radius) {
      addExplosion(state, j.x, j.y, 25);
      addKill(state, 100, j.x, j.y);
      state.jets.splice(i, 1);
    }
  }
  for (let i = state.bombs.length - 1; i >= 0; i--) {
    const b = state.bombs[i];
    if (Math.hypot(b.x - x, b.y - y) < radius) {
      addExplosion(state, b.x, b.y, 15);
      state.bombs.splice(i, 1);
    }
  }
  for (let i = state.paratroopers.length - 1; i >= 0; i--) {
    const p = state.paratroopers[i];
    if (!p.landed && Math.hypot(p.x - x, p.y - y) < radius) {
      addExplosion(state, p.x, p.y, 12);
      addKill(state, 25, p.x, p.y);
      state.paratroopers.splice(i, 1);
    }
  }
}

export function shoot(state: GameState, gun: Gun): void {
  if (state.overheated) return;
  const spd = S('turret', 'bulletSpeed');
  const spread = S('turret', 'bulletSpread') * Math.PI / 180;
  const bx = gun.x + Math.cos(state.gunAngle) * GUN_LENGTH;
  const by = gun.y + Math.sin(state.gunAngle) * GUN_LENGTH;
  const isExplosive = !!(state.activePowerup && state.activePowerup.type === 'explosive');

  if (state.activePowerup && state.activePowerup.type === 'triple') {
    for (let s = -1; s <= 1; s++) {
      const a = state.gunAngle + s * 0.12 + (Math.random() - 0.5) * spread;
      state.bullets.push({ x: bx, y: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, explosive: isExplosive });
    }
  } else {
    const a = state.gunAngle + (Math.random() - 0.5) * spread;
    state.bullets.push({ x: bx, y: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, explosive: isExplosive });
  }

  const heatCost = (state.activePowerup && state.activePowerup.type === 'rapid') ? 2 : S('turret', 'heatPerShot');
  state.heat = Math.min(MAX_HEAT, state.heat + heatCost);
  if (state.heat >= MAX_HEAT) {
    state.overheated = true;
    state.overheatTimer = S('turret', 'overheatCooldown');
  }
}
