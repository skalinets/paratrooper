# Paratrooper - Project Guide

## Overview
Browser arcade game, classic Paratrooper style. Single-page Canvas, TypeScript, Bun bundle, Cloudflare Pages deploy.

## Architecture
```
src/
  config.ts    - Game settings, tunable parameters, mobile detection, constants
  state.ts     - Mutable game state factory, reset function
  entities.ts  - Spawn functions (helicopter, jet, paratrooper)
  combat.ts    - Shooting, kills, combos, explosive blast
  update.ts    - Main update loop, physics, collisions, wave logic
  render.ts    - All Canvas drawing functions
  input.ts     - Keyboard + touch input handling
  main.ts      - Entry point, canvas setup, game loop
  types.ts     - Shared TypeScript interfaces and types
  index.html   - HTML shell with touch controls
```

## Commands
- `make build` - Bundle + minify Bun → dist/
- `make test` - Tests Bun
- `make lint` - Lint oxlint
- `make check` - Lint + test
- `make serve` - Docker Compose nginx localhost:3000
- `make stop` - Stop local server
- `make deploy` - Build + deploy Cloudflare Pages
- `make dev` - Build unminified + open local

## Workflow
1. **Always** work in git worktree under `.claude/worktrees/<name>` on a dedicated feature branch. Never commit on `main` directly.
2. Run `make check` (lint + typecheck + test) before commit
3. Commit + push feature branch
4. Open PR via `gh pr create` when work done; wait for review/merge
5. After PR merged: delete local branch, remote branch, and worktree (`git worktree remove`)
6. Update GAME.md when mechanics change; reference GAME.md spec when implement features
7. Use subagents: game-designer for balance, qa-tester for bugs, ts-migrator for types

## Code Conventions
- **TypeScript strict mode** - `strict: true`, `noUncheckedIndexedAccess: true`
- **No `any` types** - Use interfaces from `types.ts`
- **Guard NaN/undefined** - Type narrowing, defaults, `??` operator
- **Game functions take `state` first param** - No module-level globals
- **`createState()` factory** - Fresh state for tests
- **Tests every module** - Cover edges (empty arrays, NaN, boundaries)

## Subagents
Configured `.claude/settings.json`:
- **game-designer** - Balance analysis, mechanics proposals, reads GAME.md
- **qa-tester** - Browser QA: opens game, watches console while dev plays
- **ts-migrator** - TypeScript strict enforcement, type safety

## Game Spec
See `GAME.md` for full mechanics docs. Keep current.

## Key Types
- `GameState` - Central mutable state
- `Helicopter`, `Jet`, `Paratrooper`, `Bomb`, `Bullet` - Entity types
- `Explosion`, `FloatingText` - Visual effects
- `PowerUp`, `ActivePowerUp` - Power-up types
- `Settings` - Nested `{val, min, max, step, label}`
- `Gun` - Turret position + dims

## Testing
- Use `bun:test` (describe/test/expect)
- `createState()` fresh state each test
- Mock canvas dims via state/gun objects
- Test edges: empty arrays, zeros, boundary collisions, NaN guards
- No browser globals - config/state handle `typeof window` checks

## Deployment
- **Prod**: Cloudflare Pages at paratrooper.pages.dev
- **Local**: Docker Compose nginx at localhost:3000
- **GitHub**: github.com/skalinets/paratrooper