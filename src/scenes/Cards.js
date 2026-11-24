import Phaser from 'phaser';
import { SCREEN, COLORS, FONTS } from '../config.js';
import { Deck, CARDS } from '../systems/Deck.js';

const CARD_GAP = 68;

// After you die: pick 1 of 3 random cards, then fight again.
// Left/right (or A/D) to choose, Space or Enter to take it. 1, 2, 3 or a click also work.
export default class Cards extends Phaser.Scene {
  constructor() {
    super('Cards');
  }

  create() {
    this.deck = new Deck();
    this.choices = this.deck.drawChoices();
    this.selected = 1;
    this.isPicking = true;

    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x050505).setOrigin(0, 0);
    for (let y = 0; y < SCREEN.height; y += 3) {
      this.add.rectangle(0, y, SCREEN.width, 1, 0x000000, 0.5).setOrigin(0, 0);
    }
    this.add.text(SCREEN.width / 2, 10, 'PICK A CARD', { ...FONTS.title, fontSize: '16px', color: '#ff2b3d' }).setOrigin(0.5, 0);
    this.add.text(SCREEN.width / 2, 32, 'IT LEARNS. YOU UPGRADE.', { ...FONTS.small, color: '#8c8c8c' }).setOrigin(0.5, 0);

    this.cards = this.choices.map((cardId, index) => this.makeCard(cardId, index));
    this.hint = this.add.text(SCREEN.width / 2, 168, '< >  CHOOSE     SPACE  TAKE IT', { ...FONTS.small, color: '#8c8c8c' }).setOrigin(0.5, 0);

    const keys = this.input.keyboard.addKeys('LEFT,RIGHT,A,D,SPACE,ENTER,ONE,TWO,THREE');
    keys.LEFT.on('down', () => this.moveSelection(-1));
    keys.A.on('down', () => this.moveSelection(-1));
    keys.RIGHT.on('down', () => this.moveSelection(1));
    keys.D.on('down', () => this.moveSelection(1));
    keys.SPACE.on('down', () => this.take(this.selected));
    keys.ENTER.on('down', () => this.take(this.selected));
    keys.ONE.on('down', () => this.take(0));
    keys.TWO.on('down', () => this.take(1));
    keys.THREE.on('down', () => this.take(2));

    this.refresh();
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  makeCard(cardId, index) {
    const card = CARDS[cardId];
    const x = SCREEN.width / 2 + (index - 1) * CARD_GAP;
    const container = this.add.container(x, 94);
    const frame = this.add.image(0, 0, 'card', card.risky ? 1 : 0);
    const icon = this.add.image(0, -15, 'card_icons', card.icon);
    const name = this.add.text(0, 1, card.name, { ...FONTS.small, color: card.risky ? '#ff2b3d' : '#ffffff', align: 'center', wordWrap: { width: 54 } }).setOrigin(0.5, 0);
    const number = this.add.text(0, -32, `${index + 1}`, { ...FONTS.small, color: '#8c8c8c' }).setOrigin(0.5, 0);
    container.add([frame, icon, name, number]);
    container.setSize(58, 70);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => { this.selected = index; this.refresh(); });
    container.on('pointerdown', () => this.take(index));

    const description = this.add.text(SCREEN.width / 2, 136, card.text.join('\n'), { ...FONTS.small, align: 'center', lineSpacing: 1 }).setOrigin(0.5, 0);
    return { container, frame, description, cardId };
  }

  moveSelection(step) {
    if (!this.isPicking) return;
    this.selected = Phaser.Math.Wrap(this.selected + step, 0, 3);
    this.refresh();
  }

  refresh() {
    this.cards.forEach((card, index) => {
      const isSelected = index === this.selected;
      card.container.y = isSelected ? 88 : 94;
      card.container.setAlpha(isSelected ? 1 : 0.55);
      card.description.setVisible(isSelected);
    });
  }

  take(index) {
    if (!this.isPicking) return;
    this.isPicking = false;
    this.selected = index;
    this.refresh();
    const result = this.deck.pick(this.choices[index]);
    const chosen = this.cards[index];

    this.cards.forEach((card, cardIndex) => {
      if (cardIndex !== index) this.tweens.add({ targets: card.container, alpha: 0, y: 120, duration: 250 });
      card.description.setVisible(false);
    });
    this.tweens.add({ targets: chosen.container, x: SCREEN.width / 2, y: 84, scale: 1.1, duration: 300, ease: 'Back.easeOut' });
    this.hint.setVisible(false);

    let message = `${CARDS[result.cardId].name} ADDED`;
    let color = '#ffffff';
    if (result.jackpot === true) {
      message = `JACKPOT: ${CARDS[result.added[0]].name} + ${CARDS[result.added[1]].name}`;
    } else if (result.jackpot === false) {
      message = 'BAD LUCK: ONE HEART LESS NEXT RUN';
      color = '#ff2b3d';
      this.cameras.main.shake(250, 0.01);
    }
    this.add.text(SCREEN.width / 2, 138, message, { ...FONTS.small, color }).setOrigin(0.5, 0);
    this.cameras.main.flash(150, 255, 255, 255);

    this.time.delayedCall(result.jackpot === null ? 900 : 1700, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    });
  }
}
