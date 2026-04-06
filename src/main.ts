import { isMobile } from './config';
import type { Gun, Star } from './types';
import { state } from './state';
import { setupInput, handleInput } from './input';
import { update } from './update';
import { draw } from './render';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Debug mode via ?debug in URL
const DEBUG = typeof location !== 'undefined' && location.search.includes('debug');

// Error log - stored in memory and localStorage
interface GameError {
  msg: string;
  stack: string;
  time: string;
  frame: number;
  entities: string;
}
const errorLog: GameError[] = [];
const MAX_ERRORS = 20;

function logError(err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const entry: GameError = {
    msg: e.message,
    stack: e.stack ?? '',
    time: new Date().toISOString(),
    frame: state.frame,
    entities: `h:${state.helicopters.length} j:${state.jets.length} p:${state.paratroopers.length} b:${state.bombs.length} bl:${state.bullets.length} m:${state.missiles.length}`,
  };
  errorLog.push(entry);
  if (errorLog.length > MAX_ERRORS) errorLog.shift();
  showErrorOverlay = true;
  console.error('[GAME ERROR]', entry.msg, '\n', entry.stack, '\nEntities:', entry.entities);
  try {
    localStorage.setItem('paratrooper_errors', JSON.stringify(errorLog));
  } catch { /* localStorage may be full */ }
}

let showErrorOverlay = true;

function drawErrorOverlay(): void {
  if (errorLog.length === 0 || !showErrorOverlay) return;
  const last = errorLog[errorLog.length - 1]!;
  ctx.save();
  ctx.fillStyle = 'rgba(100,0,0,0.85)';
  ctx.fillRect(0, 0, canvas.width, 70);
  ctx.fillStyle = '#f44';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`ERROR (frame ${last.frame}): ${last.msg}`, 8, 16);
  ctx.fillStyle = '#faa';
  ctx.font = '10px monospace';
  const stackLine = last.stack.split('\n')[1]?.trim() ?? '';
  ctx.fillText(stackLine, 8, 30);
  ctx.fillText(`Entities: ${last.entities}`, 8, 42);
  ctx.fillStyle = '#888';
  ctx.fillText(`${errorLog.length} error(s) | Tap to dismiss | localStorage: paratrooper_errors`, 8, 54);
  // Copy button
  ctx.fillStyle = '#48f';
  ctx.fillRect(canvas.width - 60, 4, 52, 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COPY', canvas.width - 34, 16);
  ctx.restore();
}

function handleErrorClick(ex: number, ey: number): boolean {
  if (errorLog.length === 0 || !showErrorOverlay) return false;
  if (ey > 70) return false;
  // Copy button area
  if (ex >= canvas.width - 60 && ey <= 22) {
    const text = JSON.stringify(errorLog, null, 2);
    navigator.clipboard.writeText(text).then(
      () => { console.log('[GAME] Errors copied to clipboard'); },
      () => { console.log('[GAME] Copy failed. Errors:', text); }
    );
    return true;
  }
  // Tap anywhere else on overlay to dismiss
  showErrorOverlay = false;
  return true;
}

// FPS tracking
let fpsFrames = 0;
let fpsLast = performance.now();
let fpsDisplay = 0;

function drawDebugOverlay(): void {
  if (!DEBUG) return;
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 1000) {
    fpsDisplay = fpsFrames;
    fpsFrames = 0;
    fpsLast = now;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, canvas.height - 20, 280, 20);
  ctx.fillStyle = '#0f0';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `FPS:${fpsDisplay} F:${state.frame} H:${state.helicopters.length} J:${state.jets.length} P:${state.paratroopers.length} B:${state.bombs.length} M:${state.missiles.length} D:${state.debris.length}`,
    4, canvas.height - 7
  );
  ctx.restore();
}

// Canvas setup
function resize(): void {
  if (isMobile) {
    const controlH = 130;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - controlH;
  } else {
    canvas.width = Math.min(window.innerWidth, 960);
    canvas.height = Math.min(window.innerHeight, 640);
  }
}
resize();
window.addEventListener('resize', resize);

const gun: Gun = {
  get x() { return canvas.width / 2; },
  get y() { return canvas.height - (isMobile ? 25 : 20); },
  baseWidth: 40,
  baseHeight: 15,
};

const stars: Star[] = Array.from({ length: 80 }, (): Star => ({
  x: Math.random(),
  y: Math.random() * 0.6,
  size: Math.random() * 2 + 0.5,
  twinkle: Math.random() * Math.PI * 2,
}));

setupInput(state, canvas);

// Error overlay click/tap handling
canvas.addEventListener('click', (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  handleErrorClick(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener('touchend', (e: TouchEvent) => {
  const touch = e.changedTouches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  handleErrorClick(touch.clientX - rect.left, touch.clientY - rect.top);
});

// Expose state for console debugging
(window as unknown as Record<string, unknown>).__gameState = state;
(window as unknown as Record<string, unknown>).__gameErrors = errorLog;

// Game loop with error boundary
let crashed = false;

function loop(): void {
  try {
    handleInput(state, gun);
    update(state, canvas, gun);
    draw(ctx, canvas, state, gun, stars);
    drawDebugOverlay();
    if (errorLog.length > 0) drawErrorOverlay();
  } catch (err) {
    logError(err);
    if (!crashed) {
      crashed = true;
      // Draw error on screen
      drawErrorOverlay();
      // Try to recover on next frame
      setTimeout(() => { crashed = false; }, 500);
    }
  }
  requestAnimationFrame(loop);
}
loop();
