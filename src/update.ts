import { S, isMobile, MAX_HEAT, POWERUP_TYPES, POWERUP_DURATION } from './config';
import { addExplosion, addFloatingText, addKill, explosiveBlast } from './combat';
import { spawnHelicopter, spawnJet, spawnParatrooper } from './entities';
import type { GameState, Gun, CanvasSize } from './types';

export function update(state: GameState, canvas: CanvasSize, gun: Gun): void {
  if (!state.started) return;

  // Always update explosions & floating texts
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    state.explosions[i].life -= 0.04;
    if (state.explosions[i].life <= 0) state.explosions.splice(i, 1);
  }
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    state.floatingTexts[i].life -= 0.02;
    state.floatingTexts[i].y -= 0.8;
    if (state.floatingTexts[i].life <= 0) state.floatingTexts.splice(i, 1);
  }

  // End sequence
  if (state.endSequence) {
    state.frame++;
    state.endSequenceTimer++;
    let allArrived = true;
    state.paratroopers.forEach(p => {
      if (p.walking) {
        const dx = (p.targetX ?? p.x) - p.x;
        if (Math.abs(dx) > 2) {
          p.x += Math.sign(dx) * 1.2;
          p.walkFrame = (p.walkFrame || 0) + 0.15;
          allArrived = false;
        } else { p.walking = false; p.arrived = true; }
      }
      if (!p.landed && !p.walking) {
        p.vy = (p.vy || 0) + S('game','gravity');
        p.y += p.vy;
        if (p.y >= canvas.height - 15) { p.y = canvas.height - 15; p.landed = true; }
      }
    });
    if (!state.gunDestroyed && (allArrived || state.endSequenceTimer > 200)) {
      state.gunDestroyed = true;
      addExplosion(state, gun.x, gun.y - 10, 50);
      addExplosion(state, gun.x - 15, gun.y - 5, 35);
      addExplosion(state, gun.x + 15, gun.y - 5, 35);
      addExplosion(state, gun.x, gun.y - 25, 30);
      state.paratroopers = state.paratroopers.filter(p => Math.abs(p.x - gun.x) > 40);
      state.endSequenceTimer = 0;
    }
    if (state.gunDestroyed && state.endSequenceTimer > 60) {
      state.gameOver = true;
      state.canRestart = true;
      if (state.score > state.highScore) {
        state.highScore = state.score;
        if (typeof localStorage !== 'undefined') localStorage.setItem('paratrooper_hi', String(state.highScore));
      }
    }
    return;
  }

  if (state.gameOver) return;
  state.frame++;

  // Gun angle (input is handled externally, just clamp here)
  if (state.gunAngle > 0) state.gunAngle = 0;
  if (state.gunAngle < -Math.PI) state.gunAngle = -Math.PI;

  // Auto-fire is handled by input module calling shoot()

  // Heat decay
  if (state.overheated) {
    state.overheatTimer--;
    state.heat = MAX_HEAT * (state.overheatTimer / S('turret','overheatCooldown'));
    if (state.overheatTimer <= 0) { state.overheated = false; state.heat = 0; }
  } else {
    state.heat = Math.max(0, state.heat - S('turret','heatDecay'));
  }

  // Combo decay
  if (state.comboTimer > 0) {
    state.comboTimer--;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // Power-up timer
  if (state.activePowerup) {
    state.activePowerup.timer--;
    if (state.activePowerup.timer <= 0) state.activePowerup = null;
  }

  // Spawn power-up crates
  state.powerupSpawnTimer++;
  if (state.powerupSpawnTimer >= S('game','powerupInterval') + Math.random() * 300) {
    state.powerupSpawnTimer = 0;
    const pt = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    state.powerups.push({
      x: 50 + Math.random() * (canvas.width - 100),
      y: -20, vy: 0.6,
      type: pt.type, label: pt.label, color: pt.color, symbol: pt.symbol,
    });
  }

  // Update power-up crates
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const pu = state.powerups[i];
    pu.y += pu.vy;
    if (pu.y > canvas.height + 20) { state.powerups.splice(i, 1); continue; }
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const b = state.bullets[j];
      const puHit = isMobile ? 10 : 14;
      if (Math.abs(b.x - pu.x) < puHit && Math.abs(b.y - pu.y) < puHit) {
        state.bullets.splice(j, 1);
        if (pu.type === 'nuke') {
          state.helicopters.forEach(h => { addExplosion(state, h.x, h.y, 25); addKill(state, 50, h.x, h.y); });
          state.jets.forEach(jt => { addExplosion(state, jt.x, jt.y, 25); addKill(state, 100, jt.x, jt.y); });
          state.bombs.forEach(bm => { addExplosion(state, bm.x, bm.y, 15); });
          for (let k = state.paratroopers.length - 1; k >= 0; k--) {
            const p = state.paratroopers[k];
            if (!p.landed) { addExplosion(state, p.x, p.y, 12); addKill(state, 25, p.x, p.y); }
          }
          state.paratroopers = state.paratroopers.filter(p => p.landed);
          state.helicopters = [];
          state.jets = [];
          state.bombs = [];
          addFloatingText(state, 'NUKE!', pu.x, pu.y, '#f4f');
        } else if (pu.type === 'freeze') {
          state.activePowerup = { type: 'freeze', timer: POWERUP_DURATION };
          addFloatingText(state, 'FREEZE!', pu.x, pu.y, '#aef');
        } else {
          state.activePowerup = { type: pu.type, timer: POWERUP_DURATION };
          addFloatingText(state, pu.label, pu.x, pu.y, pu.color);
        }
        state.powerups.splice(i, 1);
        break;
      }
    }
  }

  // Wave logic
  if (state.waveAnnounceTimer > 0) {
    state.waveAnnounceTimer--;
    if (state.waveAnnounceTimer <= 0) state.waveActive = true;
    return;
  }

  if (state.waveActive) {
    state.waveSpawnTimer++;
    const spawnRate = isMobile ? Math.max(30, 90 - state.wave * 10) : Math.max(40, 120 - state.wave * 10);
    if (state.waveSpawnTimer >= spawnRate) {
      state.waveSpawnTimer = 0;
      if (state.waveHelisSpawned < state.waveHeliCount) {
        spawnHelicopter(state, canvas);
        state.waveHelisSpawned++;
        if (isMobile && state.waveHelisSpawned < state.waveHeliCount && Math.random() < 0.5) {
          const lastDir = state.helicopters[state.helicopters.length - 1].dir;
          spawnHelicopter(state, canvas, -lastDir);
          state.waveHelisSpawned++;
        }
      }
      // Spawn jets independently - every 3rd spawn cycle
      if (state.waveJetsSpawned < state.waveJetCount) {
        spawnJet(state, canvas);
        state.waveJetsSpawned++;
      }
    }
    if (state.waveHelisSpawned >= state.waveHeliCount && state.waveJetsSpawned >= state.waveJetCount
        && state.helicopters.length === 0 && state.jets.length === 0
        && state.paratroopers.every(p => p.landed || p.falling)
        && state.bombs.length === 0) {
      state.wavePause = 120;
      state.waveActive = false;
    }
  } else if (state.wavePause > 0) {
    state.wavePause--;
    if (state.wavePause <= 0) startWave(state);
  }

  // Update bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx; b.y += b.vy;
    if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
      state.bullets.splice(i, 1);
    }
  }

  const frozen: boolean = !!(state.activePowerup && state.activePowerup.type === 'freeze');

  // Update helicopters
  for (let i = state.helicopters.length - 1; i >= 0; i--) {
    const h = state.helicopters[i];
    if (!frozen) {
      h.x += h.dir * h.speed;
      h.dropTimer--;
      if (h.bobAmp) {
        h.y += Math.cos(state.frame * h.bobFreq + h.bobPhase) * h.bobAmp * 0.05;
      }
    }
    if (h.dropTimer <= 0 && !h.dropped) {
      if (Math.abs(h.x - gun.x) > 80) {
        spawnParatrooper(state, h.x, h.y + 15);
        h.dropped = true;
      }
    }
    if ((h.dir > 0 && h.x > canvas.width + 80) || (h.dir < 0 && h.x < -80)) {
      state.helicopters.splice(i, 1); continue;
    }
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const b = state.bullets[j];
      if (Math.abs(b.x - h.x) < h.width / 2 && Math.abs(b.y - h.y) < h.height / 2) {
        const ex = h.x, ey = h.y;
        addExplosion(state, ex, ey, 30);
        state.helicopters.splice(i, 1);
        state.bullets.splice(j, 1);
        addKill(state, 50, ex, ey);
        if (b.explosive) explosiveBlast(state, ex, ey);
        break;
      }
    }
  }

  // Update jets
  for (let i = state.jets.length - 1; i >= 0; i--) {
    const j = state.jets[i];
    if (!frozen) { j.x += j.dir * j.speed; }
    if (!frozen && !j.dropped && Math.abs(j.x - gun.x) < 120) {
      j.dropped = true;
      state.bombs.push({ x: j.x, y: j.y + 10, vy: S('bomb','fallSpeed'), chuteOpen: true });
    }
    if ((j.dir > 0 && j.x > canvas.width + 100) || (j.dir < 0 && j.x < -100)) {
      state.jets.splice(i, 1); continue;
    }
    for (let k = state.bullets.length - 1; k >= 0; k--) {
      const b = state.bullets[k];
      if (Math.abs(b.x - j.x) < j.width / 2 && Math.abs(b.y - j.y) < j.height / 2) {
        const ex = j.x, ey = j.y;
        addExplosion(state, ex, ey, 25);
        state.jets.splice(i, 1);
        state.bullets.splice(k, 1);
        addKill(state, 100, ex, ey);
        if (b.explosive) explosiveBlast(state, ex, ey);
        break;
      }
    }
  }

  // Update bombs
  for (let i = state.bombs.length - 1; i >= 0; i--) {
    const b = state.bombs[i];
    if (!frozen) {
      b.vy = S('bomb','fallSpeed');
      const dx = gun.x - b.x;
      const remainingY = (gun.y - 10) - b.y;
      const framesLeft = remainingY / S('bomb','fallSpeed');
      if (framesLeft > 0) {
        b.vx = Math.max(-S('bomb','maxDrift'), Math.min(S('bomb','maxDrift'), dx / framesLeft));
      }
      b.x += (b.vx || 0);
      b.y += b.vy;
    }
    if (b.y >= gun.y - 10 && Math.abs(b.x - gun.x) < 30) {
      addExplosion(state, b.x, b.y, 40);
      state.bombs.splice(i, 1);
      if (S('game', 'godMode') >= 1) continue;
      state.gunDestroyed = true;
      state.endSequence = true;
      state.endSequenceTimer = 0;
      state.bullets = [];
      addExplosion(state, gun.x, gun.y - 10, 50);
      addExplosion(state, gun.x - 12, gun.y, 30);
      addExplosion(state, gun.x + 12, gun.y, 30);
      continue;
    }
    if (b.y >= canvas.height - 10) {
      addExplosion(state, b.x, canvas.height - 10, 20);
      state.bombs.splice(i, 1);
      continue;
    }
    for (let k = state.bullets.length - 1; k >= 0; k--) {
      const bl = state.bullets[k];
      const bombHit = isMobile ? 8 : 12;
      if (Math.abs(bl.x - b.x) < bombHit && Math.abs(bl.y - b.y) < bombHit) {
        const ex = b.x, ey = b.y;
        addExplosion(state, ex, ey, 20);
        state.bombs.splice(i, 1);
        state.bullets.splice(k, 1);
        addKill(state, 75, ex, ey);
        if (bl.explosive) explosiveBlast(state, ex, ey);
        break;
      }
    }
  }

  // Update paratroopers
  for (let i = state.paratroopers.length - 1; i >= 0; i--) {
    const p = state.paratroopers[i];
    if (p.landed) continue;
    if (frozen && !p.falling) continue;
    if (!p.falling) { p.chuteTimer--; if (p.chuteTimer <= 0) p.chuteOpen = true; }

    if (p.falling) {
      p.vy += S('game','gravity') * 2;
      p.x += p.vx; p.y += p.vy;
      for (let k = state.paratroopers.length - 1; k >= 0; k--) {
        if (k === i) continue;
        const other = state.paratroopers[k];
        if (Math.abs(p.x - other.x) < 12 && Math.abs(p.y - other.y) < 18) {
          addExplosion(state, p.x, p.y, 15);
          addExplosion(state, other.x, other.y, 12);
          if (other.landed) {
            if (other.x < gun.x) state.landedLeft = Math.max(0, state.landedLeft - 1);
            else state.landedRight = Math.max(0, state.landedRight - 1);
          }
          const hi = Math.max(i, k), lo = Math.min(i, k);
          state.paratroopers.splice(hi, 1);
          state.paratroopers.splice(lo, 1);
          addKill(state, 15, p.x, p.y);
          i = -1; break;
        }
      }
      if (i === -1) continue;
      if (p.y >= canvas.height - 15) {
        addExplosion(state, p.x, canvas.height - 15, 10);
        state.paratroopers.splice(i, 1);
        state.score += 10;
        continue;
      }
    } else if (p.chuteOpen) {
      p.vy = S('paratrooper','fallSpeed');
      if (p.landingX == null) {
        const side = p.x < gun.x ? -1 : 1;
        const margin = 30;
        const minX = side < 0 ? margin : gun.x + 40;
        const maxX = side < 0 ? gun.x - 40 : canvas.width - margin;
        p.landingX = minX + Math.random() * (maxX - minX);
      }
      const remainingY = (canvas.height - 15) - p.y;
      const framesLeft = remainingY / S('paratrooper','fallSpeed');
      if (framesLeft > 0) {
        p.vx = Math.max(-S('paratrooper','maxDrift'), Math.min(S('paratrooper','maxDrift'), (p.landingX - p.x) / framesLeft));
      }
      p.x += p.vx; p.y += p.vy;
      if (p.y >= canvas.height - 15) {
        p.landed = true; p.y = canvas.height - 15;
        if (p.x < gun.x) state.landedLeft++;
        else state.landedRight++;
        if (S('game', 'godMode') < 1 && (state.landedLeft >= S('paratrooper','maxLanded') || state.landedRight >= S('paratrooper','maxLanded'))) {
          startEndSequence(state, gun);
        }
      }
    } else {
      p.vy += S('game','gravity');
      p.x += p.vx; p.y += p.vy;
      if (p.y >= canvas.height - 15) {
        addExplosion(state, p.x, canvas.height - 15, 10);
        state.paratroopers.splice(i, 1);
        state.score += 10;
        continue;
      }
    }

    if (!p.landed && !p.falling) {
      for (let j = state.bullets.length - 1; j >= 0; j--) {
        const b = state.bullets[j];
        const hitRadius = p.chuteOpen ? (isMobile ? 12 : 18) : (isMobile ? 5 : 8);
        if (Math.abs(b.x - p.x) < hitRadius && Math.abs(b.y - p.y) < hitRadius) {
          state.bullets.splice(j, 1);
          if (p.chuteOpen) {
            p.chuteOpen = false; p.falling = true; p.vy = 0.5; p.vx = 0; p.landingX = null;
            addKill(state, 25, p.x, p.y - 15);
          } else {
            addExplosion(state, p.x, p.y, 15);
            state.paratroopers.splice(i, 1);
            addKill(state, 25, p.x, p.y);
          }
          break;
        }
      }
    }
  }
}

export function startWave(state: GameState): void {
  state.wave++;
  state.waveAnnounceTimer = 120;
  state.wavePause = 0;
  state.waveActive = false;
  const mobileScale = isMobile ? 1.4 : 1.0;
  state.waveHeliCount = Math.floor((3 + Math.floor(state.wave * 1.5)) * mobileScale);
  state.waveJetCount = state.wave >= 2 ? Math.floor(Math.floor(state.wave / 2) * mobileScale) : 0;
  if (isMobile && state.wave >= 1) state.waveJetCount = Math.max(1, state.waveJetCount);
  state.waveHelisSpawned = 0;
  state.waveJetsSpawned = 0;
  state.waveSpawnTimer = 0;
}

export function startEndSequence(state: GameState, gun: Gun): void {
  state.endSequence = true;
  state.endSequenceTimer = 0;
  state.bullets = [];
  state.paratroopers.forEach(p => {
    if (p.landed) {
      p.walking = true;
      p.targetX = gun.x + (p.x < gun.x ? -20 : 20);
    }
  });
}
