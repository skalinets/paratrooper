import { S, isMobile, settings, settingsCategories, GUN_LENGTH, MAX_HEAT, POWERUP_TYPES } from './config';
import type { GameState, Gun, Star, Helicopter, Jet, Bomb, Paratrooper, SettingsCategory } from './types';

let nightCanvas: HTMLCanvasElement | null = null;

function drawHeatWarning(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState): void {
  const ratio = state.heat / MAX_HEAT;

  if (state.overheated) {
    // Red OVERHEAT with countdown bar
    const cooldown = S('turret', 'overheatCooldown');
    const remaining = state.overheatTimer / cooldown;
    const cy = canvas.height * 0.4;
    const pulse = 0.7 + Math.sin(state.frame * 0.3) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#f22';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OVERHEAT', canvas.width / 2, cy);
    ctx.globalAlpha = 1;
    // Countdown bar below
    const barW = 200;
    const barH = 10;
    const bx = canvas.width / 2 - barW / 2;
    const by = cy + 14;
    ctx.fillStyle = 'rgba(60,0,0,0.8)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#f44';
    ctx.fillRect(bx, by, barW * remaining, barH);
    ctx.strokeStyle = '#f88';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.restore();
  } else if (ratio > 0.5) {
    // Pulsing warning approaching overheat
    const intensity = (ratio - 0.7) / 0.3; // 0..1
    const pulse = 0.4 + Math.sin(state.frame * 0.25) * 0.4;
    ctx.save();
    ctx.globalAlpha = pulse * intensity;
    ctx.fillStyle = '#fa0';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HEAT WARNING', canvas.width / 2, canvas.height * 0.4);
    ctx.restore();
  }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

// Heat color palette stops (r,g,b)
const HEAT_COOL: [number, number, number] = [153, 153, 187]; // #99b
const HEAT_WARM: [number, number, number] = [255, 204, 68];  // #fc4
const HEAT_HOT: [number, number, number] = [255, 136, 34];   // #f82
const HEAT_GLOW: [number, number, number] = [255, 68, 0];    // #f40

function heatGradient(state: GameState, shift: number = 0): string {
  if (state.overheated) {
    return state.frame % 8 < 4 ? '#ff0000' : '#ff5555';
  }
  const ratio = Math.min(1, Math.max(0, state.heat / MAX_HEAT + shift));
  if (ratio < 0.5) {
    return lerpColor(HEAT_COOL, HEAT_WARM, ratio / 0.5);
  } else if (ratio < 0.8) {
    return lerpColor(HEAT_WARM, HEAT_HOT, (ratio - 0.5) / 0.3);
  } else {
    return lerpColor(HEAT_HOT, HEAT_GLOW, (ratio - 0.8) / 0.2);
  }
}

function drawGun(ctx: CanvasRenderingContext2D, state: GameState, gun: Gun): void {
  const gx = gun.x;
  const gy = gun.y;

  // Base platform
  ctx.fillStyle = '#889';
  ctx.fillRect(gx - gun.baseWidth / 2, gy, gun.baseWidth, gun.baseHeight);
  ctx.strokeStyle = '#aab';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx - gun.baseWidth / 2, gy, gun.baseWidth, gun.baseHeight);

  // Turret dome - smooth heat gradient
  ctx.fillStyle = heatGradient(state);
  ctx.beginPath();
  ctx.arc(gx, gy, 18, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = heatGradient(state, 0.1);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(gx, gy, 18, Math.PI, 0);
  ctx.stroke();

  // Barrel - smooth heat gradient
  const barrelColor = heatGradient(state);
  const barrelEdge = heatGradient(state, 0.15);

  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(state.gunAngle);
  ctx.strokeStyle = barrelColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(GUN_LENGTH, 0);
  ctx.stroke();
  // Barrel outline
  ctx.strokeStyle = barrelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(GUN_LENGTH, -3);
  ctx.moveTo(0, 3);
  ctx.lineTo(GUN_LENGTH, 3);
  ctx.stroke();

  // Muzzle dot
  ctx.fillStyle = barrelEdge;
  ctx.beginPath();
  ctx.arc(GUN_LENGTH, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  // Glow when hot
  const ratio = state.heat / MAX_HEAT;
  if (ratio > 0.7 || state.overheated) {
    ctx.globalAlpha = (state.overheated ? 0.6 : (ratio - 0.7) * 2);
    ctx.strokeStyle = '#f80';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(GUN_LENGTH, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawHelicopter(ctx: CanvasRenderingContext2D, h: Helicopter, frame: number): void {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.scale(h.dir, 1);

  // Body ellipse
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#adf';
  ctx.beginPath();
  ctx.ellipse(14, -2, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.fillStyle = '#777';
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-38, -8);
  ctx.lineTo(-38, 2);
  ctx.closePath();
  ctx.fill();

  // Tail rotor
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-38, -10);
  ctx.lineTo(-38, 8);
  ctx.stroke();

  // Main rotor (animated)
  const rotorLen = Math.cos(frame * 0.3) * 30;
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-rotorLen, -16);
  ctx.lineTo(rotorLen, -16);
  ctx.stroke();

  // Rotor mast
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, -16);
  ctx.stroke();

  ctx.restore();
}

function drawJet(ctx: CanvasRenderingContext2D, j: Jet): void {
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.scale(j.dir, 1);

  // Red fuselage
  ctx.fillStyle = '#aa4444';
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings
  ctx.fillStyle = '#884444';
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-18, 18);
  ctx.lineTo(10, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-18, -18);
  ctx.lineTo(10, 0);
  ctx.closePath();
  ctx.fill();

  // Tail fin
  ctx.fillStyle = '#993333';
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-28, -12);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#ddf';
  ctx.beginPath();
  ctx.ellipse(16, -2, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine exhaust flame (random flicker)
  ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100 | 0}, 0, 0.8)`;
  ctx.beginPath();
  ctx.moveTo(-28, -4);
  ctx.lineTo(-28 - (8 + Math.random() * 10), 0);
  ctx.lineTo(-28, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBomb(ctx: CanvasRenderingContext2D, b: Bomb): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(0.5, 0.5);

  if (b.chuteOpen) {
    // Parachute canopy
    ctx.fillStyle = '#e85';
    ctx.beginPath();
    ctx.arc(0, -30, 22, Math.PI, 0);
    ctx.fill();

    // Yellow stripes on canopy
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 8, -30);
      ctx.lineTo(i * 6, -8);
      ctx.stroke();
    }

    // Strings
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(0, 0);
    ctx.moveTo(20, -18);
    ctx.lineTo(0, 0);
    ctx.stroke();
  }

  // Bomb body
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.ellipse(0, 8, 6, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Red nose tip
  ctx.fillStyle = '#f44';
  ctx.beginPath();
  ctx.arc(0, 20, 4, 0, Math.PI * 2);
  ctx.fill();

  // Fins
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-2, -4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.lineTo(12, -12);
  ctx.lineTo(2, -4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawParatrooper(ctx: CanvasRenderingContext2D, p: Paratrooper, frame: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(0.5, 0.5);

  // Flip if walking toward left
  if (p.landed && p.vx < 0) {
    ctx.scale(-1, 1);
  }

  if (p.chuteOpen && !p.landed) {
    // Parachute canopy - red with white stripes
    ctx.fillStyle = '#d44';
    ctx.beginPath();
    ctx.arc(0, -40, 26, Math.PI, 0);
    ctx.fill();

    // White stripes
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 10, -40);
      ctx.lineTo(i * 7, -14);
      ctx.stroke();
    }

    // Strings
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-24, -26);
    ctx.lineTo(-4, -12);
    ctx.moveTo(24, -26);
    ctx.lineTo(4, -12);
    ctx.stroke();
  }

  // Head
  ctx.fillStyle = '#da8';
  ctx.beginPath();
  ctx.arc(0, -12, 6, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.fillStyle = '#4a4';
  ctx.fillRect(-5, -6, 10, 12);

  // Arms
  ctx.strokeStyle = '#4a4';
  ctx.lineWidth = 3;

  if (!p.landed && !p.chuteOpen) {
    // Flailing arms when falling
    const armSwing = Math.sin(frame * 0.4) * 6;
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-14, -4 + armSwing);
    ctx.moveTo(5, -4);
    ctx.lineTo(14, -4 - armSwing);
    ctx.stroke();
  } else if (p.chuteOpen && !p.landed) {
    // Arms up when chute open
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-12, -10);
    ctx.moveTo(5, -4);
    ctx.lineTo(12, -10);
    ctx.stroke();
  } else {
    // Walking arm swing
    const armSwing = Math.sin(frame * 0.3) * 5;
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-13, -2 + armSwing);
    ctx.moveTo(5, -4);
    ctx.lineTo(13, -2 - armSwing);
    ctx.stroke();
  }

  // Legs
  ctx.strokeStyle = '#383';
  ctx.lineWidth = 3;

  if (!p.landed && !p.chuteOpen) {
    // Flailing legs when falling
    const legSwing = Math.sin(frame * 0.35) * 4;
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(-6, 16 + legSwing);
    ctx.moveTo(3, 6);
    ctx.lineTo(6, 16 - legSwing);
    ctx.stroke();
  } else if (p.landed) {
    // Walking animation
    const legSwing = Math.sin(frame * 0.3) * 6;
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(-5, 16 + legSwing);
    ctx.moveTo(3, 6);
    ctx.lineTo(5, 16 - legSwing);
    ctx.stroke();
  } else {
    // Standing (chute open, descending)
    ctx.beginPath();
    ctx.moveTo(-3, 6);
    ctx.lineTo(-5, 16);
    ctx.moveTo(3, 6);
    ctx.lineTo(5, 16);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLandedIndicators(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState): void {
  const maxLanded: number = S('paratrooper', 'maxLanded');
  const dangerColor = '#f44';
  const normalColor = '#f84';

  // Left side
  const leftColor = state.landedLeft >= maxLanded - 1 ? dangerColor : normalColor;
  ctx.fillStyle = leftColor;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.landedLeft}/${maxLanded}`, 10, canvas.height - 40);

  // Right side
  const rightColor = state.landedRight >= maxLanded - 1 ? dangerColor : normalColor;
  ctx.fillStyle = rightColor;
  ctx.textAlign = 'right';
  ctx.fillText(`${state.landedRight}/${maxLanded}`, canvas.width - 10, canvas.height - 40);
}

function drawSettingsMenu(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState): void {
  const menuW = 340;
  const menuH = state.settingsDrillDown ? 380 : 260;
  const mx = canvas.width / 2 - menuW / 2;
  const my = canvas.height / 2 - menuH / 2;
  const lineH = 26;

  // Dark background
  ctx.fillStyle = 'rgba(0, 0, 20, 0.92)';
  ctx.fillRect(mx, my, menuW, menuH);
  ctx.strokeStyle = '#48f';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, menuW, menuH);

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SETTINGS', canvas.width / 2, my + 26);

  if (!state.settingsDrillDown) {
    // Top-level: show categories
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText('\u2191\u2193 navigate  \u2192/Enter drill down  S close', canvas.width / 2, my + 42);

    let lineY = my + 68;
    settingsCategories.forEach((cat, catIdx) => {
      const isSelected = state.settingsCategory === catIdx;
      if (isSelected) {
        ctx.fillStyle = 'rgba(60, 80, 160, 0.5)';
        ctx.fillRect(mx + 8, lineY - 14, menuW - 16, lineH - 2);
      }
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = isSelected ? '#fff' : '#888';
      ctx.fillText(cat.toUpperCase(), mx + 20, lineY);
      // Arrow indicator
      if (isSelected) {
        ctx.fillStyle = '#48f';
        ctx.textAlign = 'right';
        ctx.fillText('\u25B6', mx + menuW - 16, lineY);
      }
      lineY += lineH;
    });
    // Keyboard shortcuts
    lineY += 10;
    ctx.fillStyle = '#556';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Shortcuts: Space=Fire  \u2190\u2192=Aim  S=Settings  D=Dump Config', canvas.width / 2, lineY);
  } else {
    // Drilled into a category: show params
    const cat = settingsCategories[state.settingsCategory] as SettingsCategory;
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText('\u2191\u2193 navigate  \u2190\u2192 adjust  ESC back', canvas.width / 2, my + 42);

    // Category breadcrumb
    ctx.fillStyle = '#48f';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u25C0 ' + cat.toUpperCase(), mx + 12, my + 60);

    let lineY = my + 82;
    const params = Object.keys(settings[cat]);
    params.forEach((param, paramIdx) => {
      const isSelected = state.settingsParam === paramIdx;
      const cfg = (settings[cat] as Record<string, { val: number; min: number; max: number; step: number; label: string }>)[param]!;
      const val = cfg.val;
      const ratio = (val - cfg.min) / (cfg.max - cfg.min);

      if (isSelected) {
        ctx.fillStyle = 'rgba(60, 80, 160, 0.5)';
        ctx.fillRect(mx + 8, lineY - 14, menuW - 16, lineH - 2);
      }

      // Label
      ctx.font = '11px monospace';
      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.textAlign = 'left';
      ctx.fillText(cfg.label, mx + 18, lineY);

      // Value
      ctx.fillStyle = isSelected ? '#ff4' : '#ccc';
      ctx.textAlign = 'right';
      const displayVal = Number.isInteger(cfg.step) ? val : val.toFixed(2);
      ctx.fillText(String(displayVal), mx + menuW - 80, lineY);

      // Slider
      const sliderX = mx + menuW - 75;
      const sliderW = 60;
      const sliderY = lineY - 5;
      ctx.fillStyle = '#224';
      ctx.fillRect(sliderX, sliderY, sliderW, 6);
      ctx.fillStyle = isSelected ? '#48f' : '#336';
      ctx.fillRect(sliderX, sliderY, sliderW * ratio, 6);
      if (isSelected) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sliderX + sliderW * ratio, sliderY + 3, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      lineY += lineH;
    });
  }
}

function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState, gun: Gun, stars: Star[]): void {
  const W = canvas.width;
  const H = canvas.height;

  // Sky gradient - day or night
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  if (state.nightMode) {
    skyGrad.addColorStop(0, '#050510');
    skyGrad.addColorStop(1, '#0a0a20');
  } else {
    skyGrad.addColorStop(0, '#1a3a6a');
    skyGrad.addColorStop(0.5, '#4a7aaa');
    skyGrad.addColorStop(1, '#7aaacc');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Stars (night only) or clouds (day)
  if (state.nightMode) {
    ctx.fillStyle = '#fff';
    for (const star of stars) {
      const alpha = 0.5 + Math.sin(state.frame * 0.02 + star.twinkle) * 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillRect(star.x * W, star.y * H * 0.6, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  } else {
    // Subtle clouds
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 5; i++) {
      const cx = ((state.frame * 0.1 + i * 200) % (W + 100)) - 50;
      const cy = 30 + i * 25 + Math.sin(i * 2.5) * 15;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 40 + i * 8, 12 + i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // City skyline (behind ground)
  const groundY = H - 30;
  ctx.fillStyle = state.nightMode ? '#0a0a15' : '#445566';
  // Buildings - deterministic from canvas width
  const buildingSeed = [0.1, 0.25, 0.35, 0.45, 0.55, 0.62, 0.72, 0.8, 0.9];
  const buildingH = [60, 90, 45, 110, 70, 55, 85, 65, 50];
  const buildingW = [30, 22, 35, 18, 28, 40, 20, 32, 25];
  for (let i = 0; i < buildingSeed.length; i++) {
    const bx = buildingSeed[i]! * W;
    const bh = buildingH[i]!;
    const bw = buildingW[i]!;
    ctx.fillRect(bx - bw / 2, groundY - bh, bw, bh);
    // Windows
    if (state.nightMode) {
      for (let wy = groundY - bh + 8; wy < groundY - 5; wy += 12) {
        for (let wx = bx - bw / 2 + 4; wx < bx + bw / 2 - 4; wx += 8) {
          const winOn = ((wx * 7 + wy * 13 + i * 31) % 10) > 3;
          ctx.fillStyle = winOn ? 'rgba(255,220,100,0.6)' : 'rgba(100,150,200,0.15)';
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
      ctx.fillStyle = '#0a0a15';
    } else {
      ctx.fillStyle = state.nightMode ? '#0a0a15' : '#3a4a5a';
      for (let wy = groundY - bh + 8; wy < groundY - 5; wy += 12) {
        for (let wx = bx - bw / 2 + 4; wx < bx + bw / 2 - 4; wx += 8) {
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
      ctx.fillStyle = '#445566';
    }
  }

  // Ground
  ctx.fillStyle = state.nightMode ? '#0a1a0a' : '#3a5a2a';
  ctx.fillRect(0, groundY, W, 30);
  ctx.fillStyle = state.nightMode ? '#081508' : '#2a4a1a';
  ctx.fillRect(0, groundY, W, 4);

  // Title screen
  if (!state.started) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PARATROOPER', W / 2, H / 2 - 60);
    ctx.fillStyle = '#adf';
    ctx.font = '18px monospace';
    if (isMobile) {
      ctx.fillText('TAP to start', W / 2, H / 2);
      ctx.fillStyle = '#888';
      ctx.font = '13px monospace';
      ctx.fillText('Tap left/right to aim  Tap center to fire', W / 2, H / 2 + 32);
    } else {
      ctx.fillText('Press SPACE or click to start', W / 2, H / 2);
      ctx.fillStyle = '#888';
      ctx.font = '13px monospace';
      ctx.fillText('Mouse to aim  Click to fire  S for settings', W / 2, H / 2 + 32);
    }
    return;
  }

  // Bullets
  for (const b of state.bullets) {
    if (b.explosive) {
      // Explosive bullets glow orange
      ctx.save();
      ctx.shadowColor = '#f84';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fa4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#ff8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Power-up crates
  for (const pu of state.powerups) {
    const pt = POWERUP_TYPES.find(t => t.type === pu.type);
    if (!pt) continue;
    const px = pu.x;
    const py = pu.y;

    // Glow
    ctx.save();
    ctx.shadowColor = pt.color;
    ctx.shadowBlur = 16 + Math.sin(state.frame * 0.1) * 6;
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = 0.3 + Math.sin(state.frame * 0.1) * 0.15;
    ctx.fillRect(px - 16, py - 16, 32, 32);
    ctx.globalAlpha = 1;
    ctx.restore();

    // Crate box
    ctx.fillStyle = '#444';
    ctx.fillRect(px - 12, py - 12, 24, 24);
    ctx.strokeStyle = pt.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 12, py - 12, 24, 24);

    // Cross lines on crate
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 12, py);
    ctx.lineTo(px + 12, py);
    ctx.moveTo(px, py - 12);
    ctx.lineTo(px, py + 12);
    ctx.stroke();

    // Symbol
    ctx.fillStyle = pt.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pt.symbol, px, py + 5);

    // Sparkle
    const sparkleAngle = state.frame * 0.05;
    for (let i = 0; i < 4; i++) {
      const a = sparkleAngle + (i * Math.PI) / 2;
      const sx = px + Math.cos(a) * 18;
      const sy = py + Math.sin(a) * 18;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = 0.6 + Math.sin(state.frame * 0.15 + i) * 0.3;
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // Helicopters
  for (const h of state.helicopters) {
    drawHelicopter(ctx, h, state.frame);
  }

  // Jets
  for (const j of state.jets) {
    drawJet(ctx, j);
  }

  // Bombs
  for (const b of state.bombs) {
    drawBomb(ctx, b);
  }

  // Paratroopers
  for (const p of state.paratroopers) {
    drawParatrooper(ctx, p, state.frame);
  }

  // Gun (if not destroyed)
  if (!state.gunDestroyed) {
    drawGun(ctx, state, gun);
  }

  // Explosions
  for (const e of state.explosions) {
    const alpha = e.life;
    const r = e.size * (1 - e.life * 0.5);
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${Math.floor(150 * alpha)},0,${alpha})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,${Math.floor(100 * alpha)},${alpha})`;
    ctx.fill();
  }

  // Laser sight - shows turret aim direction
  if (state.activePowerups.has('laser')) {
    const laserLen = Math.max(W, H);
    const endX = gun.x + Math.cos(state.gunAngle) * laserLen;
    const endY = (gun.y - 8) + Math.sin(state.gunAngle) * laserLen;
    const pulse = 0.3 + Math.sin(state.frame * 0.2) * 0.15;
    // Glow
    ctx.strokeStyle = `rgba(255, 0, 0, ${pulse * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gun.x, gun.y - 8);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    // Core beam
    ctx.strokeStyle = `rgba(255, 40, 40, ${pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gun.x, gun.y - 8);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    // Dot at muzzle
    ctx.fillStyle = `rgba(255, 80, 80, ${pulse + 0.3})`;
    ctx.beginPath();
    ctx.arc(gun.x + Math.cos(state.gunAngle) * GUN_LENGTH, (gun.y - 8) + Math.sin(state.gunAngle) * GUN_LENGTH, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Persistent smoke puffs (from missiles) - drawn before missiles
  for (const s of state.smokePuffs) {
    const alpha = s.life * 0.5;
    ctx.fillStyle = `rgba(200,200,200,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Missiles
  for (const m of state.missiles) {
    const angle = Math.atan2(m.vy, m.vx);
    // Missile body
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(angle + Math.PI / 2);
    // Flame
    ctx.fillStyle = `rgba(255, ${100 + Math.floor(Math.random() * 80)}, 0, 0.7)`;
    ctx.beginPath();
    ctx.moveTo(-2, 4); ctx.lineTo(0, 10 + Math.random() * 5); ctx.lineTo(2, 4);
    ctx.fill();
    // Body
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(-3, 4); ctx.lineTo(3, 4);
    ctx.closePath();
    ctx.fill();
    // Nose
    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.arc(0, -6, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Debris (bars)
  for (const d of state.debris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);
    ctx.fillStyle = d.color;
    ctx.fillRect(-d.size / 2, -1.5, d.size, 3);
    ctx.restore();
  }

  // Floating texts
  for (const ft of state.floatingTexts) {
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Landed count indicators
  drawLandedIndicators(ctx, canvas, state);

  // Night mode overlay - offscreen canvas mask
  if (state.nightMode && !state.gameOver) {
    if (!nightCanvas || nightCanvas.width !== W || nightCanvas.height !== H) {
      nightCanvas = document.createElement('canvas');
      nightCanvas.width = W;
      nightCanvas.height = H;
    }
    const nctx = nightCanvas.getContext('2d')!;
    // Fill with darkness
    nctx.clearRect(0, 0, W, H);
    nctx.fillStyle = 'rgba(0, 0, 15, 0.9)';
    nctx.fillRect(0, 0, W, H);
    // Cut out spotlight cone
    nctx.globalCompositeOperation = 'destination-out';
    const spotAngle = state.gunAngle;
    const spotLen = Math.max(W, H) * 1.2;
    const spotWidth = S('game', 'spotlightWidth');
    const gx = gun.x, gy = gun.y - 8;
    nctx.beginPath();
    nctx.moveTo(gx, gy);
    nctx.arc(gx, gy, spotLen, spotAngle - spotWidth, spotAngle + spotWidth);
    nctx.closePath();
    const spotGrad = nctx.createRadialGradient(gx, gy, 10, gx, gy, spotLen);
    spotGrad.addColorStop(0, 'rgba(0,0,0,1)');
    spotGrad.addColorStop(0.6, 'rgba(0,0,0,0.7)');
    spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = spotGrad;
    nctx.fill();
    // Cut out explosion illumination
    for (const e of state.explosions) {
      const r = e.size * 4 * e.life;
      if (r < 1) continue;
      nctx.beginPath();
      nctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      const eg = nctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      eg.addColorStop(0, `rgba(0,0,0,${Math.min(1, e.life * 1.5)})`);
      eg.addColorStop(0.6, `rgba(0,0,0,${e.life * 0.4})`);
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = eg;
      nctx.fill();
    }
    // Gun area glow
    nctx.beginPath();
    nctx.arc(gun.x, gun.y, 50, 0, Math.PI * 2);
    const gg = nctx.createRadialGradient(gun.x, gun.y, 0, gun.x, gun.y, 50);
    gg.addColorStop(0, 'rgba(0,0,0,0.8)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = gg;
    nctx.fill();
    nctx.globalCompositeOperation = 'source-over';
    // Draw mask onto main canvas
    ctx.drawImage(nightCanvas, 0, 0);

    // Whitish spotlight beam tint (additive)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.arc(gx, gy, spotLen, spotAngle - spotWidth, spotAngle + spotWidth);
    ctx.closePath();
    const beamGrad = ctx.createRadialGradient(gx, gy, 10, gx, gy, spotLen);
    beamGrad.addColorStop(0, 'rgba(220, 230, 255, 0.22)');
    beamGrad.addColorStop(0.5, 'rgba(200, 220, 255, 0.12)');
    beamGrad.addColorStop(1, 'rgba(180, 200, 255, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fill();
    ctx.restore();

    // Draw lit building windows on top so they're always visible
    const groundY = H - 30;
    const buildingSeedNight = [0.1, 0.25, 0.35, 0.45, 0.55, 0.62, 0.72, 0.8, 0.9];
    const buildingHNight = [60, 90, 45, 110, 70, 55, 85, 65, 50];
    const buildingWNight = [30, 22, 35, 18, 28, 40, 20, 32, 25];
    for (let i = 0; i < buildingSeedNight.length; i++) {
      const bx = buildingSeedNight[i]! * W;
      const bh = buildingHNight[i]!;
      const bw = buildingWNight[i]!;
      for (let wy = groundY - bh + 8; wy < groundY - 5; wy += 12) {
        for (let wx = bx - bw / 2 + 4; wx < bx + bw / 2 - 4; wx += 8) {
          const winOn = ((wx * 7 + wy * 13 + i * 31) % 10) > 3;
          if (winOn) {
            ctx.fillStyle = 'rgba(255,220,100,0.85)';
            ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
    }
  }

  // HUD: score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(state.score), W / 2, 28);

  // High score
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText(`HI ${state.highScore}`, W / 2, 46);

  // Wave indicator (top left)
  ctx.fillStyle = '#adf';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`WAVE ${state.wave}`, 10, 22);

  // Combo indicator
  if (state.combo > 1) {
    ctx.fillStyle = '#ff4';
    ctx.font = `bold ${14 + Math.min(state.combo, 8)}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`x${state.combo} COMBO`, W - 10, 22);
  }

  // Active power-up indicators (stacked)
  if (state.activePowerups.size > 0) {
    let idx = 0;
    const duration = S('powerups', 'duration');
    for (const [type, timer] of state.activePowerups) {
      const pt = POWERUP_TYPES.find(t => t.type === type);
      if (!pt) continue;
      const timeLeft = timer / duration;
      const expiring = timeLeft < 0.25;
      const visible = !expiring || state.frame % 20 < 14;
      if (visible) {
        const barW = 80;
        const barX = W / 2 - barW / 2;
        const barY = 50 + idx * 16;
        ctx.fillStyle = pt.color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pt.label, W / 2, barY);
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY + 2, barW, 4);
        ctx.fillStyle = pt.color;
        ctx.fillRect(barX, barY + 2, barW * timeLeft, 4);
      }
      idx++;
    }
  }

  // Heat bar
  drawHeatWarning(ctx, canvas, state);

  // Wave announcement overlay
  if (state.waveAnnounceTimer > 0) {
    const alpha = Math.min(1, state.waveAnnounceTimer / 30);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H / 2 - 50, W, 100);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave}`, W / 2, H / 2);
    ctx.fillStyle = state.nightMode ? '#f84' : '#adf';
    ctx.font = '16px monospace';
    ctx.fillText(state.nightMode ? 'NIGHT ROUND!' : 'INCOMING!', W / 2, H / 2 + 28);
    ctx.globalAlpha = 1;
  }

  // Wave complete message
  if (state.wavePause && !state.waveAnnounceTimer) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, H / 2 - 30, W, 60);
    ctx.fillStyle = '#4f4';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave} COMPLETE`, W / 2, H / 2 + 8);
  }

  // Danger warning (flashing when both sides near max)
  const maxLanded: number = S('paratrooper', 'maxLanded');
  if ((state.landedLeft >= maxLanded - 1 || state.landedRight >= maxLanded - 1) && state.frame % 40 < 20) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DANGER', W / 2, H - 60);
  }

  // Destroyed gun debris with smoke animation
  if (state.gunDestroyed) {
    const gx = gun.x;
    const gy = gun.y;

    // Debris pieces
    ctx.fillStyle = '#556';
    ctx.fillRect(gx - 20, gy + 4, 14, 8);
    ctx.fillRect(gx + 6, gy + 2, 10, 6);
    ctx.fillRect(gx - 6, gy + 8, 16, 4);

    // Smoke puffs
    for (let i = 0; i < 3; i++) {
      const smokeOffset = (state.frame * (0.5 + i * 0.3)) % 40;
      const smokeAlpha = (40 - smokeOffset) / 80;
      ctx.globalAlpha = smokeAlpha;
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(gx + (i - 1) * 10, gy - smokeOffset, 6 + i * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Settings menu overlay
  if (state.settingsOpen) {
    drawSettingsMenu(ctx, canvas, state);
  }

  // Game over screen
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 60);

    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText(`Score: ${state.score}`, W / 2, H / 2 - 18);
    ctx.fillText(`Wave: ${state.wave}`, W / 2, H / 2 + 12);

    ctx.fillStyle = '#ff4';
    ctx.font = '16px monospace';
    ctx.fillText(`High Score: ${state.highScore}`, W / 2, H / 2 + 42);

    if (state.canRestart) {
      ctx.fillStyle = '#adf';
      ctx.font = '14px monospace';
      if (isMobile) {
        ctx.fillText('Tap to restart', W / 2, H / 2 + 76);
      } else {
        ctx.fillText('Press SPACE or click to restart', W / 2, H / 2 + 76);
      }
    }
  }
}

export { draw };
