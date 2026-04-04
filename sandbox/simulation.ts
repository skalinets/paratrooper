import { createState, resetState } from '../src/state';
import { update, startWave } from '../src/update';
import { shoot } from '../src/combat';
import { settings } from '../src/config';
import type { GameState, Gun, CanvasSize, SettingsCategory, Settings } from '../src/types';

/** Deep-clone settings so each Simulation instance is isolated */
function cloneSettings(): Settings {
  const clone = {} as Record<string, Record<string, { val: number; min: number; max: number; step: number; label: string }>>;
  for (const [cat, params] of Object.entries(settings)) {
    clone[cat] = {};
    for (const [key, param] of Object.entries(params as Record<string, { val: number; min: number; max: number; step: number; label: string }>)) {
      clone[cat][key] = { ...param };
    }
  }
  return clone as unknown as Settings;
}

/** Swap local settings into the global singleton, return backup for restore */
function swapSettings(local: Settings): Settings {
  const backup = cloneSettings();
  for (const [cat, params] of Object.entries(local)) {
    for (const [key, param] of Object.entries(params as Record<string, { val: number }>)) {
      const global = (settings[cat as SettingsCategory] as Record<string, { val: number }>)[key];
      if (global) global.val = param.val;
    }
  }
  return backup;
}

/** Restore settings from a backup */
function restoreSettings(backup: Settings): void {
  for (const [cat, params] of Object.entries(backup)) {
    for (const [key, param] of Object.entries(params as Record<string, { val: number }>)) {
      const global = (settings[cat as SettingsCategory] as Record<string, { val: number }>)[key];
      if (global) global.val = param.val;
    }
  }
}

/** Actions the agent can take */
export const enum Action {
  RotateLeft = 0,
  RotateRight = 1,
  Shoot = 2,
  ShootRotateLeft = 3,
  ShootRotateRight = 4,
}

const ROTATION_SPEED = 0.03;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;
const OBS_SIZE = 56;
const MAX_ENEMIES = 10;
const ENEMY_FEATURES = 5; // type, x, y, vx, vy

export interface StepResult {
  observation: Float64Array;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: Record<string, number>;
}

export interface SimulationConfig {
  frameSkip: number;
  maxSteps: number;
  canvasWidth: number;
  canvasHeight: number;
}

const DEFAULT_CONFIG: SimulationConfig = {
  frameSkip: 4,
  maxSteps: 10000,
  canvasWidth: CANVAS_WIDTH,
  canvasHeight: CANVAS_HEIGHT,
};

interface Enemy {
  type: number; // 0=helicopter, 1=jet, 2=paratrooper, 3=bomb
  x: number;
  y: number;
  vx: number;
  vy: number;
  dist: number;
}

export class Simulation {
  private state: GameState;
  private canvas: CanvasSize;
  private gun: Gun;
  private config: SimulationConfig;
  private stepCount: number = 0;
  private localSettings: Settings;

  constructor(config?: Partial<SimulationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvas = { width: this.config.canvasWidth, height: this.config.canvasHeight };
    this.state = createState();
    this.gun = this.makeGun();
    this.localSettings = cloneSettings();
  }

  private makeGun(): Gun {
    const w = this.config.canvasWidth;
    const h = this.config.canvasHeight;
    return {
      get x() { return w / 2; },
      get y() { return h - 20; },
      baseWidth: 40,
      baseHeight: 15,
    };
  }

  reset(): Float64Array {
    const backup = swapSettings(this.localSettings);
    try {
      resetState(this.state);
      this.state.started = true;
      startWave(this.state);
      this.stepCount = 0;
      return this.getObservation();
    } finally {
      restoreSettings(backup);
    }
  }

  step(action: number): StepResult {
    const backup = swapSettings(this.localSettings);
    try {
      const prevScore = this.state.score;

      for (let i = 0; i < this.config.frameSkip; i++) {
        this.applyAction(action);
        update(this.state, this.canvas, this.gun);

        if (this.state.gameOver) break;
      }

      this.stepCount++;
      const terminated = this.state.gameOver;
      const truncated = !terminated && this.stepCount >= this.config.maxSteps;

      let reward = (this.state.score - prevScore) / 100;
      if (terminated) reward -= 10.0;

      return {
        observation: this.getObservation(),
        reward,
        terminated,
        truncated,
        info: {
          score: this.state.score,
          wave: this.state.wave,
          combo: this.state.combo,
          landed_left: this.state.landedLeft,
          landed_right: this.state.landedRight,
          frame: this.state.frame,
          step: this.stepCount,
        },
      };
    } finally {
      restoreSettings(backup);
    }
  }

  private applyAction(action: number): void {
    const s = this.state;
    if (s.gameOver || s.endSequence) return;
    if (action < 0 || action > 4) return; // Ignore invalid actions

    const rotate = action === Action.RotateLeft || action === Action.ShootRotateLeft;
    const rotateRight = action === Action.RotateRight || action === Action.ShootRotateRight;
    const shouldShoot = action === Action.Shoot || action === Action.ShootRotateLeft || action === Action.ShootRotateRight;

    if (rotate) s.gunAngle -= ROTATION_SPEED;
    if (rotateRight) s.gunAngle += ROTATION_SPEED;

    // Clamp angle
    if (s.gunAngle > 0) s.gunAngle = 0;
    if (s.gunAngle < -Math.PI) s.gunAngle = -Math.PI;

    if (shouldShoot) {
      s.fireTimer++;
      if (s.fireTimer >= settings.turret.fireRate.val) {
        s.fireTimer = 0;
        shoot(s, this.gun);
      }
    } else {
      s.fireTimer = 999; // Reset fire timer like input.ts does
    }
  }

  getObservation(): Float64Array {
    const obs = new Float64Array(OBS_SIZE);
    const s = this.state;
    const w = this.config.canvasWidth;
    const h = this.config.canvasHeight;

    // Scalar features (6)
    obs[0] = s.gunAngle / Math.PI; // [-1, 0]
    obs[1] = s.heat / 100; // [0, 1]
    obs[2] = Math.min(s.combo / 8, 1); // [0, 1] clamped
    obs[3] = Math.min(s.wave / 20, 1); // [0, 1] clamped
    obs[4] = s.landedLeft / 4; // [0, 1]
    obs[5] = s.landedRight / 4; // [0, 1]

    // Gather all enemies with distance to gun
    const enemies: Enemy[] = [];
    const gx = this.gun.x;
    const gy = this.gun.y;

    for (const h2 of s.helicopters) {
      enemies.push({
        type: 0,
        x: h2.x / w,
        y: h2.y / h,
        vx: (h2.dir * h2.speed) / 10,
        vy: 0,
        dist: Math.hypot(h2.x - gx, h2.y - gy),
      });
    }
    for (const j of s.jets) {
      enemies.push({
        type: 0.33,
        x: j.x / w,
        y: j.y / h,
        vx: (j.dir * j.speed) / 10,
        vy: 0,
        dist: Math.hypot(j.x - gx, j.y - gy),
      });
    }
    for (const p of s.paratroopers) {
      if (p.landed) continue;
      enemies.push({
        type: 0.67,
        x: p.x / w,
        y: p.y / h,
        vx: p.vx / 5,
        vy: p.vy / 5,
        dist: Math.hypot(p.x - gx, p.y - gy),
      });
    }
    for (const b of s.bombs) {
      enemies.push({
        type: 1,
        x: b.x / w,
        y: b.y / h,
        vx: (b.vx ?? 0) / 5,
        vy: b.vy / 5,
        dist: Math.hypot(b.x - gx, b.y - gy),
      });
    }

    // Sort by distance, take top 10
    enemies.sort((a, b) => a.dist - b.dist);

    for (let i = 0; i < MAX_ENEMIES; i++) {
      const base = 6 + i * ENEMY_FEATURES;
      const e = enemies[i];
      if (e) {
        obs[base] = e.type;
        obs[base + 1] = e.x;
        obs[base + 2] = e.y;
        obs[base + 3] = e.vx;
        obs[base + 4] = e.vy;
      }
      // else: zeros (no enemy in this slot)
    }

    return obs;
  }

  /** Configure game settings between episodes (per-instance, isolated) */
  configure(params: Record<string, Record<string, number>>): void {
    for (const [category, keys] of Object.entries(params)) {
      const cat = (this.localSettings as unknown as Record<string, Record<string, { val: number }>>)[category];
      if (!cat) continue;
      for (const [key, value] of Object.entries(keys)) {
        const param = cat[key];
        if (param) param.val = value;
      }
    }
  }

  /** Get current config values (from this instance's isolated settings) */
  getConfig(): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    for (const [cat, params] of Object.entries(this.localSettings)) {
      result[cat] = {};
      for (const [key, param] of Object.entries(params as Record<string, { val: number }>)) {
        result[cat][key] = param.val;
      }
    }
    return result;
  }

  /** Get raw game state (for debugging) */
  getState(): Readonly<GameState> {
    return this.state;
  }
}
