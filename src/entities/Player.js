import Phaser from 'phaser';
import { PLAYER, COLORS } from '../config.js';
import { bus } from '../bus.js';

const DASH_FRAME = 6;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  // stats come from the upgrade cards (Deck.playerStats)
  constructor(scene, x, y, stats, startHealth) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Small hitbox around the chest, so near misses feel fair.
    this.body.setSize(6, 6).setOffset(5, 7);
    this.setCollideWorldBounds(true);

    this.stats = stats;
    this.health = startHealth;
    this.shields = stats.shields;
    this.isDead = false;
    this.isDashing = false;
    this.dashEndsAt = 0;
    this.dashReadyAt = 0;
    this.nextShotAt = 0;
    this.invincibleUntil = 0;
    this.nextGhostAt = 0;
    this.aimAngle = -Math.PI / 2;
    this.lastMove = new Phaser.Math.Vector2(0, -1);

    this.aura = scene.add.image(x, y, 'player_glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
    this.shieldRing = scene.add.circle(x, y, 9).setStrokeStyle(1, COLORS.light, 0.9).setVisible(this.shields > 0);
    this.play('player_idle');
  }

  // move: { x, y } from WASD. aim: an angle, or null when not shooting.
  handleInput(time, move, aim, wantsDash) {
    if (this.isDead) return;

    if (aim !== null) this.aimAngle = aim;

    const direction = new Phaser.Math.Vector2(move.x, move.y).normalize();
    const isMoving = direction.lengthSq() > 0;
    if (isMoving) this.lastMove.copy(direction);

    if (this.isDashing) {
      if (time >= this.dashEndsAt) this.stopDash();
    } else {
      this.setVelocity(direction.x * PLAYER.walkSpeed, direction.y * PLAYER.walkSpeed);
      this.play(isMoving ? 'player_walk' : 'player_idle', true);
      // Face where you shoot. If you're not shooting, face where you walk.
      if (aim !== null) this.setFlipX(Math.cos(this.aimAngle) < 0);
      else if (move.x !== 0) this.setFlipX(move.x < 0);

      if (wantsDash && time >= this.dashReadyAt) {
        // Dash where you walk. Standing still, dash where you last walked.
        this.startDash(time, isMoving ? direction : this.lastMove.clone());
      }
    }

    if (aim !== null && !this.isDashing && time >= this.nextShotAt) {
      this.nextShotAt = time + this.stats.shotDelay;
      this.scene.firePlayerShots(this.orbPosition(), this.aimAngle);
    }
  }

  startDash(time, direction) {
    this.isDashing = true;
    this.dashEndsAt = time + PLAYER.dashTime;
    this.dashReadyAt = time + this.stats.dashCooldown;
    this.setVelocity(direction.x * this.stats.dashSpeed, direction.y * this.stats.dashSpeed);
    this.anims.stop();
    this.setFrame(DASH_FRAME);
    this.setFlipX(direction.x < 0);
    bus.emit('dash', this.stats.dashCooldown);
    this.scene.onPlayerDash(direction);
  }

  stopDash() {
    this.isDashing = false;
    this.setVelocity(0, 0);
    this.play('player_idle', true);
  }

  orbPosition() {
    return {
      x: this.x + Math.cos(this.aimAngle) * 7,
      y: this.y + 1 + Math.sin(this.aimAngle) * 7,
    };
  }

  canBeHurt(time) {
    return !this.isDead && !this.isDashing && time >= this.invincibleUntil;
  }

  // Returns 'blocked', 'hurt' or null (nothing happened).
  hurt(time) {
    if (!this.canBeHurt(time)) return null;
    this.invincibleUntil = time + PLAYER.hurtInvincibleTime;
    if (this.shields > 0) {
      this.shields -= 1;
      bus.emit('player-shields', this.shields);
      return 'blocked';
    }
    this.health -= 1;
    bus.emit('player-health', this.health);
    if (this.health <= 0) this.die();
    return 'hurt';
  }

  die() {
    this.isDead = true;
    this.isDashing = false;
    this.setVelocity(0, 0);
    this.body.enable = false;
    this.anims.stop();
    this.shieldRing.setVisible(false);
    this.scene.tweens.add({ targets: [this, this.aura], alpha: 0, scale: 1.8, duration: 600 });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.setDepth(this.y + 8);

    const pulse = 1 + Math.sin(time / 260) * 0.08;
    if (!this.isDead) this.aura.setPosition(this.x, this.y + 1).setScale(pulse);
    this.aura.setDepth(this.depth - 0.5);

    this.shieldRing.setPosition(this.x, this.y + 1).setDepth(this.depth + 0.3);
    this.shieldRing.setVisible(!this.isDead && this.shields > 0);

    // Blink while invincible after a hit.
    if (!this.isDead) {
      const blinking = time < this.invincibleUntil && Math.floor(time / 70) % 2 === 0;
      this.setAlpha(blinking ? 0.25 : 1);
    }

    // Leave fading copies of light behind while dashing.
    if (this.isDashing && time >= this.nextGhostAt) {
      this.nextGhostAt = time + 26;
      const ghost = this.scene.add.image(this.x, this.y, 'player', DASH_FRAME);
      ghost.setFlipX(this.flipX).setAlpha(0.55).setTint(COLORS.light).setDepth(this.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 240, onComplete: () => ghost.destroy() });
    }
  }
}
