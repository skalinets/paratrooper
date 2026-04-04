import { describe, test, expect } from 'bun:test';
import { Simulation } from './simulation';

describe('Simulation', () => {
  test('constructor creates a simulation', () => {
    const sim = new Simulation();
    expect(sim).toBeDefined();
  });

  test('reset returns observation of correct shape', () => {
    const sim = new Simulation();
    const obs = sim.reset();
    expect(obs).toBeInstanceOf(Float64Array);
    expect(obs.length).toBe(56);
  });

  test('reset returns normalized scalars', () => {
    const sim = new Simulation();
    const obs = sim.reset();
    // gun_angle: should be -0.5 (default -PI/2 / PI)
    expect(obs[0]).toBeCloseTo(-0.5, 1);
    // heat: should be 0
    expect(obs[1]).toBe(0);
    // combo: should be 0
    expect(obs[2]).toBe(0);
    // wave: should be 1/20 = 0.05 (first wave starts)
    expect(obs[3]).toBeCloseTo(0.05, 2);
    // landed: should be 0
    expect(obs[4]).toBe(0);
    expect(obs[5]).toBe(0);
  });

  test('step returns valid StepResult', () => {
    const sim = new Simulation();
    sim.reset();
    const result = sim.step(2); // shoot
    expect(result.observation).toBeInstanceOf(Float64Array);
    expect(result.observation.length).toBe(56);
    expect(typeof result.reward).toBe('number');
    expect(typeof result.terminated).toBe('boolean');
    expect(typeof result.truncated).toBe('boolean');
    expect(result.info).toBeDefined();
    expect(typeof result.info.score).toBe('number');
    expect(typeof result.info.wave).toBe('number');
  });

  test('all 5 actions are valid', () => {
    const sim = new Simulation();
    sim.reset();
    for (let action = 0; action < 5; action++) {
      const result = sim.step(action);
      expect(result.observation.length).toBe(56);
      expect(Number.isNaN(result.reward)).toBe(false);
    }
  });

  test('rotate left decreases gun angle', () => {
    const sim = new Simulation();
    const obs0 = sim.reset();
    const angle0 = obs0[0];
    // Run several steps rotating left
    for (let i = 0; i < 10; i++) sim.step(0); // rotate left
    const obs1 = sim.step(0).observation;
    expect(obs1[0]).toBeLessThan(angle0);
  });

  test('rotate right increases gun angle', () => {
    const sim = new Simulation();
    const obs0 = sim.reset();
    const angle0 = obs0[0];
    for (let i = 0; i < 10; i++) sim.step(1); // rotate right
    const obs1 = sim.step(1).observation;
    expect(obs1[0]).toBeGreaterThan(angle0);
  });

  test('shooting increases heat', () => {
    const sim = new Simulation();
    sim.reset();
    // Shoot many times
    for (let i = 0; i < 20; i++) sim.step(2);
    const result = sim.step(2);
    expect(result.observation[1]).toBeGreaterThan(0); // heat > 0
  });

  test('frame skip runs multiple frames per step', () => {
    const sim1 = new Simulation({ frameSkip: 1 });
    const sim4 = new Simulation({ frameSkip: 4 });
    sim1.reset();
    sim4.reset();
    sim1.step(0);
    sim4.step(0);
    const frame1 = sim1.getState().frame;
    const frame4 = sim4.getState().frame;
    // frame4 should have advanced ~4x more
    // Account for wave announce timer which blocks some updates
    expect(frame4).toBeGreaterThan(frame1);
  });

  test('game eventually terminates', () => {
    const sim = new Simulation({ frameSkip: 4, maxSteps: 5000 });
    sim.reset();
    let done = false;
    let steps = 0;
    while (!done && steps < 5000) {
      const result = sim.step(0); // just rotate, don't shoot — will lose
      done = result.terminated || result.truncated;
      steps++;
    }
    expect(done).toBe(true);
  });

  test('reward is negative on game over', () => {
    const sim = new Simulation({ frameSkip: 4, maxSteps: 5000 });
    sim.reset();
    let lastResult;
    for (let i = 0; i < 5000; i++) {
      lastResult = sim.step(0); // don't shoot, will lose
      if (lastResult.terminated) break;
    }
    if (lastResult?.terminated) {
      expect(lastResult.reward).toBeLessThan(0);
    }
  });

  test('configure changes settings', () => {
    const sim = new Simulation();
    sim.reset();
    const before = sim.getConfig();
    const originalGravity = before.game.gravity;

    sim.configure({ game: { gravity: 0.1 } });
    const after = sim.getConfig();
    expect(after.game.gravity).toBe(0.1);

    // Restore
    sim.configure({ game: { gravity: originalGravity } });
  });

  test('getConfig returns all categories', () => {
    const sim = new Simulation();
    const config = sim.getConfig();
    expect(config.turret).toBeDefined();
    expect(config.helicopter).toBeDefined();
    expect(config.paratrooper).toBeDefined();
    expect(config.jet).toBeDefined();
    expect(config.bomb).toBeDefined();
    expect(config.game).toBeDefined();
  });

  test('reset produces fresh state', () => {
    const sim = new Simulation();
    sim.reset();
    // Play some steps
    for (let i = 0; i < 50; i++) sim.step(2);
    const state1 = sim.getState();
    expect(state1.frame).toBeGreaterThan(0);

    // Reset and check fresh
    sim.reset();
    const state2 = sim.getState();
    expect(state2.score).toBe(0);
    expect(state2.landedLeft).toBe(0);
    expect(state2.landedRight).toBe(0);
  });

  test('observations have no NaN values', () => {
    const sim = new Simulation();
    sim.reset();
    for (let i = 0; i < 100; i++) {
      const action = i % 5;
      const result = sim.step(action);
      for (let j = 0; j < result.observation.length; j++) {
        expect(Number.isNaN(result.observation[j])).toBe(false);
      }
    }
  });

  test('settings are isolated between instances', () => {
    const sim1 = new Simulation();
    const sim2 = new Simulation();
    sim1.reset();
    sim2.reset();

    // Configure different gravity on each
    sim1.configure({ game: { gravity: 0.1 } });
    sim2.configure({ game: { gravity: 0.01 } });

    expect(sim1.getConfig().game.gravity).toBe(0.1);
    expect(sim2.getConfig().game.gravity).toBe(0.01);

    // Run steps — each should use its own settings
    sim1.step(2);
    sim2.step(2);

    // Verify settings haven't leaked
    expect(sim1.getConfig().game.gravity).toBe(0.1);
    expect(sim2.getConfig().game.gravity).toBe(0.01);
  });

  test('random agent runs 100 episodes without crash', () => {
    const sim = new Simulation({ frameSkip: 4, maxSteps: 500 });
    for (let ep = 0; ep < 100; ep++) {
      sim.reset();
      let done = false;
      while (!done) {
        const action = Math.floor(Math.random() * 5);
        const result = sim.step(action);
        done = result.terminated || result.truncated;
      }
    }
    // If we got here without throwing, the test passes
    expect(true).toBe(true);
  });
});
