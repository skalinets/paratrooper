import { S, settings, settingsCategories, dumpConfig } from './config';
import type { GameState, Gun, SettingsCategory } from './types';
import { shoot } from './combat';
import { startWave } from './update';
import { resetState } from './state';

export const keysDown: Record<string, boolean> = {};
export const touchState = { left: false, right: false, fire: false };
type TouchKey = keyof typeof touchState;

export function setupInput(state: GameState, canvas: HTMLCanvasElement): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    keysDown[e.code] = true;

    if (e.code === 'KeyS') {
      state.settingsOpen = !state.settingsOpen;
      state.settingsParam = 0;
      return;
    }
    if (e.code === 'KeyD') {
      dumpConfig();
      return;
    }
    if (state.settingsOpen) {
      e.preventDefault();
      const cat = settingsCategories[state.settingsCategory] as SettingsCategory;
      const params = Object.keys(settings[cat]);

      if (!state.settingsDrillDown) {
        // Category level navigation
        if (e.code === 'ArrowUp') {
          state.settingsCategory = (state.settingsCategory - 1 + settingsCategories.length) % settingsCategories.length;
        } else if (e.code === 'ArrowDown') {
          state.settingsCategory = (state.settingsCategory + 1) % settingsCategories.length;
        } else if (e.code === 'ArrowRight' || e.code === 'Enter') {
          state.settingsDrillDown = true;
          state.settingsParam = 0;
        } else if (e.code === 'Escape') {
          state.settingsOpen = false;
        }
      } else {
        // Parameter level navigation
        if (e.code === 'ArrowUp') {
          state.settingsParam--;
          if (state.settingsParam < 0) state.settingsParam = params.length - 1;
        } else if (e.code === 'ArrowDown') {
          state.settingsParam++;
          if (state.settingsParam >= params.length) state.settingsParam = 0;
        } else if (e.code === 'ArrowLeft' || e.code === 'Comma') {
          const p = (settings[cat] as Record<string, { val: number; min: number; max: number; step: number }>)[params[state.settingsParam]!]!;
          p.val = Math.max(p.min, +(p.val - p.step).toFixed(6));
        } else if (e.code === 'ArrowRight' || e.code === 'Period') {
          const p = (settings[cat] as Record<string, { val: number; min: number; max: number; step: number }>)[params[state.settingsParam]!]!;
          p.val = Math.min(p.max, +(p.val + p.step).toFixed(6));
        } else if (e.code === 'Escape') {
          state.settingsDrillDown = false;
        }
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (state.gameOver && state.canRestart) { resetState(state); state.started = true; startWave(state); }
      else if (state.endSequence) return;
      else if (!state.started) { state.started = true; startWave(state); }
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (state.gameOver && state.canRestart) { resetState(state); state.started = true; startWave(state); }
      else if (!state.started) { state.started = true; startWave(state); }
    }
  });

  document.addEventListener('keyup', (e: KeyboardEvent) => { keysDown[e.code] = false; });

  function bindTouchBtn(id: string, key: TouchKey): void {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (): void => { touchState[key] = true; el.classList.add('pressed'); };
    const end = (): void => { touchState[key] = false; el.classList.remove('pressed'); };
    el.addEventListener('touchstart', (e: Event) => { e.preventDefault(); start(); });
    el.addEventListener('touchend', (e: Event) => { e.preventDefault(); end(); });
    el.addEventListener('touchcancel', (e: Event) => { e.preventDefault(); end(); });
  }
  bindTouchBtn('btn-left', 'left');
  bindTouchBtn('btn-right', 'right');
  bindTouchBtn('btn-fire', 'fire');

  canvas.addEventListener('touchstart', (e: Event) => {
    e.preventDefault();
    if (state.gameOver && state.canRestart) { resetState(state); state.started = true; startWave(state); }
    else if (!state.started) { state.started = true; startWave(state); }
  });
}

export function handleInput(state: GameState, gun: Gun): void {
  if (state.gameOver || state.endSequence || !state.started) return;

  if (!state.settingsOpen) {
    if (keysDown['ArrowLeft'] || touchState.left) state.gunAngle -= S('turret', 'rotationSpeed');
    if (keysDown['ArrowRight'] || touchState.right) state.gunAngle += S('turret', 'rotationSpeed');
  }

  if ((keysDown['Space'] || touchState.fire) && !state.endSequence && !state.settingsOpen) {
    state.fireTimer++;
    if (state.fireTimer >= S('turret', 'fireRate')) {
      state.fireTimer = 0;
      shoot(state, gun);
    }
  } else {
    state.fireTimer = 999;
  }
}
