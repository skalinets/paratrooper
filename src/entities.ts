import { S } from './config';
import type { GameState } from './types';

function randTint(): number {
  return (Math.random() - 0.5) * 40;
}

export function spawnHelicopter(state: GameState, canvas: HTMLCanvasElement, forceDir?: number): void {
  const fromLeft = forceDir != null ? (forceDir > 0) : (Math.random() < 0.5);
  const speed = S('helicopter', 'speed') + state.wave * S('helicopter', 'waveSpeedBonus');
  const maxDrops = Math.min(5, state.wave);
  const dropCount = Math.floor(Math.random() * (maxDrops + 1));
  const minX = canvas.width * 0.2;
  const maxX = canvas.width * 0.95;
  const dropXs: number[] = [];
  for (let i = 0; i < dropCount; i++) {
    dropXs.push(minX + Math.random() * (maxX - minX));
  }
  // Sort so they trigger in heli's travel order
  dropXs.sort((a, b) => fromLeft ? a - b : b - a);
  state.helicopters.push({
    x: fromLeft ? -60 : canvas.width + 60,
    y: 30 + Math.random() * 110,
    dir: fromLeft ? 1 : -1,
    speed,
    dropXs,
    width: 55,
    height: 20,
    bobAmp: 4 + Math.random() * 8,
    bobFreq: 0.01 + Math.random() * 0.015,
    bobPhase: Math.random() * Math.PI * 2,
    tint: randTint(),
  });
}

export function spawnJet(state: GameState, canvas: HTMLCanvasElement): void {
  const fromLeft = Math.random() < 0.5;
  const speed = S('jet', 'speed') + state.wave * S('jet', 'waveSpeedBonus');
  state.jets.push({
    x: fromLeft ? -80 : canvas.width + 80,
    y: 25 + Math.random() * 40,
    dir: fromLeft ? 1 : -1,
    speed,
    dropped: false,
    width: 50,
    height: 14,
    tint: randTint(),
  });
}

export function spawnParatrooper(state: GameState, x: number, y: number): void {
  const baseDelay = 20 + Math.random() * 20;
  const waveBonus = Math.min(state.wave * 5, 40);
  state.paratroopers.push({
    x, y, vy: 0.5, vx: 0,
    chuteOpen: false,
    chuteTimer: baseDelay + waveBonus,
    landed: false, alive: true,
    wobbleAmp: 0.3 + Math.random() * 0.5,
    wobbleFreq: 0.008 + Math.random() * 0.012,
    wobblePhase: Math.random() * Math.PI * 2,
    tint: randTint(),
  });
}
