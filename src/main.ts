import { isMobile } from './config';
import type { Gun, Star } from './types';
import { state } from './state';
import { setupInput, handleInput } from './input';
import { update } from './update';
import { draw } from './render';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  if (isMobile) {
    const controlH = 130; // controls height + padding
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

function loop(): void {
  handleInput(state, gun);
  update(state, canvas, gun);
  draw(ctx, canvas, state, gun, stars);
  requestAnimationFrame(loop);
}
loop();
