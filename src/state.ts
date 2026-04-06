import type { GameState, Bullet, Helicopter, Paratrooper, Jet, Bomb, Explosion, Debris, Missile, FloatingText, FallingPowerUp, ActivePowerUp } from './types';

export function createState(): GameState {
  return {
    score: 0,
    highScore: typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('paratrooper_hi') || '0') : 0,
    gameOver: false,
    gunAngle: -Math.PI / 2,
    bullets: [] as Bullet[],
    helicopters: [] as Helicopter[],
    paratroopers: [] as Paratrooper[],
    jets: [] as Jet[],
    bombs: [] as Bomb[],
    explosions: [] as Explosion[],
    debris: [] as Debris[],
    missiles: [] as Missile[],
    missileTimer: 0,
    floatingTexts: [] as FloatingText[],
    landedLeft: 0,
    landedRight: 0,
    frame: 0,
    started: false,
    gunDestroyed: false,
    endSequence: false,
    endSequenceTimer: 0,
    canRestart: false,
    // Wave system
    wave: 0,
    waveTimer: 0,
    waveActive: false,
    wavePause: 0,
    waveHeliCount: 0,
    waveHelisSpawned: 0,
    waveJetCount: 0,
    waveJetsSpawned: 0,
    waveSpawnTimer: 0,
    waveAnnounceTimer: 0,
    // Heat system
    heat: 0,
    overheated: false,
    overheatTimer: 0,
    // Combo system
    combo: 0,
    comboTimer: 0,
    // Power-up system
    powerups: [] as FallingPowerUp[],
    activePowerup: null as ActivePowerUp | null,
    powerupSpawnTimer: 0,
    // Input
    fireTimer: 0,
    // Settings menu
    settingsOpen: false,
    settingsCategory: 0,
    settingsParam: 0,
    settingsDrillDown: false,
  };
}

export const state: GameState = createState();

export function resetState(s: GameState): void {
  const fresh = createState();
  fresh.highScore = s.highScore;
  Object.assign(s, fresh);
}
