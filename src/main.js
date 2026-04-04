import { isMobile } from './config.js';
import { state } from './state.js';
import { setupInput, handleInput } from './input.js';
import { update } from './update.js';
import { draw } from './render.js';

// Canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  if (isMobile) {
    const controlH = 120;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - controlH;
  } else {
    canvas.width = Math.min(window.innerWidth, 960);
    canvas.height = Math.min(window.innerHeight, 640);
  }
}
resize();
window.addEventListener('resize', resize);

// Gun object with dynamic position
const gun = {
  get x() { return canvas.width / 2; },
  get y() { return canvas.height - (isMobile ? 25 : 20); },
  baseWidth: 40,
  baseHeight: 15,
};

// Stars (static, generated once)
const stars = Array.from({ length: 80 }, () => ({
  x: Math.random(),
  y: Math.random() * 0.6,
  size: Math.random() * 2 + 0.5,
  twinkle: Math.random() * Math.PI * 2,
}));

// Initialize input
setupInput(state, canvas);

// Game loop
function loop() {
  handleInput(state, gun);
  update(state, canvas, gun);
  draw(ctx, canvas, state, gun, stars);
  requestAnimationFrame(loop);
}
loop();
