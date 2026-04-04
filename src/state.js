export function createState() {
  return {
    score: 0,
    highScore: typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('paratrooper_hi') || '0') : 0,
    gameOver: false,
    gunAngle: -Math.PI / 2,
    bullets: [],
    helicopters: [],
    paratroopers: [],
    jets: [],
    bombs: [],
    explosions: [],
    floatingTexts: [],
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
    powerups: [],
    activePowerup: null,
    powerupSpawnTimer: 0,
    // Input
    fireTimer: 0,
    // Settings menu
    settingsOpen: false,
    settingsCategory: 0,
    settingsParam: 0,
  };
}

// The global mutable state used at runtime
export const state = createState();

export function resetState(s) {
  const fresh = createState();
  // Preserve highScore
  fresh.highScore = s.highScore;
  Object.assign(s, fresh);
}
