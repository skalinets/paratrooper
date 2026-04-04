import { describe, expect, test } from 'bun:test';
import { createState, resetState } from './state.js';

describe('createState', () => {
  test('returns fresh state with default values', () => {
    const s = createState();
    expect(s.score).toBe(0);
    expect(s.gameOver).toBe(false);
    expect(s.gunAngle).toBe(-Math.PI / 2);
    expect(s.bullets).toEqual([]);
    expect(s.helicopters).toEqual([]);
    expect(s.wave).toBe(0);
    expect(s.heat).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.started).toBe(false);
  });

  test('creates independent instances', () => {
    const a = createState();
    const b = createState();
    a.score = 100;
    a.bullets.push({ x: 0, y: 0 });
    expect(b.score).toBe(0);
    expect(b.bullets.length).toBe(0);
  });
});

describe('resetState', () => {
  test('resets all values but preserves highScore', () => {
    const s = createState();
    s.score = 500;
    s.highScore = 1000;
    s.wave = 5;
    s.bullets.push({ x: 1, y: 2 });
    s.gameOver = true;
    resetState(s);
    expect(s.score).toBe(0);
    expect(s.highScore).toBe(1000);
    expect(s.wave).toBe(0);
    expect(s.bullets).toEqual([]);
    expect(s.gameOver).toBe(false);
  });
});
