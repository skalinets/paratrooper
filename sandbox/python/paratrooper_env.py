"""Gymnasium environment for the Paratrooper game sandbox."""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Any

import gymnasium as gym
import numpy as np
from gymnasium import spaces

# Path to the sandbox server
SANDBOX_DIR = Path(__file__).resolve().parent.parent
SERVER_SCRIPT = SANDBOX_DIR / "server.ts"


class ParatrooperEnv(gym.Env):
    """OpenAI Gymnasium environment wrapping the Paratrooper headless simulation.

    The environment communicates with a TypeScript WebSocket server running the
    game simulation. Multiple environments can share one server via env_id multiplexing.

    Args:
        server_url: WebSocket URL of the sandbox server.
        env_id: Unique identifier for this environment instance.
        frame_skip: Number of game frames per step (default: 4).
        max_steps: Maximum steps before truncation (default: 10000).
        auto_server: If True, automatically start the server process.
        server_port: Port for auto-started server (default: 8080).
    """

    metadata = {"render_modes": []}

    def __init__(
        self,
        server_url: str | None = None,
        env_id: str | None = None,
        frame_skip: int = 4,
        max_steps: int = 10000,
        auto_server: bool = True,
        server_port: int = 8080,
    ):
        super().__init__()

        self.server_url = server_url or f"ws://localhost:{server_port}"
        self.env_id = env_id or f"env-{id(self)}"
        self.frame_skip = frame_skip
        self.max_steps = max_steps
        self.server_port = server_port
        self._server_process: subprocess.Popen[bytes] | None = None
        self._ws: Any = None

        # Observation: 56-dim normalized vector
        # [gun_angle, heat, combo, wave, landed_left, landed_right,
        #  10 enemies * (type, x, y, vx, vy)]
        self.observation_space = spaces.Box(
            low=-1.0, high=2.0, shape=(56,), dtype=np.float64
        )

        # Action: Discrete(5)
        # 0=rotate_left, 1=rotate_right, 2=shoot, 3=shoot+left, 4=shoot+right
        self.action_space = spaces.Discrete(5)

        if auto_server and server_url is None:
            self._start_server()

        self._connect()

    def _start_server(self) -> None:
        """Start the TypeScript WebSocket server as a subprocess."""
        self._server_process = subprocess.Popen(
            ["bun", "run", str(SERVER_SCRIPT), str(self.server_port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        # Give server time to start
        time.sleep(0.5)

    def _connect(self) -> None:
        """Connect to the WebSocket server."""
        import websockets.sync.client as ws_client

        self._ws = ws_client.connect(self.server_url)

    def _send(self, msg: dict[str, Any]) -> dict[str, Any]:
        """Send a message and wait for response."""
        msg["env_id"] = self.env_id
        self._ws.send(json.dumps(msg))
        response = json.loads(self._ws.recv())
        if "error" in response:
            raise RuntimeError(f"Server error: {response['error']}")
        return response

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        """Reset the environment and return initial observation."""
        super().reset(seed=seed)

        config = {}
        if self.frame_skip != 4:
            config["frameSkip"] = self.frame_skip
        if self.max_steps != 10000:
            config["maxSteps"] = self.max_steps

        response = self._send({
            "type": "reset",
            "config": config if config else None,
        })

        obs = np.array(response["observation"], dtype=np.float64)
        return obs, {}

    def step(
        self, action: int
    ) -> tuple[np.ndarray, float, bool, bool, dict[str, Any]]:
        """Take a step in the environment.

        Args:
            action: Integer action (0-4).

        Returns:
            observation, reward, terminated, truncated, info
        """
        response = self._send({"type": "step", "action": int(action)})

        obs = np.array(response["observation"], dtype=np.float64)
        reward = float(response["reward"])
        terminated = bool(response["terminated"])
        truncated = bool(response["truncated"])
        info = response.get("info", {})

        return obs, reward, terminated, truncated, info

    def configure(self, params: dict[str, dict[str, float]]) -> None:
        """Configure game parameters between episodes.

        Args:
            params: Nested dict of {category: {param: value}}.
                    e.g. {"turret": {"bulletSpeed": 10}, "game": {"gravity": 0.06}}
        """
        self._send({"type": "configure", "params": params})

    def get_config(self) -> dict[str, dict[str, float]]:
        """Get current game configuration values."""
        response = self._send({"type": "get_config"})
        return response["config"]

    def close(self) -> None:
        """Clean up resources."""
        try:
            if self._ws:
                self._send({"type": "close"})
                self._ws.close()
        except Exception:
            pass

        if self._server_process:
            self._server_process.terminate()
            self._server_process.wait(timeout=5)
            self._server_process = None

    def __del__(self) -> None:
        self.close()
