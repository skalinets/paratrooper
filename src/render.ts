import { S, isMobile, settings, settingsCategories, GUN_LENGTH, MAX_HEAT, POWERUP_TYPES } from './config';
import type { GameState, Gun, Star, Helicopter, Jet, Bomb, Paratrooper, SettingsCategory } from './types';

// -----------------------------------------------------------------------------
// Pixel buffer — renders world at 1/PIXEL_SCALE resolution, blits upscaled
// with imageSmoothingEnabled=false for an authentic chunky pixel look.
// -----------------------------------------------------------------------------
export const PIXEL_SCALE = 2;

let pixelBuffer: HTMLCanvasElement | null = null;
let pbCtxCache: CanvasRenderingContext2D | null = null;
let pbW = 0;
let pbH = 0;

function getPixelBuffer(canvas: HTMLCanvasElement): { pb: HTMLCanvasElement; pbCtx: CanvasRenderingContext2D } {
  const targetW = Math.max(1, Math.ceil(canvas.width / PIXEL_SCALE));
  const targetH = Math.max(1, Math.ceil(canvas.height / PIXEL_SCALE));
  if (!pixelBuffer || pbW !== targetW || pbH !== targetH) {
    pixelBuffer = document.createElement('canvas');
    pixelBuffer.width = targetW;
    pixelBuffer.height = targetH;
    pbW = targetW;
    pbH = targetH;
    pbCtxCache = pixelBuffer.getContext('2d');
  }
  const pbCtx = pbCtxCache;
  if (!pbCtx) throw new Error('Failed to get pixel buffer 2D context');
  return { pb: pixelBuffer, pbCtx };
}

let nightCanvas: HTMLCanvasElement | null = null;

// -----------------------------------------------------------------------------
// Palette — SNES-ish limited palette used across entities. Flat fills only.
// -----------------------------------------------------------------------------
const PAL = {
  // Helicopter (military olive/khaki)
  heliBase: '#6a7a3a',
  heliHi:   '#8e9a4e',
  heliShd:  '#3e4a22',
  heliOut:  '#1e2410',
  heliGlass:'#7acfe8',
  heliGlassHi:'#c0edf7',
  rotor:    '#bbbbc0',
  rotorDim: '#55555a',
  exhaust1: '#ff9a22',
  exhaust2: '#ffd84a',
  // Jet (red interceptor)
  jetBase:  '#b83030',
  jetHi:    '#e85a46',
  jetShd:   '#6a1414',
  jetOut:   '#2a0606',
  jetGlass: '#b0e8ff',
  jetPilot: '#402a1a',
  jetWing:  '#881f1f',
  jetAB1:   '#ffd040',
  jetAB2:   '#ff5a1a',
  // Bomb
  bombBase: '#4a4a52',
  bombHi:   '#7a7a88',
  bombShd:  '#1e1e22',
  bombNose: '#e04040',
  bombFin:  '#28282e',
  // Paratrooper
  skin:     '#e8b488',
  skinShd:  '#8a6040',
  helmet:   '#2e3a20',
  helmetHi: '#4e5e38',
  suit:     '#3a6a2e',
  suitShd:  '#1e3a18',
  suitHi:   '#6aa04e',
  boot:     '#1a1a20',
  chute:    '#c83030',
  chuteHi:  '#f07060',
  chuteShd: '#801818',
  chuteStripe:'#f4f4f4',
  cord:     '#aaaab0',
  // Gun
  gunBase:  '#4a4a58',
  gunBaseHi:'#6e6e80',
  gunBaseShd:'#222228',
  gunMount: '#5a5a68',
  // Explosions
  exFire:   '#ffe860',
  exCore:   '#ffffff',
  exMid:    '#ff8420',
  exOuter:  '#a02000',
  exSmoke:  '#38282a',
  // Bullets
  bulletHead:'#ffff60',
  bulletMid: '#ff8020',
  bulletTail:'#e01810',
  // Sky/ground
  skyDay1:  '#3a7ab8',
  skyDay2:  '#78b4dc',
  skyNight1:'#05050e',
  skyNight2:'#0e1028',
  cloud:    '#e0ecf4',
  bldgDay:  '#445566',
  bldgNight:'#0a0a15',
  bldgWinOn:'#ffd060',
  bldgWinOff:'#2a3a4a',
  groundDay:'#3a5a2a',
  groundDayDark:'#2a4a1a',
  groundNight:'#0a1a0a',
  groundNightDark:'#081508',
} as const;

function shade(hex: string, amt: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const clamp = (n: number) => Math.max(0, Math.min(255, n | 0));
  const r = clamp(parseInt(h.slice(0, 2), 16) + amt);
  const g = clamp(parseInt(h.slice(2, 4), 16) + amt);
  const b = clamp(parseInt(h.slice(4, 6), 16) + amt);
  return `rgb(${r},${g},${b})`;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

function hexRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function blend(a: string, b: string, t: number): string {
  return lerpColor(hexRgb(a), hexRgb(b), t);
}

// Heat color palette stops (r,g,b)
const HEAT_COOL: [number, number, number] = [153, 153, 187];
const HEAT_WARM: [number, number, number] = [255, 204, 68];
const HEAT_HOT: [number, number, number] = [255, 136, 34];
const HEAT_GLOW: [number, number, number] = [255, 68, 0];

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

// -----------------------------------------------------------------------------
// HUD (drawn on main ctx AFTER buffer blit so text stays sharp)
// -----------------------------------------------------------------------------
function drawHeatWarning(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState): void {
  const ratio = state.heat / MAX_HEAT;

  if (state.overheated) {
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
    const intensity = (ratio - 0.7) / 0.3;
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

function drawLandedIndicators(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState): void {
  const maxLanded: number = S('paratrooper', 'maxLanded');
  const dangerColor = '#f44';
  const normalColor = '#f84';

  const leftColor = state.landedLeft >= maxLanded - 1 ? dangerColor : normalColor;
  ctx.fillStyle = leftColor;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.landedLeft}/${maxLanded}`, 10, canvas.height - 40);

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

  ctx.fillStyle = 'rgba(0, 0, 20, 0.92)';
  ctx.fillRect(mx, my, menuW, menuH);
  ctx.strokeStyle = '#48f';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, menuW, menuH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SETTINGS', canvas.width / 2, my + 26);

  if (!state.settingsDrillDown) {
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
      if (isSelected) {
        ctx.fillStyle = '#48f';
        ctx.textAlign = 'right';
        ctx.fillText('\u25B6', mx + menuW - 16, lineY);
      }
      lineY += lineH;
    });
    lineY += 10;
    ctx.fillStyle = '#556';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Shortcuts: Space=Fire  \u2190\u2192=Aim  S=Settings  D=Dump Config', canvas.width / 2, lineY);
  } else {
    const cat = settingsCategories[state.settingsCategory] as SettingsCategory;
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText('\u2191\u2193 navigate  \u2190\u2192 adjust  ESC back', canvas.width / 2, my + 42);

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

      ctx.font = '11px monospace';
      ctx.fillStyle = isSelected ? '#fff' : '#aaa';
      ctx.textAlign = 'left';
      ctx.fillText(cfg.label, mx + 18, lineY);

      ctx.fillStyle = isSelected ? '#ff4' : '#ccc';
      ctx.textAlign = 'right';
      const displayVal = Number.isInteger(cfg.step) ? val : val.toFixed(2);
      ctx.fillText(String(displayVal), mx + menuW - 80, lineY);

      const sliderX = mx + menuW - 75;
      const sliderW = 60;
      const sliderY = lineY - 5;
      ctx.fillStyle = '#224';
      ctx.fillRect(sliderX, sliderY, sliderW, 6);
      ctx.fillStyle = isSelected ? '#48f' : '#336';
      ctx.fillRect(sliderX, sliderY, sliderW * ratio, 6);
      if (isSelected) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(sliderX + sliderW * ratio - 2, sliderY - 2, 5, 10);
      }

      lineY += lineH;
    });
  }
}

// -----------------------------------------------------------------------------
// Pixel-art entity drawers. All use fillRect / axis-aligned chunks only.
// -----------------------------------------------------------------------------

function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

const GUN_COLD = {
  base: '#151518',
  hi:   '#333338',
  shd:  '#000000',
  bolt: '#55555a',
  seam: '#08080a',
};

function drawGun(ctx: CanvasRenderingContext2D, state: GameState, gun: Gun): void {
  const gx = gun.x;
  const gy = gun.y;
  const bw = gun.baseWidth;
  const bh = gun.baseHeight;
  const C = GUN_COLD;
  const heat = state.heat / MAX_HEAT;

  // Base platform — riveted bunker panels
  px(ctx, C.shd, gx - bw / 2, gy + bh - 2, bw, 2);
  px(ctx, C.base, gx - bw / 2, gy, bw, bh - 2);
  px(ctx, C.hi, gx - bw / 2, gy, bw, 1);
  // Vertical panel seams
  for (let i = Math.floor(-bw / 2) + 6; i < bw / 2 - 2; i += 8) {
    px(ctx, C.seam, gx + i, gy + 1, 1, bh - 3);
  }
  // Corner bolts
  px(ctx, C.bolt, gx - bw / 2 + 2, gy + 2, 2, 2);
  px(ctx, C.bolt, gx + bw / 2 - 4, gy + 2, 2, 2);
  px(ctx, C.bolt, gx - bw / 2 + 2, gy + bh - 5, 2, 2);
  px(ctx, C.bolt, gx + bw / 2 - 4, gy + bh - 5, 2, 2);

  // Mount plate (wider, beveled)
  px(ctx, C.shd, gx - 15, gy - 1, 30, 2);
  px(ctx, C.base, gx - 14, gy - 5, 28, 4);
  px(ctx, C.hi, gx - 14, gy - 5, 28, 1);
  px(ctx, C.bolt, gx - 13, gy - 3, 2, 2);
  px(ctx, C.bolt, gx + 11, gy - 3, 2, 2);

  // Ammo feed box (left side)
  px(ctx, C.shd, gx - 19, gy - 7, 5, 8);
  px(ctx, C.base, gx - 18, gy - 6, 3, 6);
  px(ctx, C.hi, gx - 18, gy - 6, 3, 1);
  px(ctx, C.bolt, gx - 17, gy - 4, 1, 1);
  px(ctx, C.bolt, gx - 17, gy - 1, 1, 1);

  // Coolant pipe (right side)
  px(ctx, C.bolt, gx + 14, gy - 8, 5, 1);
  px(ctx, C.bolt, gx + 18, gy - 8, 1, 5);
  px(ctx, C.bolt, gx + 14, gy - 4, 5, 1);

  // Turret dome — 3-step pyramid with rivets and viewport
  // Lower layer
  px(ctx, C.shd, gx - 16, gy - 8, 32, 1);
  px(ctx, C.base, gx - 15, gy - 9, 30, 3);
  px(ctx, C.hi, gx - 15, gy - 9, 30, 1);
  // Middle layer
  px(ctx, C.base, gx - 13, gy - 13, 26, 4);
  px(ctx, C.hi, gx - 13, gy - 13, 26, 1);
  px(ctx, C.shd, gx - 13, gy - 10, 26, 1);
  // Top layer
  px(ctx, C.base, gx - 9, gy - 17, 18, 4);
  px(ctx, C.hi, gx - 9, gy - 17, 18, 1);
  px(ctx, C.shd, gx - 9, gy - 14, 18, 1);
  // Dome cap
  px(ctx, C.hi, gx - 4, gy - 18, 8, 1);
  px(ctx, C.base, gx - 3, gy - 19, 6, 1);
  // Viewport slit (glows with heat; otherwise deep amber)
  const slit = heat > 0.25 ? heatGradient(state) : '#4a1810';
  px(ctx, slit, gx - 4, gy - 15, 8, 1);
  // Dome rivets
  px(ctx, C.bolt, gx - 12, gy - 12, 1, 1);
  px(ctx, C.bolt, gx + 11, gy - 12, 1, 1);
  px(ctx, C.bolt, gx - 8, gy - 16, 1, 1);
  px(ctx, C.bolt, gx + 7, gy - 16, 1, 1);

  // Antenna/spike on top
  px(ctx, C.bolt, gx - 1, gy - 22, 1, 3);
  px(ctx, C.hi, gx - 1, gy - 22, 1, 1);

  // Barrel (rotated)
  ctx.save();
  ctx.translate(gx, gy - 12);
  ctx.rotate(state.gunAngle);
  const L = GUN_LENGTH;
  // Recoil dampener block (barrel base)
  px(ctx, C.shd, -3, -5, 9, 11);
  px(ctx, C.base, -2, -4, 7, 9);
  px(ctx, C.hi, -2, -4, 7, 1);
  px(ctx, C.bolt, 0, -3, 1, 1);
  px(ctx, C.bolt, 3, -3, 1, 1);

  // Barrel shaft (7 thick)
  px(ctx, C.shd, 5, -4, L - 5, 1);
  px(ctx, C.base, 5, -3, L - 5, 6);
  px(ctx, C.hi, 5, -3, L - 5, 1);
  px(ctx, C.shd, 5, 3, L - 5, 1);
  // Heat shield rings (raised bands)
  for (let i = 11; i < L - 8; i += 6) {
    px(ctx, C.hi, i, -4, 1, 1);
    px(ctx, C.bolt, i, -4, 1, 8);
    px(ctx, C.hi, i, 3, 1, 1);
  }
  // Muzzle brake with perforations
  px(ctx, C.shd, L - 6, -5, 6, 11);
  px(ctx, C.base, L - 5, -4, 4, 9);
  px(ctx, C.hi, L - 5, -4, 4, 1);
  px(ctx, C.shd, L - 4, -2, 1, 1);
  px(ctx, C.shd, L - 4, 2, 1, 1);
  px(ctx, C.shd, L - 2, -2, 1, 1);
  px(ctx, C.shd, L - 2, 2, 1, 1);
  // Muzzle bore
  px(ctx, '#000', L - 1, -1, 1, 3);

  // Heat tint on barrel shaft as heat climbs
  if (heat > 0.25) {
    ctx.globalAlpha = Math.min(0.75, (heat - 0.25) * 1.4);
    px(ctx, heatGradient(state), 5, -3, L - 5, 6);
    ctx.globalAlpha = 1;
  }
  // Full orange glow at high heat / overheat
  if (heat > 0.7 || state.overheated) {
    ctx.globalAlpha = state.overheated ? 0.65 : (heat - 0.7) * 2;
    px(ctx, '#ff8020', 0, -6, L, 13);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawHelicopter(ctx: CanvasRenderingContext2D, h: Helicopter, frame: number): void {
  ctx.save();
  ctx.translate(Math.round(h.x), Math.round(h.y));
  ctx.scale(h.dir, 1);

  const base = shade(PAL.heliBase, h.tint);
  const hi = shade(PAL.heliHi, h.tint);
  const shd = shade(PAL.heliShd, h.tint);
  const out = PAL.heliOut;

  // Tail boom (extends back/left)
  px(ctx, out, -34, -4, 20, 8);
  px(ctx, shd, -33, -3, 18, 6);
  px(ctx, base, -33, -3, 18, 2);
  px(ctx, hi, -33, -3, 18, 1);

  // Tail stabilizer fin (vertical)
  px(ctx, out, -36, -10, 4, 10);
  px(ctx, shd, -35, -9, 2, 8);
  px(ctx, hi, -34, -9, 1, 4);

  // Tail rotor (small, animated)
  const tailSpin = Math.abs(Math.cos(frame * 0.5)) * 6 + 1;
  px(ctx, PAL.rotor, -38, -1 - tailSpin / 2, 2, tailSpin);
  px(ctx, PAL.rotorDim, -38, 0, 2, 1);

  // Main body — chunky rounded-ish box
  // Outline
  px(ctx, out, -16, -12, 32, 20);
  // Underbody shadow
  px(ctx, shd, -15, 4, 30, 4);
  // Main body fill
  px(ctx, base, -15, -11, 30, 16);
  // Top highlight
  px(ctx, hi, -14, -11, 28, 2);
  // Belly stripe
  px(ctx, shd, -14, 2, 28, 2);

  // Cockpit window (front)
  const glass = PAL.heliGlass;
  const glassHi = PAL.heliGlassHi;
  px(ctx, out, 7, -8, 10, 10);
  px(ctx, glass, 8, -7, 8, 8);
  px(ctx, glassHi, 9, -7, 3, 2);
  // Window frame
  px(ctx, out, 11, -7, 1, 8);

  // Panel lines / rivets on body
  px(ctx, shd, -6, -11, 1, 16);
  px(ctx, shd, 2, -11, 1, 16);
  px(ctx, out, -10, -10, 1, 1);
  px(ctx, out, -2, -10, 1, 1);
  px(ctx, out, 5, -10, 1, 1);

  // Skid landing gear
  px(ctx, out, -14, 8, 28, 1);
  px(ctx, out, -10, 6, 1, 3);
  px(ctx, out, 10, 6, 1, 3);
  px(ctx, PAL.rotorDim, -14, 9, 28, 1);

  // Rotor mast
  px(ctx, shd, -1, -15, 3, 4);
  px(ctx, out, -1, -16, 3, 1);

  // Main rotor — animated with thickness cycling (looks like it's spinning)
  const phase = frame * 0.45;
  const bladeLen = 28 + Math.floor(Math.cos(phase) * 2);
  const bladeThick = 1 + Math.floor((Math.abs(Math.sin(phase)) * 2));
  // Motion-blur ghost blade
  ctx.globalAlpha = 0.35;
  px(ctx, PAL.rotorDim, -bladeLen, -18, bladeLen * 2, bladeThick + 1);
  ctx.globalAlpha = 1;
  // Solid blade (shorter, visible)
  const solidLen = Math.abs(Math.cos(phase)) * bladeLen;
  px(ctx, PAL.rotor, -solidLen, -17, solidLen * 2, 1);
  px(ctx, PAL.rotorDim, -solidLen, -16, solidLen * 2, 1);
  // Hub
  px(ctx, out, -2, -17, 4, 2);
  px(ctx, PAL.rotor, -1, -17, 2, 1);

  // Exhaust port (rear under body)
  px(ctx, out, -18, -2, 2, 4);
  px(ctx, PAL.exhaust1, -17, -1, 1, 2);

  ctx.restore();
}

function drawJet(ctx: CanvasRenderingContext2D, j: Jet, frame: number): void {
  ctx.save();
  ctx.translate(Math.round(j.x), Math.round(j.y));
  ctx.scale(j.dir, 1);

  const base = shade(PAL.jetBase, j.tint);
  const hi = shade(PAL.jetHi, j.tint);
  const shd = shade(PAL.jetShd, j.tint);
  const wing = shade(PAL.jetWing, j.tint);
  const out = PAL.jetOut;

  // Afterburner trail (animated flicker)
  const flick = frame % 4;
  const trailLen = 10 + flick * 2;
  px(ctx, PAL.jetAB2, -28 - trailLen, -2, trailLen, 4);
  px(ctx, PAL.jetAB1, -28 - trailLen + 2, -1, trailLen - 2, 2);
  px(ctx, '#ffffff', -28 - 2, -1, 3, 2);

  // Swept wings (upper + lower)
  // Upper wing
  px(ctx, out, -10, -14, 20, 6);
  px(ctx, wing, -9, -13, 18, 4);
  px(ctx, hi, -9, -13, 18, 1);
  px(ctx, shd, -9, -10, 18, 1);
  // Lower wing
  px(ctx, out, -10, 8, 20, 6);
  px(ctx, wing, -9, 9, 18, 4);
  px(ctx, hi, -9, 9, 18, 1);
  px(ctx, shd, -9, 12, 18, 1);

  // Fuselage
  px(ctx, out, -26, -6, 52, 12);
  px(ctx, shd, -25, -5, 50, 10);
  px(ctx, base, -25, -5, 50, 7);
  px(ctx, hi, -25, -5, 50, 2);
  // Panel lines
  px(ctx, shd, -10, -5, 1, 10);
  px(ctx, shd, 4, -5, 1, 10);

  // Nose cone (pointed)
  px(ctx, out, 26, -4, 3, 8);
  px(ctx, base, 26, -3, 2, 6);
  px(ctx, out, 28, -2, 2, 4);
  px(ctx, hi, 26, -3, 2, 1);

  // Twin vertical stabilizers (tail fins)
  px(ctx, out, -24, -12, 6, 6);
  px(ctx, wing, -23, -11, 4, 5);
  px(ctx, hi, -23, -11, 4, 1);
  px(ctx, out, -18, -10, 5, 4);
  px(ctx, wing, -17, -9, 3, 3);

  // Cockpit canopy with pilot silhouette
  px(ctx, out, 10, -8, 12, 5);
  px(ctx, PAL.jetGlass, 11, -7, 10, 3);
  px(ctx, '#d0f4ff', 11, -7, 10, 1);
  // Pilot head silhouette
  px(ctx, PAL.jetPilot, 14, -6, 3, 2);
  px(ctx, PAL.jetPilot, 15, -7, 2, 1);

  // Intake shadow under fuselage
  px(ctx, out, -18, 4, 14, 3);
  px(ctx, shd, -17, 5, 12, 2);

  ctx.restore();
}

function drawBomb(ctx: CanvasRenderingContext2D, b: Bomb): void {
  ctx.save();
  ctx.translate(Math.round(b.x), Math.round(b.y));

  if (b.chuteOpen) {
    // Parachute canopy — stepped pixel arc
    px(ctx, PAL.chuteShd, -12, -16, 24, 2);
    px(ctx, PAL.chute, -11, -18, 22, 2);
    px(ctx, PAL.chute, -9, -20, 18, 2);
    px(ctx, PAL.chute, -6, -22, 12, 2);
    px(ctx, PAL.chuteHi, -6, -21, 4, 1);
    px(ctx, PAL.chuteHi, -9, -19, 3, 1);
    // Seams
    px(ctx, PAL.chuteShd, -4, -21, 1, 7);
    px(ctx, PAL.chuteShd, 3, -21, 1, 7);
    // Strings
    px(ctx, PAL.cord, -11, -15, 1, 2);
    px(ctx, PAL.cord, -9, -13, 1, 2);
    px(ctx, PAL.cord, -6, -11, 1, 2);
    px(ctx, PAL.cord, 5, -11, 1, 2);
    px(ctx, PAL.cord, 8, -13, 1, 2);
    px(ctx, PAL.cord, 10, -15, 1, 2);
  }

  // Bomb body (fat teardrop, axis-aligned chunks, nose down)
  // Top round
  px(ctx, PAL.bombShd, -3, -8, 6, 2);
  px(ctx, PAL.bombBase, -3, -6, 6, 12);
  px(ctx, PAL.bombHi, -3, -6, 1, 10);
  px(ctx, PAL.bombShd, 2, -6, 1, 10);
  // Mid highlight dot
  px(ctx, PAL.bombHi, -2, -4, 1, 3);
  // Taper toward nose
  px(ctx, PAL.bombBase, -2, 6, 4, 2);
  px(ctx, PAL.bombBase, -1, 8, 2, 2);
  // Red nose cone
  px(ctx, PAL.bombNose, -1, 9, 2, 2);
  px(ctx, '#ff8080', -1, 9, 1, 1);

  // Rivets on body
  px(ctx, PAL.bombShd, -1, -3, 1, 1);
  px(ctx, PAL.bombShd, -1, 0, 1, 1);
  px(ctx, PAL.bombShd, -1, 3, 1, 1);

  // Tail fins (4 fins, show 2 silhouettes from side)
  px(ctx, PAL.bombFin, -5, -10, 2, 5);
  px(ctx, PAL.bombFin, 3, -10, 2, 5);
  px(ctx, PAL.bombFin, -4, -5, 1, 2);
  px(ctx, PAL.bombFin, 3, -5, 1, 2);

  ctx.restore();
}

function drawParatrooper(ctx: CanvasRenderingContext2D, p: Paratrooper, frame: number): void {
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));

  // Flip for left-walking
  const flip = p.landed && p.vx < 0 ? -1 : 1;
  ctx.scale(flip, 1);

  const suit = shade(PAL.suit, p.tint);
  const suitShd = shade(PAL.suitShd, p.tint);
  const suitHi = shade(PAL.suitHi, p.tint);

  // Parachute when deployed and still airborne
  if (p.chuteOpen && !p.landed) {
    // Canopy — stepped dome
    px(ctx, PAL.chuteShd, -14, -22, 28, 2);
    px(ctx, PAL.chute,    -13, -24, 26, 2);
    px(ctx, PAL.chute,    -11, -26, 22, 2);
    px(ctx, PAL.chute,     -8, -28, 16, 2);
    px(ctx, PAL.chute,     -4, -30,  8, 2);
    // Top highlight
    px(ctx, PAL.chuteHi,   -4, -29, 4, 1);
    px(ctx, PAL.chuteHi,   -7, -27, 3, 1);
    // Canopy seams
    px(ctx, PAL.chuteStripe, -5, -28, 1, 6);
    px(ctx, PAL.chuteStripe,  4, -28, 1, 6);
    px(ctx, PAL.chuteShd,    -1, -29, 1, 7);
    // Harness cords
    px(ctx, PAL.cord, -13, -21, 1, 3);
    px(ctx, PAL.cord, -10, -18, 1, 3);
    px(ctx, PAL.cord,  -6, -15, 1, 3);
    px(ctx, PAL.cord,   6, -15, 1, 3);
    px(ctx, PAL.cord,  10, -18, 1, 3);
    px(ctx, PAL.cord,  13, -21, 1, 3);
  }

  // Body
  if (!p.landed && !p.chuteOpen) {
    // Tumbling: body rotated feel — use a slightly offset pose per frame
    const tum = Math.floor(frame / 4) % 2 === 0 ? 1 : -1;
    // Head
    px(ctx, PAL.helmet, -2, -6 + tum, 4, 3);
    px(ctx, PAL.helmetHi, -2, -6 + tum, 4, 1);
    px(ctx, PAL.skin, -2, -3 + tum, 4, 2);
    px(ctx, PAL.skinShd, -2, -2 + tum, 4, 1);
    // Torso (flight suit)
    px(ctx, suit, -3, 0, 6, 5);
    px(ctx, suitShd, -3, 4, 6, 1);
    px(ctx, suitHi, -3, 0, 1, 5);
    // Arms splayed out
    px(ctx, suit, -7, 0 - tum, 3, 2);
    px(ctx, suit,  4, 0 + tum, 3, 2);
    px(ctx, PAL.skin, -8, 0 - tum, 1, 2);
    px(ctx, PAL.skin,  7, 0 + tum, 1, 2);
    // Legs flailing
    px(ctx, suit, -3, 5, 2, 5);
    px(ctx, suit,  1, 5, 2, 5);
    px(ctx, PAL.boot, -3 + tum, 9, 2, 2);
    px(ctx, PAL.boot,  1 - tum, 9, 2, 2);
  } else {
    // Deployed (chute open) or landed
    // Head + helmet
    px(ctx, PAL.helmet, -3, -8, 6, 3);
    px(ctx, PAL.helmetHi, -3, -8, 6, 1);
    // Chin strap
    px(ctx, PAL.boot, -3, -5, 6, 1);
    // Face
    px(ctx, PAL.skin, -2, -4, 4, 2);
    px(ctx, PAL.skinShd, -2, -3, 4, 1);
    // Torso
    px(ctx, suit, -3, -2, 6, 7);
    px(ctx, suitHi, -3, -2, 1, 7);
    px(ctx, suitShd, -3, 4, 6, 1);
    // Chest strap / pocket
    px(ctx, suitShd, -2, 0, 4, 1);
    px(ctx, PAL.boot, -1, 1, 1, 1);

    if (p.landed) {
      // Walking: 2-frame cycle from frame counter
      const step = Math.floor(frame / 6) % 2;
      // Arms
      if (step === 0) {
        px(ctx, suit, -5, -1, 2, 4);
        px(ctx, suit,  3, -1, 2, 4);
      } else {
        px(ctx, suit, -5,  0, 2, 4);
        px(ctx, suit,  3,  0, 2, 4);
      }
      // Legs with alternating stride
      if (step === 0) {
        px(ctx, suit, -3, 5, 2, 4);
        px(ctx, suit,  1, 5, 2, 4);
        px(ctx, PAL.boot, -4, 9, 3, 2);
        px(ctx, PAL.boot,  1, 9, 3, 2);
      } else {
        px(ctx, suit, -3, 5, 2, 4);
        px(ctx, suit,  1, 5, 2, 4);
        px(ctx, PAL.boot, -3, 9, 3, 2);
        px(ctx, PAL.boot,  2, 9, 3, 2);
      }
    } else {
      // Chute descent: arms up holding harness
      px(ctx, suit, -6, -3, 2, 3);
      px(ctx, suit,  4, -3, 2, 3);
      px(ctx, PAL.skin, -6, -4, 1, 1);
      px(ctx, PAL.skin,  5, -4, 1, 1);
      // Legs hanging
      px(ctx, suit, -3, 5, 2, 4);
      px(ctx, suit,  1, 5, 2, 4);
      px(ctx, PAL.boot, -3, 9, 2, 2);
      px(ctx, PAL.boot,  1, 9, 2, 2);
    }
  }

  ctx.restore();
}

function drawExplosion(ctx: CanvasRenderingContext2D, e: { x: number; y: number; size: number; life: number }): void {
  const alpha = Math.max(0, Math.min(1, e.life));
  const r = e.size * (1 - e.life * 0.5);
  ctx.save();
  ctx.globalAlpha = alpha;
  const cx = Math.round(e.x);
  const cy = Math.round(e.y);
  const rInt = Math.max(1, Math.round(r));
  // Outer ring (dark smoke)
  pixelRing(ctx, cx, cy, rInt, PAL.exOuter);
  // Mid ring
  pixelRing(ctx, cx, cy, Math.max(1, Math.round(rInt * 0.75)), PAL.exMid);
  // Inner ring
  pixelRing(ctx, cx, cy, Math.max(1, Math.round(rInt * 0.5)), PAL.exFire);
  // Core
  if (rInt > 2) {
    px(ctx, PAL.exCore, cx - 1, cy - 1, 3, 3);
  }
  // Dithered sparks
  const sparks = 6;
  for (let i = 0; i < sparks; i++) {
    const ang = (i * Math.PI * 2) / sparks + e.life * 6;
    const sr = rInt + 2;
    const sx = Math.round(cx + Math.cos(ang) * sr);
    const sy = Math.round(cy + Math.sin(ang) * sr);
    px(ctx, PAL.exFire, sx, sy, 1, 1);
  }
  ctx.restore();
}

function pixelRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  if (r <= 0) return;
  ctx.fillStyle = color;
  // Midpoint circle algorithm, plot single pixels
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    ctx.fillRect(cx + x, cy + y, 1, 1);
    ctx.fillRect(cx + y, cy + x, 1, 1);
    ctx.fillRect(cx - y, cy + x, 1, 1);
    ctx.fillRect(cx - x, cy + y, 1, 1);
    ctx.fillRect(cx - x, cy - y, 1, 1);
    ctx.fillRect(cx - y, cy - x, 1, 1);
    ctx.fillRect(cx + y, cy - x, 1, 1);
    ctx.fillRect(cx + x, cy - y, 1, 1);
    y++;
    if (err < 0) {
      err += 2 * y + 1;
    } else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

function drawBullet(ctx: CanvasRenderingContext2D, b: { x: number; y: number; vx: number; vy: number; explosive: boolean }): void {
  const bx = Math.round(b.x);
  const by = Math.round(b.y);
  const sp = Math.max(0.01, Math.hypot(b.vx, b.vy));
  const dx = -b.vx / sp;
  const dy = -b.vy / sp;
  if (b.explosive) {
    // Glowing ball head
    px(ctx, PAL.bulletTail, bx - 3, by - 1, 1, 3);
    px(ctx, PAL.bulletTail, bx + 3, by - 1, 1, 3);
    px(ctx, PAL.bulletTail, bx - 1, by - 3, 3, 1);
    px(ctx, PAL.bulletTail, bx - 1, by + 3, 3, 1);
    px(ctx, PAL.bulletMid, bx - 2, by - 2, 5, 5);
    px(ctx, PAL.bulletHead, bx - 1, by - 1, 3, 3);
    // Smoky tail behind
    const tailLen = 12;
    ctx.save();
    for (let i = 4; i < tailLen; i++) {
      const tx = Math.round(bx + dx * i);
      const ty = Math.round(by + dy * i);
      ctx.globalAlpha = Math.max(0, 1 - i / tailLen);
      ctx.fillStyle = i < 7 ? PAL.bulletMid : PAL.bulletTail;
      ctx.fillRect(tx, ty, 1, 1);
    }
    ctx.restore();
  } else {
    // Long tracer — bright head fading to red smoke trail
    const len = 16;
    ctx.save();
    // Head (2px bright core)
    px(ctx, PAL.bulletHead, bx, by, 1, 1);
    px(ctx, PAL.bulletHead, bx + Math.round(dx * -0.5), by + Math.round(dy * -0.5), 1, 1);
    for (let i = 1; i < len; i++) {
      const tx = Math.round(bx + dx * i);
      const ty = Math.round(by + dy * i);
      const f = i / len;
      let color: string;
      if (f < 0.15) color = PAL.bulletHead;
      else if (f < 0.4) color = PAL.bulletMid;
      else color = PAL.bulletTail;
      ctx.globalAlpha = Math.max(0, 1 - f * 1.05);
      ctx.fillStyle = color;
      ctx.fillRect(tx, ty, 1, 1);
    }
    ctx.restore();
  }
}

// -----------------------------------------------------------------------------
// World layer — everything rendered to pixel buffer
// -----------------------------------------------------------------------------
function drawWorld(
  pbCtx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
  gun: Gun,
  stars: Star[],
): void {
  const W = canvas.width;
  const H = canvas.height;

  // Sky — vertical gradient, blended across day↔night
  const t = state.dayNight;
  const horizonY = Math.round(H * 0.55);
  const skyTop = blend(PAL.skyDay1, PAL.skyNight1, t);
  const skyMid = blend('#5a9ccc', '#0a0e22', t);
  const skyBot = blend(PAL.skyDay2, PAL.skyNight2, t);
  const skyGrad = pbCtx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, skyTop);
  skyGrad.addColorStop(0.55, skyMid);
  skyGrad.addColorStop(1, skyBot);
  pbCtx.fillStyle = skyGrad;
  pbCtx.fillRect(0, 0, W, horizonY);
  // Lower haze band (below horizon)
  pbCtx.fillStyle = skyBot;
  pbCtx.fillRect(0, horizonY, W, H - horizonY);

  // Stars (fade in with night) + clouds (fade out into night)
  const starA = Math.max(0, t - 0.2) / 0.8;
  const cloudA = Math.max(0, 1 - t * 1.4);
  if (starA > 0.01) {
    for (const star of stars) {
      const alpha = (0.5 + Math.sin(state.frame * 0.02 + star.twinkle) * 0.3) * starA;
      pbCtx.globalAlpha = alpha;
      pbCtx.fillStyle = '#fff';
      const sx = Math.round(star.x * W);
      const sy = Math.round(star.y * H * 0.6);
      const sz = Math.max(1, Math.round(star.size));
      pbCtx.fillRect(sx, sy, sz, sz);
      if (sz >= 2) {
        pbCtx.fillStyle = '#cceeff';
        pbCtx.fillRect(sx - 1, sy, 1, 1);
        pbCtx.fillRect(sx + sz, sy, 1, 1);
      }
    }
    pbCtx.globalAlpha = 1;
  }
  if (cloudA > 0.01) {
    pbCtx.globalAlpha = cloudA;
    pbCtx.fillStyle = PAL.cloud;
    for (let i = 0; i < 5; i++) {
      const cx = Math.round(((state.frame * 0.1 + i * 200) % (W + 100)) - 50);
      const cy = Math.round(30 + i * 25 + Math.sin(i * 2.5) * 15);
      const w = 40 + i * 8;
      const h = 6 + i;
      pbCtx.fillRect(cx - w / 2, cy, w, h);
      pbCtx.fillRect(cx - w / 2 + 6, cy - 3, w - 12, 3);
      pbCtx.fillRect(cx - w / 2 + 12, cy - 5, w - 24, 2);
    }
    pbCtx.globalAlpha = 1;
  }

  // City skyline (blended day↔night)
  const groundY = H - 30;
  const buildingSeed = [0.1, 0.25, 0.35, 0.45, 0.55, 0.62, 0.72, 0.8, 0.9];
  const buildingH = [60, 90, 45, 110, 70, 55, 85, 65, 50];
  const buildingW = [30, 22, 35, 18, 28, 40, 20, 32, 25];
  const bldgColor = blend(PAL.bldgDay, PAL.bldgNight, t);
  const bldgShade = blend('#334455', '#05050a', t);
  const bldgEdge = blend('#556677', '#101020', t);
  for (let i = 0; i < buildingSeed.length; i++) {
    const bx = Math.round(buildingSeed[i]! * W);
    const bh = buildingH[i]!;
    const bw = buildingW[i]!;
    const left = Math.round(bx - bw / 2);
    pbCtx.fillStyle = bldgColor;
    pbCtx.fillRect(left, groundY - bh, bw, bh);
    pbCtx.fillStyle = bldgEdge;
    pbCtx.fillRect(left, groundY - bh, 1, bh);
    pbCtx.fillStyle = bldgShade;
    pbCtx.fillRect(left + bw - 1, groundY - bh, 1, bh);
    pbCtx.fillStyle = bldgShade;
    pbCtx.fillRect(left, groundY - bh, bw, 1);
    for (let wy = groundY - bh + 8; wy < groundY - 5; wy += 12) {
      for (let wx = left + 4; wx < left + bw - 4; wx += 8) {
        const winOn = ((wx * 7 + wy * 13 + i * 31) % 10) > 3;
        if (winOn && t > 0.05) {
          pbCtx.globalAlpha = Math.min(1, t * 1.2);
          pbCtx.fillStyle = PAL.bldgWinOn;
          pbCtx.fillRect(wx, wy, 4, 5);
          pbCtx.globalAlpha = 1;
        }
        // Base unlit window pane (daytime look)
        if (t < 0.9) {
          pbCtx.globalAlpha = 1 - Math.max(0, t - 0.05) * 1.05;
          pbCtx.fillStyle = PAL.bldgWinOff;
          pbCtx.fillRect(wx, wy, 4, 5);
          pbCtx.globalAlpha = 1;
        }
      }
    }
  }

  // Ground (blended)
  const groundMain = blend(PAL.groundDay, PAL.groundNight, t);
  const groundDark = blend(PAL.groundDayDark, PAL.groundNightDark, t);
  pbCtx.fillStyle = groundMain;
  pbCtx.fillRect(0, groundY, W, 30);
  pbCtx.fillStyle = groundDark;
  pbCtx.fillRect(0, groundY, W, 3);
  for (let x = 0; x < W; x += 5) {
    pbCtx.fillStyle = groundDark;
    pbCtx.fillRect(x + ((x * 7) % 3), groundY + 5 + ((x * 3) % 4), 1, 1);
  }

  // Title screen early-exit (no entities yet)
  if (!state.started) return;

  // Bullets
  for (const b of state.bullets) {
    drawBullet(pbCtx, b);
  }

  // Power-up crates — chunky pixel
  for (const pu of state.powerups) {
    const pt = POWERUP_TYPES.find(t => t.type === pu.type);
    if (!pt) continue;
    const px0 = Math.round(pu.x);
    const py0 = Math.round(pu.y);
    // Pulsing glow box (alpha dithered)
    const pulse = Math.sin(state.frame * 0.1);
    pbCtx.globalAlpha = 0.25 + pulse * 0.1;
    pbCtx.fillStyle = pt.color;
    pbCtx.fillRect(px0 - 16, py0 - 16, 32, 32);
    pbCtx.globalAlpha = 1;
    // Crate box
    pbCtx.fillStyle = '#333';
    pbCtx.fillRect(px0 - 12, py0 - 12, 24, 24);
    pbCtx.fillStyle = '#555';
    pbCtx.fillRect(px0 - 12, py0 - 12, 24, 1);
    pbCtx.fillStyle = '#222';
    pbCtx.fillRect(px0 - 12, py0 + 11, 24, 1);
    // Border
    pbCtx.fillStyle = pt.color;
    pbCtx.fillRect(px0 - 12, py0 - 12, 24, 1);
    pbCtx.fillRect(px0 - 12, py0 + 11, 24, 1);
    pbCtx.fillRect(px0 - 12, py0 - 12, 1, 24);
    pbCtx.fillRect(px0 + 11, py0 - 12, 1, 24);
    // Cross lines
    pbCtx.fillStyle = '#666';
    pbCtx.fillRect(px0 - 12, py0, 24, 1);
    pbCtx.fillRect(px0, py0 - 12, 1, 24);
    // Symbol (small chunky, rendered as pixel text via fillText on buffer)
    pbCtx.fillStyle = pt.color;
    pbCtx.font = 'bold 18px monospace';
    pbCtx.textAlign = 'center';
    pbCtx.textBaseline = 'alphabetic';
    pbCtx.fillText(pt.symbol, px0, py0 + 6);
    // Sparkles as single pixels
    const sparkleAngle = state.frame * 0.05;
    for (let i = 0; i < 4; i++) {
      const a = sparkleAngle + (i * Math.PI) / 2;
      const sx = Math.round(px0 + Math.cos(a) * 18);
      const sy = Math.round(py0 + Math.sin(a) * 18);
      pbCtx.fillStyle = pt.color;
      pbCtx.globalAlpha = 0.6 + Math.sin(state.frame * 0.15 + i) * 0.3;
      pbCtx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    pbCtx.globalAlpha = 1;
  }

  // Helicopters
  for (const h of state.helicopters) {
    drawHelicopter(pbCtx, h, state.frame);
  }

  // Jets
  for (const j of state.jets) {
    drawJet(pbCtx, j, state.frame);
  }

  // Bombs
  for (const b of state.bombs) {
    drawBomb(pbCtx, b);
  }

  // Paratroopers
  for (const p of state.paratroopers) {
    drawParatrooper(pbCtx, p, state.frame);
  }

  // Gun
  if (!state.gunDestroyed) {
    drawGun(pbCtx, state, gun);
  }

  // Explosions (pixel rings)
  for (const e of state.explosions) {
    drawExplosion(pbCtx, e);
  }

  // Laser sight — stepped dotted line
  if (state.activePowerups.has('laser')) {
    const laserLen = Math.max(W, H);
    const sx = gun.x;
    const sy = gun.y - 8;
    const ex = sx + Math.cos(state.gunAngle) * laserLen;
    const ey = sy + Math.sin(state.gunAngle) * laserLen;
    const dx = ex - sx;
    const dy = ey - sy;
    const steps = Math.ceil(Math.hypot(dx, dy));
    const pulse = 0.3 + Math.sin(state.frame * 0.2) * 0.15;
    pbCtx.globalAlpha = pulse + 0.3;
    pbCtx.fillStyle = '#ff4040';
    for (let i = 0; i < steps; i += 2) {
      const t = i / steps;
      const lx = Math.round(sx + dx * t);
      const ly = Math.round(sy + dy * t);
      pbCtx.fillRect(lx, ly, 1, 1);
    }
    // Muzzle dot
    pbCtx.globalAlpha = 1;
    pbCtx.fillStyle = '#ff8080';
    const mx = Math.round(gun.x + Math.cos(state.gunAngle) * GUN_LENGTH);
    const my = Math.round(gun.y - 8 + Math.sin(state.gunAngle) * GUN_LENGTH);
    pbCtx.fillRect(mx - 1, my - 1, 3, 3);
  }

  // Smoke puffs
  for (const s of state.smokePuffs) {
    const alpha = s.life * 0.5;
    pbCtx.globalAlpha = alpha;
    pbCtx.fillStyle = '#c8c8c8';
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    const sz = Math.max(1, Math.round(s.size));
    pbCtx.fillRect(sx - sz, sy - sz, sz * 2, sz * 2);
    pbCtx.fillStyle = '#aaaaaa';
    pbCtx.fillRect(sx - sz + 1, sy - sz + 1, 2, 2);
  }
  pbCtx.globalAlpha = 1;

  // Missiles
  for (const m of state.missiles) {
    const angle = Math.atan2(m.vy, m.vx);
    pbCtx.save();
    pbCtx.translate(Math.round(m.x), Math.round(m.y));
    pbCtx.rotate(angle + Math.PI / 2);
    // Flame
    pbCtx.fillStyle = '#ff8020';
    pbCtx.fillRect(-2, 4, 4, 4);
    pbCtx.fillStyle = '#ffd040';
    pbCtx.fillRect(-1, 5, 2, 3);
    // Body
    pbCtx.fillStyle = '#444';
    pbCtx.fillRect(-1, -6, 3, 10);
    pbCtx.fillStyle = '#ddd';
    pbCtx.fillRect(-1, -6, 1, 10);
    pbCtx.fillStyle = '#888';
    pbCtx.fillRect(1, -6, 1, 10);
    // Fins
    pbCtx.fillStyle = '#555';
    pbCtx.fillRect(-2, 2, 1, 3);
    pbCtx.fillRect(2, 2, 1, 3);
    // Nose
    pbCtx.fillStyle = '#f44';
    pbCtx.fillRect(-1, -7, 3, 2);
    pbCtx.fillStyle = '#ff8080';
    pbCtx.fillRect(0, -7, 1, 1);
    pbCtx.restore();
  }

  // Debris — axis-aligned pixel chunks (rotation visibly flickers between states)
  for (const d of state.debris) {
    pbCtx.save();
    pbCtx.translate(Math.round(d.x), Math.round(d.y));
    pbCtx.rotate(d.rotation);
    pbCtx.fillStyle = d.color;
    const s = Math.max(1, Math.round(d.size));
    pbCtx.fillRect(-s / 2, -1, s, 2);
    pbCtx.restore();
  }

  // Destroyed gun debris (world-space)
  if (state.gunDestroyed) {
    const gx = gun.x;
    const gy = gun.y;
    pbCtx.fillStyle = '#556';
    pbCtx.fillRect(Math.round(gx - 20), Math.round(gy + 4), 14, 8);
    pbCtx.fillRect(Math.round(gx + 6), Math.round(gy + 2), 10, 6);
    pbCtx.fillRect(Math.round(gx - 6), Math.round(gy + 8), 16, 4);
    pbCtx.fillStyle = '#222';
    pbCtx.fillRect(Math.round(gx - 20), Math.round(gy + 11), 14, 1);
    pbCtx.fillRect(Math.round(gx - 6), Math.round(gy + 11), 16, 1);

    // Smoke puffs (chunky)
    for (let i = 0; i < 3; i++) {
      const smokeOffset = (state.frame * (0.5 + i * 0.3)) % 40;
      const smokeAlpha = (40 - smokeOffset) / 80;
      pbCtx.globalAlpha = smokeAlpha;
      pbCtx.fillStyle = '#888';
      const psx = Math.round(gx + (i - 1) * 10);
      const psy = Math.round(gy - smokeOffset);
      const sz = 4 + i * 2;
      pbCtx.fillRect(psx - sz, psy - sz, sz * 2, sz * 2);
      pbCtx.fillStyle = '#bbb';
      pbCtx.fillRect(psx - sz + 1, psy - sz + 1, 2, 2);
    }
    pbCtx.globalAlpha = 1;
  }

  // Night mode mask — composited onto the pixel buffer so the darkness is
  // pixelated too. Fades in/out with state.dayNight.
  const nt = state.dayNight;
  if (nt > 0.01 && !state.gameOver) {
    if (!nightCanvas || nightCanvas.width !== W || nightCanvas.height !== H) {
      nightCanvas = document.createElement('canvas');
      nightCanvas.width = W;
      nightCanvas.height = H;
    }
    const nctx = nightCanvas.getContext('2d');
    if (nctx) {
      nctx.clearRect(0, 0, W, H);
      nctx.fillStyle = `rgba(0, 0, 15, ${0.9 * nt})`;
      nctx.fillRect(0, 0, W, H);
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
      nctx.beginPath();
      nctx.arc(gun.x, gun.y, 50, 0, Math.PI * 2);
      const gg = nctx.createRadialGradient(gun.x, gun.y, 0, gun.x, gun.y, 50);
      gg.addColorStop(0, 'rgba(0,0,0,0.8)');
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = gg;
      nctx.fill();
      nctx.globalCompositeOperation = 'source-over';
      pbCtx.drawImage(nightCanvas, 0, 0);

      // Redraw tracers on top of darkness so they're visible outside the spotlight
      for (const b of state.bullets) {
        drawBullet(pbCtx, b);
      }

      // Spotlight additive tint (fades with night)
      pbCtx.save();
      pbCtx.globalCompositeOperation = 'lighter';
      pbCtx.globalAlpha = nt;
      pbCtx.beginPath();
      pbCtx.moveTo(gx, gy);
      pbCtx.arc(gx, gy, spotLen, spotAngle - spotWidth, spotAngle + spotWidth);
      pbCtx.closePath();
      const beamGrad = pbCtx.createRadialGradient(gx, gy, 10, gx, gy, spotLen);
      beamGrad.addColorStop(0, 'rgba(220, 230, 255, 0.22)');
      beamGrad.addColorStop(0.5, 'rgba(200, 220, 255, 0.12)');
      beamGrad.addColorStop(1, 'rgba(180, 200, 255, 0)');
      pbCtx.fillStyle = beamGrad;
      pbCtx.fill();
      pbCtx.restore();

      // Lit building windows on top (fade in with night)
      pbCtx.globalAlpha = nt;
      const groundYNight = H - 30;
      for (let i = 0; i < buildingSeed.length; i++) {
        const bx = Math.round(buildingSeed[i]! * W);
        const bh = buildingH[i]!;
        const bw = buildingW[i]!;
        for (let wy = groundYNight - bh + 8; wy < groundYNight - 5; wy += 12) {
          for (let wx = bx - bw / 2 + 4; wx < bx + bw / 2 - 4; wx += 8) {
            const winOn = ((wx * 7 + wy * 13 + i * 31) % 10) > 3;
            if (winOn) {
              pbCtx.fillStyle = PAL.bldgWinOn;
              pbCtx.fillRect(Math.round(wx), Math.round(wy), 4, 5);
            }
          }
        }
      }
      pbCtx.globalAlpha = 1;
    }
  }
}

// -----------------------------------------------------------------------------
// HUD layer — drawn on main ctx after the buffer blit for crisp text
// -----------------------------------------------------------------------------
function drawHUD(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
): void {
  const W = canvas.width;
  const H = canvas.height;

  // Title screen overlay
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

  // Floating texts
  for (const ft of state.floatingTexts) {
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Landed indicators
  drawLandedIndicators(ctx, canvas, state);

  // Score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(state.score), W / 2, 28);
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText(`HI ${state.highScore}`, W / 2, 46);

  // Wave indicator
  ctx.fillStyle = '#adf';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`WAVE ${state.wave}`, 10, 22);

  // Combo
  if (state.combo > 1) {
    ctx.fillStyle = '#ff4';
    ctx.font = `bold ${14 + Math.min(state.combo, 8)}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(`x${state.combo} COMBO`, W - 10, 22);
  }

  // Active power-up indicators
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

  // Heat warning
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

  // Wave complete
  if (state.wavePause && !state.waveAnnounceTimer) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, H / 2 - 30, W, 60);
    ctx.fillStyle = '#4f4';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave} COMPLETE`, W / 2, H / 2 + 8);
  }

  // Danger warning
  const maxLanded: number = S('paratrooper', 'maxLanded');
  if ((state.landedLeft >= maxLanded - 1 || state.landedRight >= maxLanded - 1) && state.frame % 40 < 20) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DANGER', W / 2, H - 60);
  }

  // Settings menu
  if (state.settingsOpen) {
    drawSettingsMenu(ctx, canvas, state);
  }

  // Game over
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

// -----------------------------------------------------------------------------
// Top-level draw: renders world to pixel buffer, blits upscaled, then HUD
// -----------------------------------------------------------------------------
function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState, gun: Gun, stars: Star[]): void {
  const { pb, pbCtx } = getPixelBuffer(canvas);

  // Render world into the low-res buffer using logic-space coordinates.
  pbCtx.setTransform(1 / PIXEL_SCALE, 0, 0, 1 / PIXEL_SCALE, 0, 0);
  pbCtx.imageSmoothingEnabled = false;
  // Clear buffer in logic space
  pbCtx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld(pbCtx, canvas, state, gun, stars);
  pbCtx.setTransform(1, 0, 0, 1, 0, 0);

  // Blit upscaled, nearest-neighbor, onto main canvas
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(pb, 0, 0, pb.width, pb.height, 0, 0, canvas.width, canvas.height);

  // HUD on crisp main canvas
  drawHUD(ctx, canvas, state);
}

export { draw };
