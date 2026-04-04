# Paratrooper - Project Guide

## Overview
Browser-based arcade game inspired by the classic Paratrooper. Single-page Canvas game built with TypeScript, bundled with Bun, deployed to Cloudflare Pages.

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
- `make build` - Bundle + minify with Bun → dist/
- `make test` - Run tests with Bun
- `make lint` - Lint with oxlint
- `make check` - Lint + test
- `make serve` - Docker Compose nginx on localhost:3000
- `make stop` - Stop local server
- `make deploy` - Build + deploy to Cloudflare Pages
- `make dev` - Build unminified + open locally

## Workflow
1. Always work in a git worktree for feature branches
2. Run `make check` before committing
3. Commit and push before running the local game
4. Update GAME.md when adding/changing mechanics
5. Reference GAME.md spec when implementing features

## Code Conventions
- **TypeScript strict mode** - `strict: true`, `noUncheckedIndexedAccess: true`
- **No `any` types** - Use proper interfaces from `types.ts`
- **Guard against NaN/undefined** - Use type narrowing, default values, and `??` operator
- **All game functions take `state` as first parameter** - No module-level mutable globals
- **`createState()` factory** - Creates fresh state for testing
- **Tests for every module** - Cover edge cases (empty arrays, NaN inputs, boundary conditions)

## Game Spec
See `GAME.md` for complete game mechanics documentation. Always keep it current.

## Key Types
- `GameState` - Central mutable state object
- `Helicopter`, `Jet`, `Paratrooper`, `Bomb`, `Bullet` - Entity types
- `Explosion`, `FloatingText` - Visual effect types
- `PowerUp`, `ActivePowerUp` - Power-up types
- `Settings` - Nested settings with `{val, min, max, step, label}`
- `Gun` - Turret position and dimensions

## Testing
- Use `bun:test` (describe/test/expect)
- `createState()` for fresh state in every test
- Mock canvas dimensions via state/gun objects
- Test edge cases: empty arrays, zero values, boundary collisions, NaN guards
- No browser globals needed - config/state handle `typeof window` checks

## Deployment
- **Prod**: Cloudflare Pages at paratrooper.pages.dev
- **Local**: Docker Compose nginx at localhost:3000
- **GitHub**: github.com/skalinets/paratrooper
