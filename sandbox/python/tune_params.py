#!/usr/bin/env python3
"""Parameter sweep to find optimal game balance settings.

Runs headless simulations with a simple heuristic agent and measures
average game length and score for different parameter configurations.

Usage:
    # Start the sandbox server first:
    bun run sandbox/server.ts 9346

    # Then run sweep:
    python sandbox/python/tune_params.py

    # With custom settings:
    python sandbox/python/tune_params.py --episodes 50 --port 9346
"""

from __future__ import annotations

import argparse
import itertools
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from paratrooper_env import ParatrooperEnv


def heuristic_agent(obs: np.ndarray) -> int:
    """Simple heuristic agent that aims at the nearest enemy and shoots.

    Observation layout:
        [0] gun_angle (normalized, -1 to 0 means -pi to 0)
        [1] heat (0 to 1)
        [2] combo
        [3] wave
        [4] landed_left (danger)
        [5] landed_right (danger)
        [6+] enemies: (type, x, y, vx, vy) * 10
    """
    gun_angle_norm = obs[0]  # -1 to 0 mapped from -pi to 0
    heat = obs[1]

    # Find nearest enemy (first non-zero enemy slot)
    best_target_x = 0.5  # default: aim center
    best_target_y = 0.5
    for i in range(10):
        base = 6 + i * 5
        etype = obs[base]
        ex = obs[base + 1]
        ey = obs[base + 2]
        if etype == 0 and ex == 0 and ey == 0:
            continue  # empty slot
        best_target_x = ex
        best_target_y = ey
        break

    # Calculate desired angle to target
    # Gun is at (0.5, ~0.97) in normalized coords
    dx = best_target_x - 0.5
    dy = best_target_y - 0.97  # gun is near bottom
    desired_angle = np.arctan2(dy, dx)

    # Current angle: gun_angle_norm * pi
    current_angle = gun_angle_norm * np.pi

    # Decide rotation
    angle_diff = desired_angle - current_angle
    should_shoot = heat < 0.8  # don't overheat

    if angle_diff < -0.05:
        return 3 if should_shoot else 0  # shoot+left or left
    elif angle_diff > 0.05:
        return 4 if should_shoot else 1  # shoot+right or right
    else:
        return 2 if should_shoot else 0  # shoot or idle


def evaluate_config(
    env: ParatrooperEnv,
    params: dict[str, dict[str, float]],
    n_episodes: int = 10,
) -> dict[str, float]:
    """Evaluate a parameter configuration over multiple episodes."""
    scores = []
    steps = []
    waves = []

    for _ in range(n_episodes):
        env.configure(params)
        obs, _ = env.reset()
        done = False
        ep_steps = 0

        while not done:
            action = heuristic_agent(obs)
            obs, _, terminated, truncated, info = env.step(action)
            ep_steps += 1
            done = terminated or truncated

        scores.append(info.get("score", 0))
        steps.append(ep_steps)
        waves.append(info.get("wave", 0))

    return {
        "mean_score": float(np.mean(scores)),
        "mean_steps": float(np.mean(steps)),
        "mean_waves": float(np.mean(waves)),
        "std_score": float(np.std(scores)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Parameter sweep for Paratrooper balance")
    parser.add_argument("--episodes", type=int, default=10, help="Episodes per config")
    parser.add_argument("--port", type=int, default=9346, help="Server port")
    parser.add_argument("--no-auto-server", action="store_true", help="Don't auto-start server")
    args = parser.parse_args()

    print("=" * 60)
    print("Paratrooper Parameter Sweep")
    print("=" * 60)

    env = ParatrooperEnv(
        server_port=args.port,
        auto_server=not args.no_auto_server,
        frame_skip=4,
    )

    # Parameter grid to sweep
    param_grid = {
        "gravity": [0.02, 0.04, 0.06, 0.08],
        "helicopter_speed": [1.0, 1.5, 2.0, 2.5],
        "paratrooper_fall_speed": [0.3, 0.5, 0.7],
    }

    # Evaluate default config first
    print("\n--- Default Configuration ---")
    default_results = evaluate_config(env, {}, n_episodes=args.episodes)
    print(f"  Mean Score: {default_results['mean_score']:.1f}")
    print(f"  Mean Steps: {default_results['mean_steps']:.1f}")
    print(f"  Mean Waves: {default_results['mean_waves']:.1f}")

    # Sweep
    results = []
    combos = list(itertools.product(
        param_grid["gravity"],
        param_grid["helicopter_speed"],
        param_grid["paratrooper_fall_speed"],
    ))

    print(f"\n--- Sweeping {len(combos)} configurations ---")

    for i, (grav, heli_speed, para_speed) in enumerate(combos):
        params = {
            "game": {"gravity": grav},
            "helicopter": {"speed": heli_speed},
            "paratrooper": {"fallSpeed": para_speed},
        }

        result = evaluate_config(env, params, n_episodes=args.episodes)
        result["gravity"] = grav
        result["helicopter_speed"] = heli_speed
        result["paratrooper_fall_speed"] = para_speed
        results.append(result)

        if (i + 1) % 10 == 0 or i == len(combos) - 1:
            print(f"  Progress: {i + 1}/{len(combos)}")

    # Find best configs
    print("\n--- Results ---")

    # Best by game length (steps)
    by_steps = sorted(results, key=lambda r: r["mean_steps"], reverse=True)
    print("\nTop 5 configs by game length (longer = more balanced):")
    print(f"  {'Gravity':>8} {'HeliSpd':>8} {'ParaSpd':>8} | {'Steps':>8} {'Score':>8} {'Waves':>6}")
    print("  " + "-" * 60)
    for r in by_steps[:5]:
        print(f"  {r['gravity']:>8.3f} {r['helicopter_speed']:>8.1f} {r['paratrooper_fall_speed']:>8.2f} | {r['mean_steps']:>8.1f} {r['mean_score']:>8.1f} {r['mean_waves']:>6.1f}")

    # Best by score
    by_score = sorted(results, key=lambda r: r["mean_score"], reverse=True)
    print("\nTop 5 configs by score (higher = more engagement):")
    print(f"  {'Gravity':>8} {'HeliSpd':>8} {'ParaSpd':>8} | {'Steps':>8} {'Score':>8} {'Waves':>6}")
    print("  " + "-" * 60)
    for r in by_score[:5]:
        print(f"  {r['gravity']:>8.3f} {r['helicopter_speed']:>8.1f} {r['paratrooper_fall_speed']:>8.2f} | {r['mean_steps']:>8.1f} {r['mean_score']:>8.1f} {r['mean_waves']:>6.1f}")

    # Compare best vs default
    best = by_steps[0]
    print("\n--- Best Config vs Default ---")
    print(f"  Best config: gravity={best['gravity']}, heli_speed={best['helicopter_speed']}, para_speed={best['paratrooper_fall_speed']}")
    step_improvement = best["mean_steps"] - default_results["mean_steps"]
    print(f"  Game length: {best['mean_steps']:.1f} vs {default_results['mean_steps']:.1f} ({step_improvement:+.1f} steps)")
    score_improvement = best["mean_score"] - default_results["mean_score"]
    print(f"  Score: {best['mean_score']:.1f} vs {default_results['mean_score']:.1f} ({score_improvement:+.1f})")

    env.close()


if __name__ == "__main__":
    main()
