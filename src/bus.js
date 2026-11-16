import Phaser from 'phaser';

// One shared event channel so the game and the HUD can talk to each other.
// Events: 'player-health', 'boss-health', 'dash', 'phase', 'player-dead', 'boss-dead'
export const bus = new Phaser.Events.EventEmitter();
