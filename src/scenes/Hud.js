import Phaser from 'phaser';
import { SCREEN, PLAYER, COLORS, FONTS } from '../config.js';
import { bus } from '../bus.js';

const BAR = { x: 72, y: 169, width: 176, height: 5 };

// Hearts, the boss bar and the big messages. Drawn on top of the game.
export default class Hud extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create(data) {
    const runs = (data && data.runs) || 0;

    this.hearts = [];
    for (let index = 0; index < PLAYER.maxHealth; index += 1) {
      this.hearts.push(this.add.image(4 + index * 10, 4, 'hearts', 0).setOrigin(0, 0));
    }
    this.dashBar = this.add.rectangle(5, 14, 28, 2, COLORS.white).setOrigin(0, 0);

    this.add.text(SCREEN.width - 4, 3, `MEMORY: ${runs} ${runs === 1 ? 'RUN' : 'RUNS'}`, { ...FONTS.small, color: '#8c8c8c' }).setOrigin(1, 0);

    this.add.rectangle(BAR.x - 2, BAR.y - 2, BAR.width + 4, BAR.height + 4, COLORS.black).setOrigin(0, 0);
    this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLORS.darkGrey).setOrigin(0, 0);
    this.bossBar = this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLORS.red).setOrigin(0, 0);
    this.add.text(SCREEN.width / 2, BAR.y - 4, 'THE MACHINE', { ...FONTS.title, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1);

    const hint = this.add.text(SCREEN.width / 2, 136, 'WASD MOVE   MOUSE AIM   CLICK SHOOT   SPACE DASH', { ...FONTS.small, backgroundColor: '#000000', padding: { x: 3, y: 2 } }).setOrigin(0.5, 0);
    this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 800 });

    this.shade = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.black, 0.65).setOrigin(0, 0).setVisible(false);
    this.bigText = this.add.text(SCREEN.width / 2, 62, '', { ...FONTS.title, fontSize: '16px', color: '#ff2b3d' }).setOrigin(0.5, 0.5).setVisible(false);
    this.middleText = this.add.text(SCREEN.width / 2, 86, '', FONTS.small).setOrigin(0.5, 0.5).setVisible(false);
    this.bottomText = this.add.text(SCREEN.width / 2, 108, '', { ...FONTS.small, color: '#8c8c8c' }).setOrigin(0.5, 0.5).setVisible(false);

    bus.on('player-health', (health) => {
      this.hearts.forEach((heart, index) => heart.setFrame(index < health ? 0 : 1));
    });
    bus.on('boss-health', (fraction) => {
      this.bossBar.width = Math.max(0, BAR.width * fraction);
    });
    bus.on('dash', (cooldown) => {
      this.dashBar.width = 0;
      this.dashBar.setFillStyle(COLORS.grey);
      this.tweens.add({ targets: this.dashBar, width: 28, duration: cooldown, onComplete: () => this.dashBar.setFillStyle(COLORS.white) });
    });
    bus.on('phase', () => {
      const alert = this.add.text(SCREEN.width / 2, 132, 'WARNING: MEMORY OVERFLOW', { ...FONTS.title, color: '#ff2b3d', backgroundColor: '#000000', padding: { x: 4, y: 3 } }).setOrigin(0.5, 0);
      this.tweens.add({ targets: alert, alpha: 0, delay: 1400, duration: 300, onComplete: () => alert.destroy() });
    });
    bus.on('player-dead', (info) => {
      this.showMessage('YOU DIED', `IT REMEMBERS. RUNS LOGGED: ${info.runs}`, 'PRESS R OR CLICK TO TRY AGAIN', 700);
    });
    bus.on('boss-dead', (info) => {
      this.showMessage('MACHINE OFFLINE', `YOU WON ON RUN ${info.runs}`, 'PRESS R OR CLICK TO FIGHT AGAIN', 300);
    });
  }

  showMessage(big, middle, bottom, delay) {
    this.time.delayedCall(delay, () => {
      this.shade.setVisible(true);
      this.bigText.setText(big).setVisible(true);
      this.middleText.setText(middle).setVisible(true);
      this.bottomText.setText(bottom).setVisible(true);
      this.tweens.add({ targets: this.bottomText, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    });
  }
}
