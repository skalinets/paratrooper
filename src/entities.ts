import { S } from './config';
import type { GameState } from './types';

function randTint(): number {
  return (Math.random() - 0.5) * 40;
}

export function spawnHelicopter(state: GameState, canvas: HTMLCanvasElement, forceDir?: number): void {
  const fromLeft = forceDir != null ? (forceDir > 0) : (Math.random() < 0.5);
  const speed = S('helicopter', 'speed') + state.wave * S('helicopter', 'waveSpeedBonus');
  state.helicopters.push({
    x: fromLeft ? -60 : canvas.width + 60,
    y: 40 + Math.random() * 180,
    dir: fromLeft ? 1 : -1,
    speed,
    dropTimer: 40 + Math.random() * 60,
    dropped: false,
    width: 55,
    height: 20,
    bobAmp: 8 + Math.random() * 12,
    bobFreq: 0.02 + Math.random() * 0.02,
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
