import { Simulation } from './simulation';
import type { SimulationConfig } from './simulation';

interface Message {
  env_id: string;
  type: 'reset' | 'step' | 'configure' | 'get_config' | 'close';
  action?: number;
  params?: Record<string, Record<string, number>>;
  config?: Partial<SimulationConfig>;
}

const MAX_ENVS = 100;
const MAX_ENVS_PER_WS = 16;

const envs = new Map<string, Simulation>();
const wsEnvs = new Map<object, Set<string>>();

function getOrCreateEnv(ws: object, envId: string, config?: Partial<SimulationConfig>): Simulation | null {
  let sim = envs.get(envId);
  if (!sim) {
    if (envs.size >= MAX_ENVS) return null;
    const owned = wsEnvs.get(ws);
    if (owned && owned.size >= MAX_ENVS_PER_WS) return null;
    sim = new Simulation(config);
    envs.set(envId, sim);
  }
  // Track which envs belong to this connection
  let owned = wsEnvs.get(ws);
  if (!owned) {
    owned = new Set();
    wsEnvs.set(ws, owned);
  }
  owned.add(envId);
  return sim;
}

const port = parseInt(process.argv[2] ?? '9346', 10);

const server = Bun.serve({
  port,
  fetch(req, server) {
    if (server.upgrade(req)) return undefined;
    return new Response('Paratrooper Sandbox WebSocket Server. Connect via WebSocket.', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
  websocket: {
    maxPayloadLength: 4096, // 4 KB is plenty for control messages
    message(ws, rawMessage) {
      let msg: Message;
      try {
        msg = JSON.parse(typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage));
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { env_id, type } = msg;
      if (!env_id || !type) {
        ws.send(JSON.stringify({ error: 'Missing env_id or type' }));
        return;
      }

      try {
        switch (type) {
          case 'reset': {
            const sim = getOrCreateEnv(ws, env_id, msg.config);
            if (!sim) {
              ws.send(JSON.stringify({ env_id, error: `Environment limit reached (max ${MAX_ENVS} total, ${MAX_ENVS_PER_WS} per connection)` }));
              return;
            }
            const observation = Array.from(sim.reset());
            ws.send(JSON.stringify({ env_id, type: 'reset', observation }));
            break;
          }

          case 'step': {
            const sim = envs.get(env_id);
            if (!sim) {
              ws.send(JSON.stringify({ env_id, error: 'Environment not found. Call reset first.' }));
              return;
            }
            const result = sim.step(msg.action ?? 0);
            ws.send(JSON.stringify({
              env_id,
              type: 'step',
              observation: Array.from(result.observation),
              reward: result.reward,
              terminated: result.terminated,
              truncated: result.truncated,
              info: result.info,
            }));
            break;
          }

          case 'configure': {
            const sim = getOrCreateEnv(ws, env_id);
            if (!sim) {
              ws.send(JSON.stringify({ env_id, error: `Environment limit reached (max ${MAX_ENVS} total, ${MAX_ENVS_PER_WS} per connection)` }));
              return;
            }
            if (msg.params) sim.configure(msg.params);
            ws.send(JSON.stringify({ env_id, type: 'configure', status: 'ok' }));
            break;
          }

          case 'get_config': {
            const sim = envs.get(env_id);
            if (!sim) {
              ws.send(JSON.stringify({ env_id, error: 'Environment not found. Call reset first.' }));
              return;
            }
            ws.send(JSON.stringify({ env_id, type: 'get_config', config: sim.getConfig() }));
            break;
          }

          case 'close': {
            envs.delete(env_id);
            const owned = wsEnvs.get(ws);
            if (owned) owned.delete(env_id);
            ws.send(JSON.stringify({ env_id, type: 'close', status: 'ok' }));
            break;
          }

          default:
            ws.send(JSON.stringify({ env_id, error: `Unknown message type: ${type}` }));
        }
      } catch (err) {
        console.error(`[${env_id}] Error handling ${type}:`, err);
        ws.send(JSON.stringify({ env_id, error: 'Internal server error' }));
      }
    },

    open(_ws) {
      // Connection opened
    },

    close(ws) {
      // Clean up all envs owned by this connection
      const owned = wsEnvs.get(ws);
      if (owned) {
        for (const envId of owned) envs.delete(envId);
        wsEnvs.delete(ws);
      }
    },
  },
});

console.log(`Paratrooper Sandbox Server running on ws://localhost:${server.port}`);
