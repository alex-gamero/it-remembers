// Every number you might want to tweak lives here.

export const SCREEN = { width: 320, height: 180 };

// The room is bigger than the screen. The camera follows the player.
export const ROOM = { width: 512, height: 352 };

// The floor area the player can walk on (inside the walls).
export const FLOOR = { x: 12, y: 44, width: 488, height: 296 };

export const PLAYER = {
  maxHealth: 3,
  walkSpeed: 92,
  dashSpeed: 270,
  dashTime: 160,        // milliseconds the dash lasts
  dashCooldown: 650,    // milliseconds before you can dash again
  dashDistance: 43,     // dashSpeed * dashTime, used by the boss to aim
  shotDelay: 170,       // milliseconds between shots
  bulletSpeed: 280,
  hurtInvincibleTime: 1100,
};

export const BOSS = {
  maxHealth: 150,
  phaseTwoAt: 0.5,          // phase 2 starts at half health
  walkSpeed: { 1: 24, 2: 36 },
  attackDelay: { 1: 2100, 2: 1500 },
  bitSpeed: { 1: 62, 2: 80 },
  keepDistance: 105,        // how far it tries to stay from the player
  predictionWarningTime: 650,
};

export const COLORS = {
  red: 0xff2b3d,
  white: 0xffffff,
  black: 0x000000,
  grey: 0x8c8c8c,
  darkGrey: 0x2e2e2e,
};

export const FONTS = {
  small: { fontFamily: 'Silkscreen', fontSize: '8px', color: '#ffffff' },
  title: { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffffff' },
};
