# Paratrooper - Browser Arcade Game

A modern take on the classic Paratrooper arcade game, built as a single HTML file with Canvas and vanilla JavaScript.

## How to Play

Open `index.html` in any modern browser. No build step or dependencies required.

### Controls

| Key | Action |
|-----|--------|
| Arrow Left / Right | Rotate gun turret |
| Space | Shoot / Start / Restart |
| Enter | Start / Restart |

## Game Mechanics

### Core Gameplay

You control an anti-aircraft gun turret at the bottom center of the screen. Helicopters fly across dropping paratroopers. Your job is to shoot them down before they land. If **4 paratroopers land on either side** of your gun, they walk over and blow it up -- game over.

### Wave System

The game is structured into waves of increasing difficulty:

- **Wave 1**: 4-5 helicopters, no jets. Slow spawn rate.
- **Wave 2+**: Jets start appearing. More helicopters per wave.
- **Each wave**: Helicopter speed increases slightly. Spawn rate gets faster.
- Between waves there's a brief "WAVE COMPLETE" rest period before the next wave begins.
- Wave number is displayed in the top-right corner.

### Enemy Types

#### Helicopters (50 points)
- Fly horizontally across the screen at moderate speed.
- Drop one paratrooper each when they're away from the gun.
- Speed increases with each wave.

#### Paratroopers (25 points)
- Dropped by helicopters. Free-fall briefly, then open parachutes.
- Drift toward a landing spot on their side of the gun.
- Once landed, they stand and wait. 4 on one side triggers the end sequence.
- Paratroopers that hit the ground without a chute open: splat (10 points, no landing count).

#### Jets (100 points)
- Appear from wave 2 onward. Fly fast across the screen.
- Drop a single bomb aimed at your gun as they pass overhead.
- Red colored with engine exhaust animation.
- Harder to hit due to speed.

#### Bombs (75 points)
- Dropped by jets. Fall with increasing speed toward the gun.
- **Direct hit on gun = instant destruction** (skips the walk sequence).
- Can be shot down for 75 points.
- Missed bombs explode harmlessly on the ground.

### Gun Overheat

A heat bar is displayed at the bottom center of the screen:

- Each shot adds heat to the gun.
- Heat decays naturally over time.
- **Green** (0-40%): Safe to fire freely.
- **Yellow** (40-70%): Getting warm, pace your shots.
- **Orange** (70-100%): Danger zone.
- **Overheat** (100%): Gun locks completely. Barrel turns red. Must wait for full cooldown (~2 seconds). The bar flashes red/orange.

This forces players to be accurate rather than spray bullets.

### Combo System

Consecutive kills within a short time window build a combo multiplier:

- Kill 1: x1 (normal score)
- Kill 2: x2 (double score)
- Kill 3: x3 (triple score)
- ...up to **x8 maximum**

The combo timer resets with each kill. If too much time passes without a kill, the combo resets to zero. Active combo multiplier is shown in the top-right corner. Score popups float up from each kill showing the multiplied points.

### Scoring

| Target | Base Points | With x8 Combo |
|--------|------------|---------------|
| Helicopter | 50 | 400 |
| Jet | 100 | 800 |
| Bomb | 75 | 600 |
| Paratrooper (with chute) | 25 | 200 |
| Paratrooper (splat, no chute) | 10 | -- (no combo) |

### High Score

- Your highest score is saved in the browser's localStorage.
- Displayed on the title screen and game over screen.
- "NEW HIGH SCORE!" appears when you beat your record.

### Game Over

Two ways to lose:

1. **Paratroopers capture the gun**: 4 land on one side, walk to the gun, and blow it up. You see the full walk + explosion animation.
2. **Bomb hits the gun**: A jet's bomb scores a direct hit. Instant destruction with explosion.

After the explosion sequence, the game over screen shows your score, wave reached, and high score.

## Visual Features

- Night sky with twinkling stars
- Animated helicopter rotors
- Jet engine exhaust effects
- Parachute with striped canopy and strings
- Walking animation for landed paratroopers (swinging arms and legs)
- Multi-point explosion effects with fire and glow
- Smoking debris after gun destruction
- Floating score popups for kills
- Flashing danger warnings when close to losing
- Heat bar with color-coded states

## Technical Details

- **Single file**: Everything in one `index.html` -- no external assets or dependencies.
- **Canvas rendering**: 60fps via `requestAnimationFrame`.
- **Responsive**: Canvas auto-sizes to window (max 960x640).
- **Persistence**: High score stored in `localStorage` under key `paratrooper_hi`.
- **~700 lines** of vanilla JavaScript.
