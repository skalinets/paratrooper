import { S, isMobile } from './config.js';

export function spawnHelicopter(state, canvas, forceDir) {
  const fromLeft = forceDir != null ? (forceDir > 0) : (Math.random() < 0.5);
  const speed = S('helicopter', 'speed') + state.wave * S('helicopter', 'waveSpeedBonus');
  const yRange = isMobile ? 180 : 120;
  const baseY = isMobile ? 40 : 50;
  state.helicopters.push({
    x: fromLeft ? -60 : canvas.width + 60,
    y: baseY + Math.random() * yRange,
    dir: fromLeft ? 1 : -1,
    speed,
    dropTimer: 40 + Math.random() * 60,
    dropped: false,
    width: 55,
    height: 20,
    bobAmp: isMobile ? (8 + Math.random() * 12) : 0,
    bobFreq: 0.02 + Math.random() * 0.02,
    bobPhase: Math.random() * Math.PI * 2,
  });
}

export function spawnJet(state, canvas) {
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
  });
}

export function spawnParatrooper(state, x, y) {
  const baseDelay = 20 + Math.random() * 20;
  const waveBonus = Math.min(state.wave * 5, 40);
  state.paratroopers.push({
    x, y, vy: 0.5, vx: 0,
    chuteOpen: false,
    chuteTimer: baseDelay + waveBonus,
    landed: false, alive: true,
  });
}
