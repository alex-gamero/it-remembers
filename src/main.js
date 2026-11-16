import Phaser from 'phaser';
import { SCREEN } from './config.js';
import Boot from './scenes/Boot.js';
import Game from './scenes/Game.js';
import Hud from './scenes/Hud.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN.width,
  height: SCREEN.height,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [Boot, Game, Hud],
});

// Lets you poke at the game from the browser console while testing.
window.game = game;
