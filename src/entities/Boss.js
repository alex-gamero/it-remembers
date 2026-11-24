import Phaser from 'phaser';
import { BOSS, FLOOR, COLORS, FONTS } from '../config.js';
import { bus } from '../bus.js';
import { pickLine } from '../lines.js';
import { DIRECTION_VECTORS } from '../systems/Predictor.js';

const FACES = { neutral: 0, angry: 1, laugh: 2, hurt: 3 };

// The order the boss cycles through its attacks in each phase.
// Attacks marked (AI) use the prediction of where you will dodge.
const ATTACK_ORDER = {
  1: ['ring', 'slam', 'predict', 'firewall', 'fan', 'ram', 'predict'],
  2: ['scan', 'popups', 'predict', 'viruses', 'firewall', 'spiral', 'ram', 'slam', 'doubleRing'],
};

function distanceToSegment(point, start, end) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared;
  t = Phaser.Math.Clamp(t, 0, 1);
  return Phaser.Math.Distance.Between(point.x, point.y, start.x + t * (end.x - start.x), start.y + t * (end.y - start.y));
}

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
    this.mode = 'free';        // free, still, windup, ram, stunned
    this.modeEndsAt = 0;
    this.charge = null;
    this.hazards = [];         // lasers, slams and falling windows that are on screen

    this.shadow = scene.add.image(x, y + 30, 'shadow');
    this.sprite = scene.physics.add.sprite(x, y, 'boss_p1', 0);
    this.sprite.body.setSize(52, 44).setOffset(46, 14);
    this.sprite.setImmovable(true);
    this.sprite.play('boss_walk_p1');
    this.face = scene.add.sprite(x, y, 'face_p1', FACES.neutral).setOrigin(0, 0);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);

    this.fx = scene.add.graphics().setDepth(3);              // marks on the floor
    this.fxTop = scene.add.graphics().setDepth(3200);        // lasers, drawn above everything
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

  // Where the boss thinks you will be after your next dash. Falls back to where you are now.
  predictedSpot(player) {
    const prediction = this.scene.predictor.predictDash();
    if (!prediction) return { x: player.x, y: player.y, prediction: null };
    const vector = DIRECTION_VECTORS[prediction.direction];
    const distance = this.scene.playerStats.dashDistance;
    return {
      x: Phaser.Math.Clamp(player.x + vector.x * distance, FLOOR.x + 10, FLOOR.x + FLOOR.width - 10),
      y: Phaser.Math.Clamp(player.y + vector.y * distance, FLOOR.y + 10, FLOOR.y + FLOOR.height - 10),
      prediction,
    };
  }

  update(time, player) {
    this.syncParts(time);
    this.drawHazards(time, player);
    if (this.isDead) return;

    if (this.wakeAt === null) {
      this.wakeAt = time + 1600;
      this.nextAttackAt = this.wakeAt;
      this.nextTauntAt = time + 9000;
    }
    if (time < this.wakeAt || player.isDead) {
      this.sprite.setVelocity(0, 0);
      if (player.isDead) this.clearAttacks();
      return;
    }

    this.updateMode(time, player);
    this.updateWarning(time, player);

    if (time >= this.nextAttackAt && !this.warning && this.mode === 'free') {
      const order = ATTACK_ORDER[this.phase];
      const attackName = order[this.attackIndex % order.length];
      this.attackIndex += 1;
      this.showFace('angry', 700);
      const attackLength = this[attackName](time, player) || 0;
      this.nextAttackAt = time + attackLength + BOSS.restBetweenAttacks[this.phase];
    }
  }

  updateMode(time, player) {
    if (this.mode === 'free') {
      this.move(time, player);
      return;
    }
    if (this.mode === 'ram') {
      this.updateRam(time);
      return;
    }
    this.sprite.setVelocity(0, 0);
    if (this.mode === 'windup') {
      // shake before charging
      this.sprite.x += Math.sin(time / 20) * 0.8;
    }
    if (time >= this.modeEndsAt) {
      if (this.mode === 'windup') this.startRam(time);
      else this.mode = 'free';
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

  holdStill(time, duration) {
    this.mode = 'still';
    this.modeEndsAt = time + duration;
    this.sprite.setVelocity(0, 0);
  }

  shoot(angle, speedMultiplier = 1, from = this.mouth()) {
    this.scene.fireBossBit(from.x, from.y, angle, BOSS.bitSpeed[this.phase] * speedMultiplier);
  }

  later(delay, action) {
    this.scene.time.delayedCall(delay, () => {
      if (!this.isDead && !this.scene.isOver) action();
    });
  }

  // ---------------------------------------------------------------- bullet patterns
  ring(time, player, count = 14, offset = Math.random() * Math.PI) {
    for (let index = 0; index < count; index += 1) {
      this.shoot(offset + (index * Math.PI * 2) / count);
    }
    return 600;
  }

  doubleRing(time, player) {
    const offset = Math.random() * Math.PI;
    this.ring(time, player, 16, offset);
    this.later(380, () => this.ring(time, player, 16, offset + Math.PI / 16));
    this.later(760, () => this.ring(time, player, 16, offset));
    return 1100;
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
    return 800;
  }

  spiral(time) {
    this.holdStill(time, 1600);
    const startAngle = Math.random() * Math.PI * 2;
    for (let step = 0; step < 26; step += 1) {
      this.later(step * 60, () => {
        for (let arm = 0; arm < 3; arm += 1) {
          this.shoot(startAngle + step * 0.38 + (arm * Math.PI * 2) / 3, 1.1);
        }
      });
    }
    return 1700;
  }

  // ---------------------------------------------------------------- (AI) predict: marks where you will dodge, then fires there
  predict(time, player) {
    const spot = this.predictedSpot(player);
    let label = 'LEARNING...';
    let offset = { x: 0, y: 0 };
    if (spot.prediction) {
      offset = { x: spot.x - player.x, y: spot.y - player.y };
      label = `PREDICT: ${spot.prediction.direction.toUpperCase()} ${Math.round(spot.prediction.confidence * 100)}%`;
      if (time >= this.nextTauntAt) {
        this.nextTauntAt = time + 12000;
        this.say(pickLine(spot.prediction.direction));
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
    return BOSS.predictionWarningTime + 500;
  }

  updateWarning(time, player) {
    if (!this.warning) return;
    const warning = this.warning;
    // The marked spot follows the player until the boss fires.
    warning.target.x = Phaser.Math.Clamp(player.x + warning.offset.x, FLOOR.x + 10, FLOOR.x + FLOOR.width - 10);
    warning.target.y = Phaser.Math.Clamp(player.y + warning.offset.y, FLOOR.y + 10, FLOOR.y + FLOOR.height - 10);
    this.placeLabel(warning.target.x, warning.target.y - 18, warning.target.y + 28);

    if (time >= warning.firesAt) {
      const locked = { x: warning.target.x, y: warning.target.y };
      this.warning = null;
      this.warningLabel.setVisible(false);
      for (let shot = 0; shot < 7; shot += 1) {
        this.later(shot * 55, () => {
          const spread = (Math.random() - 0.5) * 0.12;
          this.shoot(Phaser.Math.Angle.Between(this.x, this.y - 4, locked.x, locked.y) + spread, 2.4);
        });
      }
    }
  }

  // Keeps the red label on screen even when the marked spot is at the edge.
  placeLabel(x, y, yIfTooHigh) {
    const view = this.scene.cameras.main.worldView;
    const halfLabel = this.warningLabel.width / 2 + 2;
    const labelX = Phaser.Math.Clamp(x, view.x + halfLabel, view.right - halfLabel);
    const labelY = y < view.y + 20 ? yIfTooHigh : y;
    this.warningLabel.setPosition(Math.round(labelX), Math.round(labelY));
  }

  // ---------------------------------------------------------------- (AI) slam: cables hit the floor where you are and where you will dodge
  slam(time, player) {
    const spot = this.predictedSpot(player);
    const targets = [{ x: player.x, y: player.y }, { x: spot.x, y: spot.y }];
    const extra = this.phase === 2 ? 4 : 2;
    for (let index = 0; index < extra; index += 1) {
      targets.push({
        x: Phaser.Math.Clamp(player.x + Phaser.Math.Between(-70, 70), FLOOR.x + 16, FLOOR.x + FLOOR.width - 16),
        y: Phaser.Math.Clamp(player.y + Phaser.Math.Between(-50, 50), FLOOR.y + 16, FLOOR.y + FLOOR.height - 16),
      });
    }
    targets.forEach((target, index) => {
      this.hazards.push({ type: 'slam', x: target.x, y: target.y, radius: 15, startAt: time + index * 140, hitAt: time + 850 + index * 140, done: false });
    });
    return 850 + targets.length * 140 + 300;
  }

  // ---------------------------------------------------------------- (AI) firewall: a wall of bits with one gap, placed against your habit
  firewall(time, player) {
    const spot = this.predictedSpot(player);
    const vertical = Math.abs(player.y - this.y) >= Math.abs(player.x - this.x);
    const waves = this.phase === 2 ? 2 : 1;
    for (let wave = 0; wave < waves; wave += 1) {
      this.later(wave * 1100, () => this.sendWall(vertical, spot, wave));
    }
    if (spot.prediction && time >= this.nextTauntAt) {
      this.nextTauntAt = time + 12000;
      this.say(pickLine('firewall'));
    }
    return 600 + waves * 1100;
  }

  sendWall(vertical, spot, wave) {
    const player = this.scene.player;
    const speed = this.phase === 2 ? 72 : 58;
    // The gap goes on the opposite side of your favorite dodge.
    let gapOffset = Phaser.Math.Between(-30, 30);
    const direction = spot.prediction ? spot.prediction.direction : null;
    if (vertical && direction === 'left') gapOffset = 36;
    if (vertical && direction === 'right') gapOffset = -36;
    if (!vertical && direction === 'up') gapOffset = 36;
    if (!vertical && direction === 'down') gapOffset = -36;
    if (wave === 1) gapOffset = -gapOffset;
    const gapSize = 15;

    if (vertical) {
      const startY = this.y;
      const angle = player.y > startY ? Math.PI / 2 : -Math.PI / 2;
      const gapX = Phaser.Math.Clamp(player.x + gapOffset, FLOOR.x + 20, FLOOR.x + FLOOR.width - 20);
      for (let x = FLOOR.x + 4; x < FLOOR.x + FLOOR.width; x += 9) {
        if (Math.abs(x - gapX) > gapSize) this.scene.fireBossBit(x, startY, angle, speed);
      }
    } else {
      const startX = this.x;
      const angle = player.x > startX ? 0 : Math.PI;
      const gapY = Phaser.Math.Clamp(player.y + gapOffset, FLOOR.y + 20, FLOOR.y + FLOOR.height - 20);
      for (let y = FLOOR.y + 4; y < FLOOR.y + FLOOR.height; y += 9) {
        if (Math.abs(y - gapY) > gapSize) this.scene.fireBossBit(startX, y, angle, speed);
      }
    }
  }

  // ---------------------------------------------------------------- (AI) ram: charges at where you will dodge
  ram(time, player) {
    const spot = this.predictedSpot(player);
    this.charge = { target: { x: spot.x, y: spot.y }, from: { x: this.x, y: this.y } };
    this.mode = 'windup';
    this.modeEndsAt = time + 750;
    this.showFace('angry', 1500);
    return 750 + 900 + 700;
  }

  startRam(time) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.charge.target.x, this.charge.target.y);
    this.charge.angle = angle;
    this.charge.from = { x: this.x, y: this.y };
    this.charge.maxDistance = Phaser.Math.Distance.Between(this.x, this.y, this.charge.target.x, this.charge.target.y) + 70;
    this.charge.endsAt = time + 900;
    this.charge.nextTrailAt = time;
    this.mode = 'ram';
    this.scene.physics.velocityFromRotation(angle, BOSS.ramSpeed, this.sprite.body.velocity);
  }

  updateRam(time) {
    const traveled = Phaser.Math.Distance.Between(this.charge.from.x, this.charge.from.y, this.x, this.y);
    const hitWall = this.x < FLOOR.x + 30 || this.x > FLOOR.x + FLOOR.width - 30 || this.y < FLOOR.y + 20 || this.y > FLOOR.y + FLOOR.height - 30;
    if (this.phase === 2 && time >= this.charge.nextTrailAt) {
      this.charge.nextTrailAt = time + 70;
      this.shoot(this.charge.angle + Math.PI / 2, 0.6, { x: this.x, y: this.y });
      this.shoot(this.charge.angle - Math.PI / 2, 0.6, { x: this.x, y: this.y });
    }
    if (traveled >= this.charge.maxDistance || hitWall || time >= this.charge.endsAt) {
      this.sprite.x = Phaser.Math.Clamp(this.x, FLOOR.x + 30, FLOOR.x + FLOOR.width - 30);
      this.sprite.y = Phaser.Math.Clamp(this.y, FLOOR.y + 20, FLOOR.y + FLOOR.height - 30);
      this.sprite.setVelocity(0, 0);
      this.scene.cameras.main.shake(200, 0.01);
      this.scene.burst(this.x, this.y + 24, 14, COLORS.white);
      if (this.phase === 2) this.ring(time, null, 12);
      // Dizzy after crashing. This is your chance to hit it.
      this.mode = 'stunned';
      this.modeEndsAt = time + 800;
      this.showFace('hurt', 800);
      this.charge = null;
    }
  }

  // ---------------------------------------------------------------- (AI) scan: a laser that sweeps toward where you will dodge
  scan(time, player) {
    const spot = this.predictedSpot(player);
    const toPlayer = Phaser.Math.Angle.Between(this.x, this.y - 4, player.x, player.y);
    const toSpot = Phaser.Math.Angle.Between(this.x, this.y - 4, spot.x, spot.y);
    let sweep = Phaser.Math.Angle.Wrap(toSpot - toPlayer);
    if (Math.abs(sweep) < 0.05) sweep = Math.random() < 0.5 ? 0.4 : -0.4;
    const sweepSize = Math.sign(sweep) * 1.4;
    const aimTime = 800;
    const fireTime = 1300;
    this.holdStill(time, aimTime + fireTime + 200);
    // Two beams back to back. The front one starts a bit behind you and sweeps toward your dodge.
    for (const extra of [0, Math.PI]) {
      this.hazards.push({ type: 'laser', aimEndsAt: time + aimTime, endsAt: time + aimTime + fireTime, angle: toPlayer - sweepSize * 0.35 + extra, extra, sweep: sweepSize });
    }
    return aimTime + fireTime + 200;
  }

  // ---------------------------------------------------------------- (AI) popups: error windows fall on you
  popups(time, player) {
    const spot = this.predictedSpot(player);
    const targets = [{ x: player.x, y: player.y }, { x: spot.x, y: spot.y }];
    for (let index = 0; index < 4; index += 1) {
      targets.push({
        x: Phaser.Math.Clamp(player.x + Phaser.Math.Between(-90, 90), FLOOR.x + 20, FLOOR.x + FLOOR.width - 20),
        y: Phaser.Math.Clamp(player.y + Phaser.Math.Between(-60, 60), FLOOR.y + 16, FLOOR.y + FLOOR.height - 16),
      });
    }
    targets.forEach((target, index) => {
      const landAt = time + 1000 + index * 180;
      const window = this.scene.add.image(target.x, target.y - 160, 'popup').setDepth(3100).setAlpha(0.95);
      this.scene.tweens.add({ targets: window, y: target.y, duration: 380, delay: landAt - time - 380, ease: 'Quad.easeIn' });
      this.hazards.push({ type: 'popup', x: target.x, y: target.y, startAt: time + index * 180, landAt, window, done: false });
    });
    this.say(pickLine('popups'), 1800);
    return 1000 + targets.length * 180 + 400;
  }

  // ---------------------------------------------------------------- viruses: little bugs that chase you
  viruses(time) {
    const count = this.phase === 2 ? 5 : 3;
    this.holdStill(time, 600);
    for (let index = 0; index < count; index += 1) {
      this.later(index * 120, () => {
        const angle = (index / count) * Math.PI * 2;
        this.scene.spawnVirus(this.x + Math.cos(angle) * 30, this.y + Math.sin(angle) * 20);
      });
    }
    this.say(pickLine('viruses'), 1800);
    return 1200;
  }

  // ---------------------------------------------------------------- drawing and checking lasers, slams and windows
  drawHazards(time, player) {
    this.fx.clear();
    this.fxTop.clear();
    const blink = Math.floor(time / 80) % 2 === 0;

    if (this.warning) {
      const size = 34;
      const left = Math.round(this.warning.target.x - size / 2);
      const top = Math.round(this.warning.target.y - size / 2);
      if (blink) this.fx.fillStyle(COLORS.red, 0.12).fillRect(left, top, size, size);
      this.fx.fillStyle(COLORS.red, 1);
      for (let step = 0; step <= size; step += 3) {
        this.fx.fillRect(left + step, top, 1, 1).fillRect(left + step, top + size, 1, 1);
        this.fx.fillRect(left, top + step, 1, 1).fillRect(left + size, top + step, 1, 1);
      }
    }

    if (this.mode === 'windup' && this.charge) {
      this.fx.lineStyle(1, COLORS.red, blink ? 0.9 : 0.4);
      this.fx.lineBetween(this.x, this.y + 20, this.charge.target.x, this.charge.target.y);
      this.fx.strokeCircle(this.charge.target.x, this.charge.target.y, 10);
    }

    this.hazards = this.hazards.filter((hazard) => {
      if (hazard.type === 'slam') return this.drawSlam(hazard, time, player, blink);
      if (hazard.type === 'laser') return this.drawLaser(hazard, time, player, blink);
      if (hazard.type === 'popup') return this.drawPopup(hazard, time, player);
      return false;
    });
  }

  drawSlam(slam, time, player, blink) {
    if (time < slam.startAt) return true;
    if (!slam.done) {
      const progress = Phaser.Math.Clamp((time - slam.startAt) / (slam.hitAt - slam.startAt), 0, 1);
      this.fx.fillStyle(COLORS.red, blink ? 0.18 : 0.08).fillCircle(slam.x, slam.y, slam.radius);
      this.fx.lineStyle(1, COLORS.red, 1).strokeCircle(slam.x, slam.y, slam.radius * (2.2 - 1.2 * progress));
      this.fx.lineStyle(1, COLORS.red, 0.5).strokeCircle(slam.x, slam.y, slam.radius);
      if (time >= slam.hitAt) {
        slam.done = true;
        slam.fadeUntil = time + 220;
        this.scene.cameras.main.shake(90, 0.006);
        this.scene.burst(slam.x, slam.y, 10, COLORS.red);
        if (Phaser.Math.Distance.Between(player.x, player.y, slam.x, slam.y) < slam.radius + 2) this.scene.hurtPlayer();
        if (this.phase === 2) {
          for (let index = 0; index < 6; index += 1) this.shoot((index / 6) * Math.PI * 2, 0.9, slam);
        }
      }
      return true;
    }
    const fade = (slam.fadeUntil - time) / 220;
    this.fx.fillStyle(COLORS.white, Math.max(0, fade) * 0.8).fillCircle(slam.x, slam.y, slam.radius);
    return time < slam.fadeUntil;
  }

  drawLaser(laser, time, player, blink) {
    const origin = this.mouth();
    const length = 600;
    if (time < laser.aimEndsAt) {
      // Aiming: a thin blinking line that slowly follows you.
      const toPlayer = Phaser.Math.Angle.Between(origin.x, origin.y, player.x, player.y);
      laser.angle = Phaser.Math.Angle.RotateTo(laser.angle, toPlayer - laser.sweep * 0.35 + laser.extra, 0.02);
      const end = { x: origin.x + Math.cos(laser.angle) * length, y: origin.y + Math.sin(laser.angle) * length };
      this.fxTop.lineStyle(1, COLORS.red, blink ? 0.9 : 0.35).lineBetween(origin.x, origin.y, end.x, end.y);
      return true;
    }
    if (time >= laser.endsAt) return false;
    const progress = (time - laser.aimEndsAt) / (laser.endsAt - laser.aimEndsAt);
    const angle = laser.angle + laser.sweep * Phaser.Math.Easing.Sine.InOut(progress);
    const end = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
    const width = 6 + Math.sin(time / 30) * 1.5;
    this.fxTop.lineStyle(width + 4, COLORS.red, 0.25).lineBetween(origin.x, origin.y, end.x, end.y);
    this.fxTop.lineStyle(width, COLORS.red, 1).lineBetween(origin.x, origin.y, end.x, end.y);
    this.fxTop.lineStyle(2, COLORS.white, 1).lineBetween(origin.x, origin.y, end.x, end.y);
    if (distanceToSegment(player, origin, end) < width / 2 + 2) this.scene.hurtPlayer();
    return true;
  }

  drawPopup(popup, time, player) {
    if (time < popup.startAt) return true;
    if (!popup.done) {
      const progress = Phaser.Math.Clamp((time - popup.startAt) / (popup.landAt - popup.startAt), 0, 1);
      const width = 34 * progress;
      const height = 24 * progress;
      this.fx.fillStyle(COLORS.black, 0.6).fillRect(popup.x - width / 2, popup.y - height / 2, width, height);
      this.fx.lineStyle(1, COLORS.red, 0.8).strokeRect(popup.x - 17, popup.y - 12, 34, 24);
      if (time >= popup.landAt) {
        popup.done = true;
        this.scene.cameras.main.shake(70, 0.005);
        this.scene.burst(popup.x, popup.y, 8, COLORS.white);
        const insideX = Math.abs(player.x - popup.x) < 19;
        const insideY = Math.abs(player.y - popup.y) < 14;
        if (insideX && insideY) this.scene.hurtPlayer();
        for (let index = 0; index < 4; index += 1) this.shoot(Math.PI / 4 + (index * Math.PI) / 2, 0.9, popup);
        this.scene.tweens.add({ targets: popup.window, alpha: 0, duration: 400, delay: 200, onComplete: () => popup.window.destroy() });
      }
      return true;
    }
    return false;
  }

  clearAttacks() {
    this.warning = null;
    this.warningLabel.setVisible(false);
    for (const hazard of this.hazards) {
      if (hazard.window) hazard.window.destroy();
    }
    this.hazards = [];
    this.fx.clear();
    this.fxTop.clear();
    if (this.mode !== 'free') {
      this.mode = 'free';
      this.charge = null;
      this.sprite.setVelocity(0, 0);
    }
  }

  // ---------------------------------------------------------------- damage and phases
  takeDamage(amount, time) {
    if (this.isDead || this.wakeAt === null || time < this.wakeAt) return;
    const multiplier = this.mode === 'stunned' ? 1.5 : 1;
    this.health = Math.max(0, this.health - amount * multiplier);
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
    this.clearAttacks();
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
    this.clearAttacks();
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
      const view = this.scene.cameras.main.worldView;
      const bubbleX = Phaser.Math.Clamp(this.sprite.x - this.bubble.width / 2, view.x + 4, view.right - this.bubble.width - 4);
      const bubbleY = Phaser.Math.Clamp(this.sprite.y - 62, view.y + 14, view.bottom - 40);
      this.bubble.setPosition(Math.round(bubbleX), Math.round(bubbleY));
      this.bubbleBorder.lineStyle(1, COLORS.white, 1);
      this.bubbleBorder.strokeRect(this.bubble.x - 0.5, this.bubble.y - 0.5, this.bubble.width + 1, this.bubble.height + 1);
    }
  }
}
