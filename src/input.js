import { S, settings, settingsCategories } from './config.js';
import { shoot } from './combat.js';
import { startWave } from './update.js';
import { resetState } from './state.js';

export const keysDown = {};
export const touchState = { left: false, right: false, fire: false };

export function setupInput(state, canvas) {
  document.addEventListener('keydown', e => {
    keysDown[e.code] = true;

    if (e.code === 'KeyS') {
      state.settingsOpen = !state.settingsOpen;
      state.settingsParam = 0;
      return;
    }
    if (state.settingsOpen) {
      e.preventDefault();
      const cat = settingsCategories[state.settingsCategory];
      const params = Object.keys(settings[cat]);
      if (e.code === 'ArrowUp') {
        state.settingsParam--;
        if (state.settingsParam < 0) {
          state.settingsCategory = (state.settingsCategory - 1 + settingsCategories.length) % settingsCategories.length;
          state.settingsParam = Object.keys(settings[settingsCategories[state.settingsCategory]]).length - 1;
        }
      } else if (e.code === 'ArrowDown') {
        state.settingsParam++;
        if (state.settingsParam >= params.length) {
          state.settingsCategory = (state.settingsCategory + 1) % settingsCategories.length;
          state.settingsParam = 0;
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'Comma') {
        const p = settings[cat][params[state.settingsParam]];
        p.val = Math.max(p.min, +(p.val - p.step).toFixed(6));
      } else if (e.code === 'ArrowRight' || e.code === 'Period') {
        const p = settings[cat][params[state.settingsParam]];
        p.val = Math.min(p.max, +(p.val + p.step).toFixed(6));
      } else if (e.code === 'Escape') {
        state.settingsOpen = false;
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

  document.addEventListener('keyup', e => { keysDown[e.code] = false; });

  // Touch controls
  function bindTouchBtn(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = () => { touchState[key] = true; el.classList.add('pressed'); };
    const end = () => { touchState[key] = false; el.classList.remove('pressed'); };
    el.addEventListener('touchstart', e => { e.preventDefault(); start(); });
    el.addEventListener('touchend', e => { e.preventDefault(); end(); });
    el.addEventListener('touchcancel', e => { e.preventDefault(); end(); });
  }
  bindTouchBtn('btn-left', 'left');
  bindTouchBtn('btn-right', 'right');
  bindTouchBtn('btn-fire', 'fire');

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state.gameOver && state.canRestart) { resetState(state); state.started = true; startWave(state); }
    else if (!state.started) { state.started = true; startWave(state); }
  });
}

export function handleInput(state, gun) {
  if (state.gameOver || state.endSequence || !state.started) return;

  // Gun rotation
  if (!state.settingsOpen) {
    if (keysDown['ArrowLeft'] || touchState.left) state.gunAngle -= S('turret', 'rotationSpeed');
    if (keysDown['ArrowRight'] || touchState.right) state.gunAngle += S('turret', 'rotationSpeed');
  }

  // Auto-fire
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
