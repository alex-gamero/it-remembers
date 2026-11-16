import Phaser from 'phaser';
import { ROOM, FLOOR, PLAYER, COLORS } from '../config.js';
import { bus } from '../bus.js';
import { pickLine } from '../lines.js';
import Player from '../entities/Player.js';
import Boss from '../entities/Boss.js';
import { Recorder } from '../systems/Recorder.js';
import { Predictor } from '../systems/Predictor.js';

export default class Game extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.isOver = false;
    this.canRestartAt = Infinity;

    this.recorder = new Recorder();
    this.predictor = new Predictor(this.recorder);
    this.recorder.startRun();

    // The room. Phase 2 is a second picture on top that fades in.
    this.add.image(0, 0, 'room_p1').setOrigin(0, 0).setDepth(-10);
    this.roomPhaseTwo = this.add.image(0, 0, 'room_p2').setOrigin(0, 0).setDepth(-9).setAlpha(0);
    this.physics.world.setBounds(FLOOR.x, FLOOR.y, FLOOR.width, FLOOR.height);

    this.playerBullets = this.physics.add.group({ maxSize: 50 });
    this.bossBits = this.physics.add.group({ maxSize: 400 });

    this.player = new Player(this, ROOM.width / 2, ROOM.height - 80);
    this.boss = new Boss(this, ROOM.width / 2, 120);

    this.physics.add.overlap(this.boss.sprite, this.playerBullets, (bossSprite, bullet) => this.onBulletHitsBoss(bullet));
    this.physics.add.overlap(this.player, this.bossBits, (player, bit) => this.onBitHitsPlayer(bit));
    this.physics.add.overlap(this.player, this.boss.sprite, () => this.hurtPlayer());

    // Camera follows the player and leans a little toward the mouse.
    const camera = this.cameras.main;
    camera.setBounds(0, 0, ROOM.width, ROOM.height);
    camera.startFollow(this.player, true, 0.12, 0.12);
    if (this.game.renderer.type === Phaser.WEBGL && camera.postFX) {
      camera.postFX.addVignette(0.5, 0.5, 0.95, 0.45);
    }
    camera.fadeIn(400, 0, 0, 0);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,R');
    this.input.mouse.disableContextMenu();
    this.dashRequested = false;
    this.keys.SPACE.on('down', () => { this.dashRequested = true; });
    this.keys.SHIFT.on('down', () => { this.dashRequested = true; });
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) this.dashRequested = true;
      if (this.isOver) this.tryRestart();
    });
    this.keys.R.on('down', () => this.tryRestart());

    // The HUD is its own scene so it stays still while the camera moves.
    bus.removeAllListeners();
    this.scene.stop('Hud');
    this.scene.launch('Hud', { runs: this.recorder.runs });

    const isFirstRun = this.recorder.runs === 0;
    this.time.delayedCall(350, () => {
      this.boss.say(pickLine(isFirstRun ? 'firstRun' : 'intro', { runs: this.recorder.runs + 1 }), 2400);
    });
  }

  update(time) {
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    const aimPoint = { x: pointer.worldX, y: pointer.worldY };

    const keys = this.keys;
    const moveX = (keys.D.isDown || keys.RIGHT.isDown ? 1 : 0) - (keys.A.isDown || keys.LEFT.isDown ? 1 : 0);
    const moveY = (keys.S.isDown || keys.DOWN.isDown ? 1 : 0) - (keys.W.isDown || keys.UP.isDown ? 1 : 0);
    const wantsDash = this.dashRequested;
    const wantsShoot = pointer.leftButtonDown() && !this.isOver;
    this.dashRequested = false;

    this.player.handleInput(time, moveX, moveY, aimPoint, wantsDash, wantsShoot);
    this.boss.update(time, this.player);

    this.cameras.main.setFollowOffset((160 - pointer.x) * 0.14, (90 - pointer.y) * 0.14);
    this.removeBulletsOutsideRoom(this.playerBullets);
    this.removeBulletsOutsideRoom(this.bossBits);
  }

  // ---------------------------------------------------------------- bullets
  firePlayerBullet(from, angle) {
    const bullet = this.playerBullets.get(from.x, from.y, 'pbullet');
    if (!bullet) return;
    bullet.enableBody(true, from.x, from.y, true, true);
    bullet.body.setSize(4, 4);
    bullet.setRotation(angle).setDepth(3000);
    this.physics.velocityFromRotation(angle, PLAYER.bulletSpeed, bullet.body.velocity);
    this.recorder.recordShot();
  }

  fireBossBit(x, y, angle, speed) {
    const bit = this.bossBits.get(x, y, 'bits');
    if (!bit) return;
    bit.enableBody(true, x, y, true, true);
    bit.setFrame(Math.random() < 0.5 ? 0 : 1);
    bit.body.setSize(3, 3);
    bit.setDepth(3001);
    this.physics.velocityFromRotation(angle, speed, bit.body.velocity);
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
  }

  // ---------------------------------------------------------------- hits
  onBulletHitsBoss(bullet) {
    if (!bullet.active) return;
    this.burst(bullet.x, bullet.y, 3, COLORS.white);
    bullet.disableBody(true, true);
    this.boss.takeDamage(1, this.time.now);
  }

  onBitHitsPlayer(bit) {
    if (!bit.active) return;
    if (this.hurtPlayer()) bit.disableBody(true, true);
  }

  hurtPlayer() {
    if (this.isOver || !this.player.hurt(this.time.now)) return false;
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
    this.canRestartAt = this.time.now + 1200;
    bus.emit('boss-dead', { runs: this.recorder.runs });
  }

  onPlayerDead() {
    this.isOver = true;
    this.recorder.endRun(false, this.boss.health);
    this.boss.say(pickLine('playerDead'), 4000);
    this.canRestartAt = this.time.now + 900;
    bus.emit('player-dead', { runs: this.recorder.runs });
  }

  tryRestart() {
    if (this.isOver && this.time.now >= this.canRestartAt) {
      this.canRestartAt = Infinity;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
    }
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
