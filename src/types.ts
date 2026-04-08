export interface SettingParam {
  val: number;
  min: number;
  max: number;
  step: number;
  label: string;
}

export interface Settings {
  turret: {
    rotationSpeed: SettingParam;
    bulletSpeed: SettingParam;
    bulletSpread: SettingParam;
    fireRate: SettingParam;
    heatPerShot: SettingParam;
    heatDecay: SettingParam;
    overheatCooldown: SettingParam;
  };
  helicopter: {
    speed: SettingParam;
    waveSpeedBonus: SettingParam;
  };
  paratrooper: {
    fallSpeed: SettingParam;
    maxDrift: SettingParam;
    maxLanded: SettingParam;
  };
  jet: {
    speed: SettingParam;
    waveSpeedBonus: SettingParam;
  };
  bomb: {
    fallSpeed: SettingParam;
    maxDrift: SettingParam;
  };
  game: {
    gravity: SettingParam;
    comboWindow: SettingParam;
    powerupInterval: SettingParam;
    godMode: SettingParam;
    nightOnly: SettingParam;
    dayOnly: SettingParam;
    spotlightWidth: SettingParam;
  };
  powerups: {
    duration: SettingParam;
    missileRate: SettingParam;
    missileSpeed: SettingParam;
  };
}

export interface ConfigValues {
  [category: string]: { [key: string]: number };
}

export type SettingsCategory = keyof Settings;

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  explosive: boolean;
}

export interface Helicopter {
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  dropTimer: number;
  dropped: boolean;
  width: number;
  height: number;
  bobAmp: number;
  bobFreq: number;
  bobPhase: number;
}

export interface Jet {
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  dropped: boolean;
  width: number;
  height: number;
}

export interface Paratrooper {
  x: number;
  y: number;
  vy: number;
  vx: number;
  chuteOpen: boolean;
  chuteTimer: number;
  landed: boolean;
  alive: boolean;
  falling?: boolean;
  landingX?: number | null;
  walking?: boolean;
  walkFrame?: number;
  targetX?: number;
  arrived?: boolean;
  wobbleAmp?: number;
  wobbleFreq?: number;
  wobblePhase?: number;
}

export interface Bomb {
  x: number;
  y: number;
  vy: number;
  vx?: number;
  chuteOpen: boolean;
  wobbleAmp?: number;
  wobbleFreq?: number;
  wobblePhase?: number;
}

export interface SmokePuff {
  x: number;
  y: number;
  size: number;
  life: number;
}

export interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

export interface Explosion {
  x: number;
  y: number;
  size: number;
  life: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface PowerUpDef {
  type: PowerUpType;
  label: string;
  color: string;
  symbol: string;
}

export type PowerUpType = 'triple' | 'explosive' | 'rapid' | 'freeze' | 'nuke' | 'laser' | 'missile';

export interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  life: number;
}

export interface FallingPowerUp {
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
  label: string;
  color: string;
  symbol: string;
}

export interface ActivePowerUp {
  type: PowerUpType;
  timer: number;
}

export interface Gun {
  readonly x: number;
  readonly y: number;
  readonly baseWidth: number;
  readonly baseHeight: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
}

export interface GameState {
  score: number;
  highScore: number;
  gameOver: boolean;
  gunAngle: number;
  bullets: Bullet[];
  helicopters: Helicopter[];
  paratroopers: Paratrooper[];
  jets: Jet[];
  bombs: Bomb[];
  explosions: Explosion[];
  debris: Debris[];
  missiles: Missile[];
  missileTimer: number;
  smokePuffs: SmokePuff[];
  floatingTexts: FloatingText[];
  landedLeft: number;
  landedRight: number;
  frame: number;
  started: boolean;
  gunDestroyed: boolean;
  endSequence: boolean;
  endSequenceTimer: number;
  canRestart: boolean;
  // Wave system
  wave: number;
  waveTimer: number;
  waveActive: boolean;
  wavePause: number;
  waveHeliCount: number;
  waveHelisSpawned: number;
  waveJetCount: number;
  waveJetsSpawned: number;
  waveSpawnTimer: number;
  waveAnnounceTimer: number;
  // Heat system
  heat: number;
  overheated: boolean;
  overheatTimer: number;
  // Combo system
  combo: number;
  comboTimer: number;
  // Power-up system
  powerups: FallingPowerUp[];
  activePowerups: Map<PowerUpType, number>;
  powerupSpawnTimer: number;
  // Input
  fireTimer: number;
  // Settings menu
  settingsOpen: boolean;
  settingsCategory: number;
  settingsParam: number;
  settingsDrillDown: boolean;
  // Night mode
  nightMode: boolean;
}
