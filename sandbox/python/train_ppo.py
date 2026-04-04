#!/usr/bin/env python3
"""Train a PPO agent to play Paratrooper and compare against random baseline.

Usage:
    # Start the sandbox server first:
    bun run sandbox/server.ts 8080

    # Then run training:
    python sandbox/python/train_ppo.py

    # With custom settings:
    python sandbox/python/train_ppo.py --timesteps 100000 --port 8080
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from paratrooper_env import ParatrooperEnv


def evaluate_agent(env: ParatrooperEnv, model, n_episodes: int = 20) -> dict:
    """Evaluate an agent over multiple episodes."""
    scores = []
    waves = []
    steps = []

    for _ in range(n_episodes):
        obs, _ = env.reset()
        total_reward = 0.0
        episode_steps = 0
        done = False

        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(int(action))
            total_reward += reward
            episode_steps += 1
            done = terminated or truncated

        scores.append(info.get("score", 0))
        waves.append(info.get("wave", 0))
        steps.append(episode_steps)

    return {
        "mean_score": np.mean(scores),
        "std_score": np.std(scores),
        "mean_waves": np.mean(waves),
        "mean_steps": np.mean(steps),
        "max_score": np.max(scores),
    }


def evaluate_random(env: ParatrooperEnv, n_episodes: int = 20) -> dict:
    """Evaluate a random agent as baseline."""
    scores = []
    waves = []
    steps = []

    for _ in range(n_episodes):
        obs, _ = env.reset()
        episode_steps = 0
        done = False

        while not done:
            action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(int(action))
            episode_steps += 1
            done = terminated or truncated

        scores.append(info.get("score", 0))
        waves.append(info.get("wave", 0))
        steps.append(episode_steps)

    return {
        "mean_score": np.mean(scores),
        "std_score": np.std(scores),
        "mean_waves": np.mean(waves),
        "mean_steps": np.mean(steps),
        "max_score": np.max(scores),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train PPO agent for Paratrooper")
    parser.add_argument("--timesteps", type=int, default=50000, help="Training timesteps")
    parser.add_argument("--port", type=int, default=8080, help="Server port")
    parser.add_argument("--eval-episodes", type=int, default=20, help="Evaluation episodes")
    parser.add_argument("--save-path", type=str, default="paratrooper_ppo", help="Model save path")
    parser.add_argument("--no-auto-server", action="store_true", help="Don't auto-start server")
    args = parser.parse_args()

    from stable_baselines3 import PPO
    from stable_baselines3.common.callbacks import EvalCallback

    print("=" * 60)
    print("Paratrooper PPO Training")
    print("=" * 60)

    # Create environment
    env = ParatrooperEnv(
        server_port=args.port,
        auto_server=not args.no_auto_server,
        frame_skip=4,
    )

    # Evaluate random baseline first
    print("\n--- Random Baseline ---")
    random_results = evaluate_random(env, n_episodes=args.eval_episodes)
    print(f"  Mean Score: {random_results['mean_score']:.1f} (+/- {random_results['std_score']:.1f})")
    print(f"  Mean Waves: {random_results['mean_waves']:.1f}")
    print(f"  Mean Steps: {random_results['mean_steps']:.1f}")
    print(f"  Max Score:  {random_results['max_score']:.0f}")

    # Train PPO
    print(f"\n--- Training PPO ({args.timesteps} timesteps) ---")
    model = PPO(
        "MlpPolicy",
        env,
        verbose=1,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        tensorboard_log="./tb_logs/paratrooper_ppo",
    )
    model.learn(total_timesteps=args.timesteps)

    # Save model
    model.save(args.save_path)
    print(f"\nModel saved to {args.save_path}")

    # Evaluate trained agent
    print("\n--- Trained PPO Agent ---")
    ppo_results = evaluate_agent(env, model, n_episodes=args.eval_episodes)
    print(f"  Mean Score: {ppo_results['mean_score']:.1f} (+/- {ppo_results['std_score']:.1f})")
    print(f"  Mean Waves: {ppo_results['mean_waves']:.1f}")
    print(f"  Mean Steps: {ppo_results['mean_steps']:.1f}")
    print(f"  Max Score:  {ppo_results['max_score']:.0f}")

    # Compare
    print("\n--- Comparison ---")
    improvement = ppo_results["mean_score"] - random_results["mean_score"]
    if random_results["mean_score"] > 0:
        pct = (improvement / random_results["mean_score"]) * 100
        print(f"  Score improvement: {improvement:+.1f} ({pct:+.1f}%)")
    else:
        print(f"  Score improvement: {improvement:+.1f}")
    print(f"  Waves improvement: {ppo_results['mean_waves'] - random_results['mean_waves']:+.1f}")

    if improvement > 0:
        print("\n  PPO agent OUTPERFORMS random baseline!")
    else:
        print("\n  PPO agent has not yet surpassed random. Try more training timesteps.")

    env.close()


if __name__ == "__main__":
    main()
