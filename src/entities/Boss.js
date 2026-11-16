import Phaser from 'phaser';
import { BOSS, FLOOR, PLAYER, COLORS, FONTS } from '../config.js';
import { bus } from '../bus.js';
import { pickLine } from '../lines.js';
import { DIRECTION_VECTORS } from '../systems/Predictor.js';

const FACES = { neutral: 0, angry: 1, laugh: 2, hurt: 3 };

// The order the boss cycles through its attacks in each phase.
const ATTACK_ORDER = {
  1: ['ring', 'predict', 'fan', 'predict'],
  2: ['spiral', 'predict', 'doubleRing', 'predict', 'fan'],
};

export default class Boss {
  constructor(scene, x, y) {
    this.scene = scene;
    this.health = BOSS.maxHealth;
    this.phase = 1;
    this.isDead = false;
    this.wakeAt = null;
    this.nextAttackAt = 0;
    this.attackIndex = 0;
    this.faceHeldUntil = 0;
    this.nextTauntAt = 0;
    this.warning = null;

    this.shadow = scene.add.image(x, y + 30, 'shadow');
    this.sprite = scene.physics.add.sprite(x, y, 'boss_p1', 0);
    this.sprite.body.setSize(52, 44).setOffset(46, 14);
    this.sprite.setImmovable(true);
    this.sprite.play('boss_walk_p1');
    this.face = scene.add.sprite(x, y, 'face_p1', FACES.neutral).setOrigin(0, 0);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);

    this.warningBox = scene.add.graphics().setDepth(2);
    this.warningLabel = scene.add.text(0, 0, '', { ...FONTS.small, color: '#ff2b3d' }).setOrigin(0.5, 1).setDepth(4000).setVisible(false);

    this.bubbleBorder = scene.add.graphics().setDepth(4999);
    this.bubble = scene.add.text(0, 0, '', { ...FONTS.small, backgroundColor: '#000000', padding: { x: 4, y: 3 } });
    this.bubble.setDepth(5000).setVisible(false);
    this.bubbleHideAt = 0;

    this.syncParts(0);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  // Where the bits come out: the middle of the screen.
  mouth() {
    return { x: this.sprite.x, y: this.sprite.y - 4 };
  }

  update(time, player) {
    this.syncParts(time);
    if (this.isDead) return;

    if (this.wakeAt === null) {
      this.wakeAt = time + 1600;
      this.nextAttackAt = this.wakeAt;
      this.nextTauntAt = time + 9000;
    }
    if (time < this.wakeAt || player.isDead) {
      this.sprite.setVelocity(0, 0);
      this.clearWarning();
      return;
    }

    this.move(time, player);
    this.updateWarning(time, player);

    if (time >= this.nextAttackAt && !this.warning) {
      const order = ATTACK_ORDER[this.phase];
      const attackName = order[this.attackIndex % order.length];
      this.attackIndex += 1;
      this.nextAttackAt = time + BOSS.attackDelay[this.phase];
      this.showFace('angry', 700);
      this[attackName](time, player);
    }
  }

  // Circles the player while keeping its distance.
  move(time, player) {
    const away = new Phaser.Math.Vector2(this.x - player.x, this.y - player.y);
    if (away.lengthSq() < 1) away.set(0, -1);
    away.normalize();
    const sway = Math.sin(time / 1400) * 60;
    const goalX = Phaser.Math.Clamp(player.x + away.x * BOSS.keepDistance - away.y * sway, FLOOR.x + 70, FLOOR.x + FLOOR.width - 70);
    const goalY = Phaser.Math.Clamp(player.y + away.y * BOSS.keepDistance + away.x * sway, FLOOR.y + 30, FLOOR.y + FLOOR.height - 50);
    const toGoal = new Phaser.Math.Vector2(goalX - this.x, goalY - this.y);
    if (toGoal.length() > 4) {
      toGoal.normalize().scale(BOSS.walkSpeed[this.phase]);
      this.sprite.setVelocity(toGoal.x, toGoal.y);
    } else {
      this.sprite.setVelocity(0, 0);
    }
  }

  shoot(angle, speedMultiplier = 1) {
    const from = this.mouth();
    this.scene.fireBossBit(from.x, from.y, angle, BOSS.bitSpeed[this.phase] * speedMultiplier);
  }

  later(delay, action) {
    this.scene.time.delayedCall(delay, () => {
      if (!this.isDead && !this.scene.isOver) action();
    });
  }

  // ---------------------------------------------------------------- attacks
  ring(time, player, count = 14, offset = Math.random() * Math.PI) {
    for (let index = 0; index < count; index += 1) {
      this.shoot(offset + (index * Math.PI * 2) / count);
    }
  }

  doubleRing(time, player) {
    const offset = Math.random() * Math.PI;
    this.ring(time, player, 16, offset);
    this.later(380, () => this.ring(time, player, 16, offset + Math.PI / 16));
  }

  fan(time, player) {
    for (let wave = 0; wave < 3; wave += 1) {
      this.later(wave * 200, () => {
        const center = Phaser.Math.Angle.Between(this.x, this.y - 4, player.x, player.y);
        for (let index = -2; index <= 2; index += 1) {
          this.shoot(center + index * 0.2, 1.5);
        }
      });
    }
  }

  spiral(time, player) {
    const startAngle = Math.random() * Math.PI * 2;
    for (let step = 0; step < 26; step += 1) {
      this.later(step * 60, () => {
        this.shoot(startAngle + step * 0.42, 1.1);
        this.shoot(startAngle + step * 0.42 + Math.PI, 1.1);
      });
    }
    this.nextAttackAt += 900;
  }

  // The attack that uses the memory.
  // It shoots straight at you to make you dodge, and marks where it thinks you will dodge to.
  // Then it fires a fast stream into that spot.
  predict(time, player) {
    const prediction = this.scene.predictor.predictDash();
    let label = 'LEARNING...';
    let offset = { x: 0, y: 0 };
    if (prediction) {
      const vector = DIRECTION_VECTORS[prediction.direction];
      offset = { x: vector.x * PLAYER.dashDistance, y: vector.y * PLAYER.dashDistance };
      label = `PREDICT: ${prediction.direction.toUpperCase()} ${Math.round(prediction.confidence * 100)}%`;
      if (time >= this.nextTauntAt) {
        this.nextTauntAt = time + 12000;
        this.say(pickLine(prediction.direction));
      }
    }
    this.warning = { offset, firesAt: time + BOSS.predictionWarningTime, target: { x: player.x, y: player.y } };
    this.warningLabel.setText(label).setVisible(true);

    // The bait: three bits straight at the player.
    for (let shot = 0; shot < 3; shot += 1) {
      this.later(120 + shot * 90, () => {
        this.shoot(Phaser.Math.Angle.Between(this.x, this.y - 4, player.x, player.y), 1.8);
      });
    }
  }

  updateWarning(time, player) {
    if (!this.warning) return;
    const warning = this.warning;
    // The marked spot follows the player until the boss fires.
    warning.target.x = Phaser.Math.Clamp(player.x + warning.offset.x, FLOOR.x + 10, FLOOR.x + FLOOR.width - 10);
    warning.target.y = Phaser.Math.Clamp(player.y + warning.offset.y, FLOOR.y + 10, FLOOR.y + FLOOR.height - 10);

    const size = 34;
    const left = Math.round(warning.target.x - size / 2);
    const top = Math.round(warning.target.y - size / 2);
    this.warningBox.clear();
    if (Math.floor(time / 80) % 2 === 0) {
      this.warningBox.fillStyle(COLORS.red, 0.12).fillRect(left, top, size, size);
    }
    this.warningBox.fillStyle(COLORS.red, 1);
    for (let step = 0; step <= size; step += 3) {
      this.warningBox.fillRect(left + step, top, 1, 1).fillRect(left + step, top + size, 1, 1);
      this.warningBox.fillRect(left, top + step, 1, 1).fillRect(left + size, top + step, 1, 1);
    }
    // Keep the label on screen even when the marked spot is at the edge.
    const view = this.scene.cameras.main.worldView;
    const halfLabel = this.warningLabel.width / 2 + 2;
    const labelX = Phaser.Math.Clamp(warning.target.x, view.x + halfLabel, view.right - halfLabel);
    const labelY = top - 1 < view.y + 20 ? top + size + 10 : top - 1;
    this.warningLabel.setPosition(Math.round(labelX), labelY);

    if (time >= warning.firesAt) {
      const locked = { x: warning.target.x, y: warning.target.y };
      this.clearWarning();
      for (let shot = 0; shot < 7; shot += 1) {
        this.later(shot * 55, () => {
          const spread = (Math.random() - 0.5) * 0.12;
          this.shoot(Phaser.Math.Angle.Between(this.x, this.y - 4, locked.x, locked.y) + spread, 2.4);
        });
      }
    }
  }

  clearWarning() {
    this.warning = null;
    this.warningBox.clear();
    this.warningLabel.setVisible(false);
  }

  // ---------------------------------------------------------------- damage and phases
  takeDamage(amount, time) {
    if (this.isDead || this.wakeAt === null || time < this.wakeAt) return;
    this.health = Math.max(0, this.health - amount);
    bus.emit('boss-health', this.health / BOSS.maxHealth);
    this.showFace('hurt', 110);
    this.sprite.setTintFill(COLORS.white);
    this.scene.time.delayedCall(50, () => this.sprite.clearTint());

    if (this.health <= 0) {
      this.die();
    } else if (this.phase === 1 && this.health <= BOSS.maxHealth * BOSS.phaseTwoAt) {
      this.startPhaseTwo(time);
    }
  }

  startPhaseTwo(time) {
    this.phase = 2;
    this.attackIndex = 0;
    this.clearWarning();
    this.sprite.play('boss_walk_p2');
    this.face.setTexture('face_p2', FACES.laugh);
    this.glow.setAlpha(0.8);
    this.showFace('laugh', 1500);
    this.say(pickLine('phaseTwo'), 3000);
    this.wakeAt = time + 1500;
    this.nextAttackAt = this.wakeAt;
    this.scene.onPhaseTwo();
    bus.emit('phase', 2);
  }

  die() {
    this.isDead = true;
    this.clearWarning();
    this.sprite.setVelocity(0, 0);
    this.sprite.body.enable = false;
    this.sprite.anims.stop();
    this.face.setFrame(FACES.hurt);
    this.say(pickLine('bossDead'), 2600);
    this.scene.onBossDying();

    for (let blast = 0; blast < 12; blast += 1) {
      this.scene.time.delayedCall(blast * 130, () => {
        const sparkX = this.x + Phaser.Math.Between(-30, 30);
        const sparkY = this.y + Phaser.Math.Between(-24, 22);
        this.scene.burst(sparkX, sparkY, 8, COLORS.red);
        this.scene.cameras.main.shake(100, 0.006);
        this.sprite.setTintFill(blast % 2 === 0 ? COLORS.white : COLORS.red);
      });
    }
    this.scene.time.delayedCall(12 * 130 + 100, () => {
      this.scene.burst(this.x, this.y, 40, COLORS.white);
      this.scene.cameras.main.flash(300, 255, 255, 255);
      for (const part of [this.sprite, this.face, this.glow, this.shadow]) part.setVisible(false);
      this.scene.onBossDead();
    });
  }

  // ---------------------------------------------------------------- face, speech, drawing
  showFace(name, holdTime) {
    this.face.setFrame(FACES[name]);
    this.faceHeldUntil = this.scene.time.now + holdTime;
  }

  say(line, duration = 2600) {
    this.bubble.setText(line).setVisible(true);
    this.bubbleHideAt = this.scene.time.now + duration;
  }

  syncParts(time) {
    const depth = this.sprite.y + 30;
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 31).setDepth(1);
    this.sprite.setDepth(depth);
    this.face.setPosition(Math.round(this.sprite.x) - 20, Math.round(this.sprite.y) - 15).setDepth(depth + 0.1);
    this.glow.setPosition(this.sprite.x, this.sprite.y - 4).setDepth(depth + 0.2);

    if (!this.isDead && time >= this.faceHeldUntil) {
      this.face.setFrame(this.phase === 2 ? FACES.angry : FACES.neutral);
    }

    this.bubbleBorder.clear();
    if (this.bubble.visible) {
      if (time >= this.bubbleHideAt && this.bubbleHideAt > 0) {
        this.bubble.setVisible(false);
        return;
      }
      const camera = this.scene.cameras.main;
      const view = camera.worldView;
      const bubbleX = Phaser.Math.Clamp(this.sprite.x - this.bubble.width / 2, view.x + 4, view.right - this.bubble.width - 4);
      const bubbleY = Phaser.Math.Clamp(this.sprite.y - 62, view.y + 14, view.bottom - 40);
      this.bubble.setPosition(Math.round(bubbleX), Math.round(bubbleY));
      this.bubbleBorder.lineStyle(1, COLORS.white, 1);
      this.bubbleBorder.strokeRect(this.bubble.x - 0.5, this.bubble.y - 0.5, this.bubble.width + 1, this.bubble.height + 1);
    }
  }
}
