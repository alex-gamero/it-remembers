import Phaser from 'phaser';
import { SCREEN, COLORS, FONTS } from '../config.js';
import { bus } from '../bus.js';
import { CARDS } from '../systems/Deck.js';

const BAR = { x: 72, y: 169, width: 176, height: 5 };

// Hearts, cards, the boss bar and the big messages. Drawn on top of the game.
export default class Hud extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create(data) {
    const runs = data.runs || 0;

    this.hearts = [];
    for (let index = 0; index < data.maxHealth; index += 1) {
      this.hearts.push(this.add.image(4 + index * 10, 4, 'hearts', index < data.health ? 0 : 1).setOrigin(0, 0));
    }
    this.shieldIcons = [];
    for (let index = 0; index < data.shields; index += 1) {
      const x = 6 + data.maxHealth * 10 + index * 9;
      this.shieldIcons.push(this.add.image(x, 4, 'card_icons', CARDS.firewall.icon).setOrigin(0, 0).setScale(0.5).setTint(COLORS.light));
    }
    this.dashBar = this.add.rectangle(5, 14, 28, 2, COLORS.white).setOrigin(0, 0);

    // The cards you are carrying this run.
    data.cards.slice(-14).forEach((cardId, index) => {
      this.add.image(4 + index * 9, 19, 'card_icons', CARDS[cardId].icon).setOrigin(0, 0).setScale(0.5);
    });

    this.add.text(SCREEN.width - 4, 3, `MEMORY: ${runs} ${runs === 1 ? 'RUN' : 'RUNS'}`, { ...FONTS.small, color: '#8c8c8c' }).setOrigin(1, 0);

    this.add.rectangle(BAR.x - 2, BAR.y - 2, BAR.width + 4, BAR.height + 4, COLORS.black).setOrigin(0, 0);
    this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLORS.darkGrey).setOrigin(0, 0);
    this.bossBar = this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, COLORS.red).setOrigin(0, 0);
    this.add.text(SCREEN.width / 2, BAR.y - 4, 'THE MACHINE', { ...FONTS.title, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1);

    if (runs < 2) {
      const hint = this.add.text(SCREEN.width / 2, 136, 'WASD MOVE   ARROWS SHOOT   SPACE DASH', { ...FONTS.small, backgroundColor: '#000000', padding: { x: 3, y: 2 } }).setOrigin(0.5, 0);
      this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 800 });
    }

    this.shade = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.black, 0.65).setOrigin(0, 0).setVisible(false);
    this.bigText = this.add.text(SCREEN.width / 2, 62, '', { ...FONTS.title, fontSize: '16px', color: '#ff2b3d' }).setOrigin(0.5, 0.5).setVisible(false);
    this.middleText = this.add.text(SCREEN.width / 2, 86, '', FONTS.small).setOrigin(0.5, 0.5).setVisible(false);
    this.bottomText = this.add.text(SCREEN.width / 2, 108, '', { ...FONTS.small, color: '#8c8c8c' }).setOrigin(0.5, 0.5).setVisible(false);

    bus.on('player-health', (health) => {
      this.hearts.forEach((heart, index) => heart.setFrame(index < health ? 0 : 1));
    });
    bus.on('player-shields', (shields) => {
      this.shieldIcons.forEach((icon, index) => icon.setAlpha(index < shields ? 1 : 0.2));
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
      this.showMessage('YOU DIED', `IT REMEMBERS. RUNS LOGGED: ${info.runs}`, 'PRESS SPACE TO PICK A CARD', 700);
    });
    bus.on('boss-dead', (info) => {
      this.showMessage('MACHINE OFFLINE', `YOU WON ON RUN ${info.runs}`, 'PRESS SPACE TO FIGHT AGAIN', 300);
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
