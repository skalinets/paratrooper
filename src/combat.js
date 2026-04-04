import { S, GUN_LENGTH, MAX_HEAT } from './config.js';

export function addExplosion(state, x, y, size) {
  state.explosions.push({ x, y, size, life: 1 });
}

export function addFloatingText(state, text, x, y, color) {
  state.floatingTexts.push({ text, x, y, life: 1, color });
}

export function addKill(state, points, x, y) {
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

export function explosiveBlast(state, x, y) {
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

export function shoot(state, gun) {
  if (state.overheated) return;
  const spd = S('turret', 'bulletSpeed');
  const spread = S('turret', 'bulletSpread') * Math.PI / 180;
  const bx = gun.x + Math.cos(state.gunAngle) * GUN_LENGTH;
  const by = gun.y + Math.sin(state.gunAngle) * GUN_LENGTH;
  const isExplosive = state.activePowerup && state.activePowerup.type === 'explosive';

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
