import { describe, expect, test } from 'bun:test';
import { createState } from './state';
import { addExplosion, addFloatingText, addKill } from './combat';

describe('addExplosion', () => {
  test('adds explosion to state', () => {
    const s = createState();
    addExplosion(s, 100, 200, 30);
    expect(s.explosions.length).toBe(1);
    expect(s.explosions[0]).toEqual({ x: 100, y: 200, size: 30, life: 1 });
  });
});

describe('addFloatingText', () => {
  test('adds floating text to state', () => {
    const s = createState();
    addFloatingText(s, '+50', 100, 200, '#fff');
    expect(s.floatingTexts.length).toBe(1);
    expect(s.floatingTexts[0].text).toBe('+50');
  });
});

describe('addKill', () => {
  test('adds score and increments combo', () => {
    const s = createState();
    addKill(s, 50, 100, 200);
    expect(s.score).toBe(50);
    expect(s.combo).toBe(1);
  });

  test('applies combo multiplier', () => {
    const s = createState();
    addKill(s, 50, 0, 0);
    addKill(s, 50, 0, 0);
    // First kill: 50*1=50, second: 50*2=100
    expect(s.score).toBe(150);
    expect(s.combo).toBe(2);
  });

  test('caps multiplier at 8', () => {
    const s = createState();
    for (let i = 0; i < 10; i++) addKill(s, 10, 0, 0);
    // 10*(1+2+3+4+5+6+7+8+8+8) = 10*52 = 520
    expect(s.score).toBe(520);
  });
});
