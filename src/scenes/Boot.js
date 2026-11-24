import Phaser from 'phaser';

// Loads every image and font, sets up the animations, then starts the fight.
export default class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.setPath('assets/');
    this.load.image('room_p1', 'room_p1.png');
    this.load.image('room_p2', 'room_p2.png');
    this.load.spritesheet('boss_p1', 'boss_p1.png', { frameWidth: 144, frameHeight: 80 });
    this.load.spritesheet('boss_p2', 'boss_p2.png', { frameWidth: 144, frameHeight: 80 });
    this.load.spritesheet('face_p1', 'face_p1.png', { frameWidth: 41, frameHeight: 23 });
    this.load.spritesheet('face_p2', 'face_p2.png', { frameWidth: 41, frameHeight: 23 });
    this.load.spritesheet('player', 'player.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('virus', 'virus.png', { frameWidth: 11, frameHeight: 9 });
    this.load.spritesheet('card', 'card.png', { frameWidth: 58, frameHeight: 70 });
    this.load.spritesheet('card_icons', 'card_icons.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('player_glow', 'player_glow.png');
    this.load.image('popup', 'popup.png');
    this.load.spritesheet('bits', 'bits.png', { frameWidth: 7, frameHeight: 7 });
    this.load.spritesheet('hearts', 'hearts.png', { frameWidth: 9, frameHeight: 8 });
    this.load.image('pbullet', 'pbullet.png');
    this.load.image('shadow', 'shadow.png');
    this.load.image('glow', 'glow.png');
    this.load.image('spark', 'spark.png');
  }

  create() {
    this.anims.create({ key: 'player_idle', frames: this.anims.generateFrameNumbers('player', { frames: [0, 1] }), frameRate: 3, repeat: -1 });
    this.anims.create({ key: 'player_walk', frames: this.anims.generateFrameNumbers('player', { frames: [2, 3, 4, 5] }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'virus_wiggle', frames: this.anims.generateFrameNumbers('virus', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'boss_walk_p1', frames: this.anims.generateFrameNumbers('boss_p1', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'boss_walk_p2', frames: this.anims.generateFrameNumbers('boss_p2', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });

    // Text drawn before the pixel fonts load would use a fallback font, so wait for them.
    const fontsReady = document.fonts
      ? Promise.all([document.fonts.load('8px "Silkscreen"'), document.fonts.load('8px "Press Start 2P"')])
      : Promise.resolve();
    const start = () => this.scene.start('Game');
    fontsReady.then(start, start);
  }
}
