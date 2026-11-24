import Phaser from 'phaser';
import { ROOM, FLOOR, PLAYER, BOSS, COLORS } from '../config.js';
import { bus } from '../bus.js';
import { pickLine } from '../lines.js';
import Player from '../entities/Player.js';
import Boss from '../entities/Boss.js';
import { Recorder } from '../systems/Recorder.js';
import { Predictor } from '../systems/Predictor.js';
import { Deck, CARDS } from '../systems/Deck.js';

// Arrow keys shoot. Holding two arrows shoots diagonally.
function arrowAngle(keys) {
  const x = (keys.RIGHT.isDown ? 1 : 0) - (keys.LEFT.isDown ? 1 : 0);
  const y = (keys.DOWN.isDown ? 1 : 0) - (keys.UP.isDown ? 1 : 0);
  if (x === 0 && y === 0) return null;
  return Math.atan2(y, x);
}

export default class Game extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.isOver = false;
    this.canContinueAt = Infinity;

    this.recorder = new Recorder();
    this.predictor = new Predictor(this.recorder);
    this.deck = new Deck();
    this.playerStats = this.deck.playerStats();
    const cursed = this.deck.takeCurse();
    const startHealth = Math.max(1, this.playerStats.maxHealth - (cursed ? 1 : 0));
    this.recorder.startRun();

    // The room. Phase 2 is a second picture on top that fades in.
    this.add.image(0, 0, 'room_p1').setOrigin(0, 0).setDepth(-10);
    this.roomPhaseTwo = this.add.image(0, 0, 'room_p2').setOrigin(0, 0).setDepth(-9).setAlpha(0);
    this.physics.world.setBounds(FLOOR.x, FLOOR.y, FLOOR.width, FLOOR.height);

    this.playerBullets = this.physics.add.group({ maxSize: 120 });
    this.bossBits = this.physics.add.group({ maxSize: 500 });
    this.viruses = this.physics.add.group({ maxSize: 12 });

    this.player = new Player(this, ROOM.width / 2, ROOM.height - 80, this.playerStats, startHealth);
    this.boss = new Boss(this, ROOM.width / 2, 120);

    this.physics.add.overlap(this.boss.sprite, this.playerBullets, (bossSprite, bullet) => this.onBulletHitsBoss(bullet));
    this.physics.add.overlap(this.viruses, this.playerBullets, (virus, bullet) => this.onBulletHitsVirus(virus, bullet));
    this.physics.add.overlap(this.player, this.bossBits, (player, bit) => this.onBitHitsPlayer(bit));
    this.physics.add.overlap(this.player, this.viruses, (player, virus) => this.onVirusHitsPlayer(virus));
    this.physics.add.overlap(this.player, this.boss.sprite, () => this.hurtPlayer());

    // Camera follows the player and leans a little toward where you shoot.
    const camera = this.cameras.main;
    camera.setBounds(0, 0, ROOM.width, ROOM.height);
    camera.startFollow(this.player, true, 0.12, 0.12);
    if (this.game.renderer.type === Phaser.WEBGL && camera.postFX) {
      camera.postFX.addVignette(0.5, 0.5, 0.95, 0.45);
    }
    camera.fadeIn(400, 0, 0, 0);

    // WASD moves. Arrows shoot. Space dashes. The mouse still works if you have one.
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,R,ENTER');
    this.dashRequested = false;
    this.keys.SPACE.on('down', () => { this.dashRequested = true; this.continueAfterRun(); });
    this.keys.SHIFT.on('down', () => { this.dashRequested = true; });
    this.keys.R.on('down', () => this.continueAfterRun());
    this.keys.ENTER.on('down', () => this.continueAfterRun());
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) this.dashRequested = true;
      this.continueAfterRun();
    });

    // The HUD is its own scene so it stays still while the camera moves.
    bus.removeAllListeners();
    this.scene.stop('Hud');
    this.scene.launch('Hud', {
      runs: this.recorder.runs,
      maxHealth: this.playerStats.maxHealth,
      health: startHealth,
      shields: this.playerStats.shields,
      cards: this.deck.cards,
    });

    this.time.delayedCall(350, () => this.boss.say(this.openingLine(cursed), 2600));
  }

  openingLine(cursed) {
    if (cursed) return pickLine('curse');
    if (this.recorder.runs === 0) return pickLine('firstRun');
    const lastCard = this.deck.lastCard;
    if (lastCard && Math.random() < 0.6) return pickLine('card', { card: CARDS[lastCard].name });
    return pickLine('intro', { runs: this.recorder.runs + 1 });
  }

  update(time) {
    const keys = this.keys;
    const move = {
      x: (keys.D.isDown ? 1 : 0) - (keys.A.isDown ? 1 : 0),
      y: (keys.S.isDown ? 1 : 0) - (keys.W.isDown ? 1 : 0),
    };

    let aim = arrowAngle(keys);
    const pointer = this.input.activePointer;
    if (aim === null && pointer.leftButtonDown() && !this.isOver) {
      pointer.updateWorldPoint(this.cameras.main);
      aim = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    }
    if (this.isOver) aim = null;

    const wantsDash = this.dashRequested;
    this.dashRequested = false;

    this.player.handleInput(time, move, aim, wantsDash);
    this.boss.update(time, this.player);
    this.updateViruses(time);

    const lean = this.player.aimAngle;
    this.cameras.main.setFollowOffset(-Math.cos(lean) * 14, -Math.sin(lean) * 10);
    this.removeBulletsOutsideRoom(this.playerBullets);
    this.removeBulletsOutsideRoom(this.bossBits);
  }

  // ---------------------------------------------------------------- player shots
  firePlayerShots(from, angle) {
    this.firePlayerBullet(from, angle);
    for (let pair = 1; pair <= this.playerStats.sideShots; pair += 1) {
      this.firePlayerBullet(from, angle + 0.16 * pair);
      this.firePlayerBullet(from, angle - 0.16 * pair);
    }
    this.recorder.recordShot();
  }

  firePlayerBullet(from, angle) {
    const bullet = this.playerBullets.get(from.x, from.y, 'pbullet');
    if (!bullet) return;
    bullet.enableBody(true, from.x, from.y, true, true);
    bullet.setScale(this.playerStats.bulletScale);
    bullet.body.setSize(5, 5);
    bullet.setRotation(angle).setDepth(3000).setBlendMode(Phaser.BlendModes.ADD);
    bullet.damage = this.playerStats.damage;
    this.physics.velocityFromRotation(angle, PLAYER.bulletSpeed, bullet.body.velocity);
  }

  // ---------------------------------------------------------------- boss bits and viruses
  fireBossBit(x, y, angle, speed) {
    const bit = this.bossBits.get(x, y, 'bits');
    if (!bit) return;
    bit.enableBody(true, x, y, true, true);
    bit.setFrame(Math.random() < 0.5 ? 0 : 1);
    bit.body.setSize(3, 3);
    bit.setDepth(3001);
    this.physics.velocityFromRotation(angle, speed, bit.body.velocity);
  }

  spawnVirus(x, y) {
    const virus = this.viruses.get(x, y, 'virus');
    if (!virus) return;
    virus.enableBody(true, x, y, true, true);
    virus.play('virus_wiggle');
    virus.body.setSize(7, 6);
    virus.health = BOSS.virusHealth;
    virus.diesAt = this.time.now + 9000;
    virus.setAlpha(0);
    this.tweens.add({ targets: virus, alpha: 1, duration: 200 });
    this.burst(x, y, 5, COLORS.red);
  }

  updateViruses(time) {
    this.viruses.children.each((virus) => {
      if (!virus.active) return;
      if (time >= virus.diesAt || this.boss.isDead) {
        this.killVirus(virus, false);
        return;
      }
      const angle = Phaser.Math.Angle.Between(virus.x, virus.y, this.player.x, this.player.y);
      const wobble = Math.sin(time / 120 + virus.x) * 0.5;
      this.physics.velocityFromRotation(angle + wobble, this.player.isDead ? 0 : BOSS.virusSpeed, virus.body.velocity);
      virus.setDepth(virus.y + 4);
    });
  }

  killVirus(virus, popIntoBits) {
    this.burst(virus.x, virus.y, 6, COLORS.red);
    if (popIntoBits && this.boss.phase === 2) {
      for (let index = 0; index < 4; index += 1) this.fireBossBit(virus.x, virus.y, (index * Math.PI) / 2 + Math.PI / 4, 55);
    }
    virus.disableBody(true, true);
  }

  removeBulletsOutsideRoom(group) {
    const margin = 4;
    group.children.each((bullet) => {
      if (!bullet.active) return;
      const outside = bullet.x < FLOOR.x - margin || bullet.x > FLOOR.x + FLOOR.width + margin
        || bullet.y < FLOOR.y - 14 || bullet.y > FLOOR.y + FLOOR.height + margin;
      if (outside) bullet.disableBody(true, true);
    });
  }

  clearBossBits() {
    this.bossBits.children.each((bit) => {
      if (bit.active) {
        this.burst(bit.x, bit.y, 1, COLORS.red);
        bit.disableBody(true, true);
      }
    });
    this.viruses.children.each((virus) => {
      if (virus.active) this.killVirus(virus, false);
    });
  }

  // ---------------------------------------------------------------- hits
  onBulletHitsBoss(bullet) {
    if (!bullet.active) return;
    this.burst(bullet.x, bullet.y, 3, COLORS.white);
    bullet.disableBody(true, true);
    this.boss.takeDamage(bullet.damage || 1, this.time.now);
  }

  onBulletHitsVirus(virus, bullet) {
    if (!bullet.active || !virus.active) return;
    bullet.disableBody(true, true);
    virus.health -= bullet.damage || 1;
    virus.setTintFill(COLORS.white);
    this.time.delayedCall(50, () => virus.clearTint());
    if (virus.health <= 0) this.killVirus(virus, true);
  }

  onBitHitsPlayer(bit) {
    if (!bit.active) return;
    if (this.hurtPlayer()) bit.disableBody(true, true);
  }

  onVirusHitsPlayer(virus) {
    if (!virus.active) return;
    if (this.hurtPlayer()) this.killVirus(virus, false);
  }

  hurtPlayer() {
    if (this.isOver) return false;
    const result = this.player.hurt(this.time.now);
    if (!result) return false;
    if (result === 'blocked') {
      this.burst(this.player.x, this.player.y, 12, COLORS.light);
      this.cameras.main.flash(100, 190, 230, 255);
      return true;
    }
    this.recorder.recordHit();
    this.cameras.main.shake(160, 0.01);
    this.cameras.main.flash(120, 255, 43, 61);
    this.burst(this.player.x, this.player.y, 10, COLORS.red);
    this.boss.showFace('laugh', 900);
    if (this.player.isDead) this.onPlayerDead();
    return true;
  }

  // ---------------------------------------------------------------- things the player and boss report
  onPlayerDash(direction) {
    // Turn the dash into one of four words. The boss remembers these.
    const isSideways = Math.abs(direction.x) >= Math.abs(direction.y);
    const word = isSideways ? (direction.x < 0 ? 'left' : 'right') : (direction.y < 0 ? 'up' : 'down');
    this.recorder.recordDash(word, {
      distanceToBoss: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y)),
      bossSide: this.boss.x < this.player.x ? 'left' : 'right',
      health: this.player.health,
      phase: this.boss.phase,
    });

    // Shockwave card: a ring of light shots when you dash.
    const rings = this.playerStats.shockwave;
    for (let ring = 0; ring < rings; ring += 1) {
      for (let index = 0; index < 8; index += 1) {
        this.firePlayerBullet({ x: this.player.x, y: this.player.y }, (index / 8) * Math.PI * 2 + ring * 0.2);
      }
    }
  }

  onPhaseTwo() {
    this.clearBossBits();
    this.cameras.main.shake(500, 0.012);
    this.cameras.main.flash(400, 255, 31, 75);
    this.tweens.add({ targets: this.roomPhaseTwo, alpha: 1, duration: 900 });
  }

  onBossDying() {
    this.isOver = true;
    this.clearBossBits();
  }

  onBossDead() {
    this.recorder.endRun(true, 0);
    this.deck.reset();
    this.won = true;
    this.canContinueAt = this.time.now + 1200;
    bus.emit('boss-dead', { runs: this.recorder.runs });
  }

  onPlayerDead() {
    this.isOver = true;
    this.won = false;
    this.recorder.endRun(false, this.boss.health);
    this.boss.say(pickLine('playerDead'), 4000);
    this.canContinueAt = this.time.now + 1300;
    bus.emit('player-dead', { runs: this.recorder.runs });
  }

  // After dying you pick a card. After winning you start over with a fresh deck.
  continueAfterRun() {
    if (!this.isOver || this.time.now < this.canContinueAt) return;
    this.canContinueAt = Infinity;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('Hud');
      if (this.won) this.scene.restart();
      else this.scene.start('Cards');
    });
  }

  // Little square sparks that fly out and fade.
  burst(x, y, count, color) {
    for (let index = 0; index < count; index += 1) {
      const spark = this.add.image(x, y, 'spark').setTint(color).setDepth(3500);
      const angle = Math.random() * Math.PI * 2;
      const distance = 6 + Math.random() * 16;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 220 + Math.random() * 200,
        onComplete: () => spark.destroy(),
      });
    }
  }
}
