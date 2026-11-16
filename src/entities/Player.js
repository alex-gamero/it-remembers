import Phaser from 'phaser';
import { PLAYER } from '../config.js';
import { bus } from '../bus.js';

const DASH_FRAME = 6;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Small hitbox around the body, so near misses feel fair.
    this.body.setSize(6, 7).setOffset(5, 8);
    this.setCollideWorldBounds(true);

    this.health = PLAYER.maxHealth;
    this.isDead = false;
    this.isDashing = false;
    this.dashEndsAt = 0;
    this.dashReadyAt = 0;
    this.nextShotAt = 0;
    this.invincibleUntil = 0;
    this.nextGhostAt = 0;
    this.aimAngle = -Math.PI / 2;

    this.gun = scene.add.image(x, y, 'gun').setOrigin(0.15, 0.5);
    this.play('player_idle');
  }

  // moveX and moveY are -1, 0 or 1. aimPoint is where the mouse is in the room.
  handleInput(time, moveX, moveY, aimPoint, wantsDash, wantsShoot) {
    if (this.isDead) return;

    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, aimPoint.x, aimPoint.y);

    if (this.isDashing) {
      if (time >= this.dashEndsAt) this.stopDash();
    } else {
      const direction = new Phaser.Math.Vector2(moveX, moveY).normalize();
      this.setVelocity(direction.x * PLAYER.walkSpeed, direction.y * PLAYER.walkSpeed);

      const isMoving = direction.lengthSq() > 0;
      this.play(isMoving ? 'player_walk' : 'player_idle', true);
      this.setFlipX(Math.cos(this.aimAngle) < 0);

      if (wantsDash && time >= this.dashReadyAt) {
        // Dash where you are walking. Standing still, dash where you are aiming.
        const dashDirection = isMoving
          ? direction
          : new Phaser.Math.Vector2(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
        this.startDash(time, dashDirection);
      }
    }

    if (wantsShoot && !this.isDashing && time >= this.nextShotAt) {
      this.nextShotAt = time + PLAYER.shotDelay;
      this.scene.firePlayerBullet(this.gunTip(), this.aimAngle);
    }
  }

  startDash(time, direction) {
    this.isDashing = true;
    this.dashEndsAt = time + PLAYER.dashTime;
    this.dashReadyAt = time + PLAYER.dashCooldown;
    this.setVelocity(direction.x * PLAYER.dashSpeed, direction.y * PLAYER.dashSpeed);
    this.anims.stop();
    this.setFrame(DASH_FRAME);
    this.setFlipX(direction.x < 0);
    bus.emit('dash', PLAYER.dashCooldown);
    this.scene.onPlayerDash(direction);
  }

  stopDash() {
    this.isDashing = false;
    this.setVelocity(0, 0);
    this.play('player_idle', true);
  }

  gunTip() {
    return {
      x: this.x + Math.cos(this.aimAngle) * 11,
      y: this.y + 2 + Math.sin(this.aimAngle) * 11,
    };
  }

  canBeHurt(time) {
    return !this.isDead && !this.isDashing && time >= this.invincibleUntil;
  }

  hurt(time) {
    if (!this.canBeHurt(time)) return false;
    this.health -= 1;
    this.invincibleUntil = time + PLAYER.hurtInvincibleTime;
    bus.emit('player-health', this.health);
    if (this.health <= 0) this.die();
    return true;
  }

  die() {
    this.isDead = true;
    this.isDashing = false;
    this.setVelocity(0, 0);
    this.body.enable = false;
    this.anims.stop();
    this.gun.setVisible(false);
    this.scene.tweens.add({ targets: this, alpha: 0, angle: 90, duration: 500 });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.setDepth(this.y + 8);

    // The gun floats next to the body and points at the mouse.
    const pointingLeft = Math.cos(this.aimAngle) < 0;
    this.gun.setPosition(this.x + Math.cos(this.aimAngle) * 5, this.y + 2 + Math.sin(this.aimAngle) * 5);
    this.gun.setRotation(this.aimAngle);
    this.gun.setFlipY(pointingLeft);
    this.gun.setDepth(this.depth + (Math.sin(this.aimAngle) < 0 ? -1 : 1));
    this.gun.setVisible(!this.isDead && !this.isDashing);

    // Blink while invincible after a hit.
    if (!this.isDead) {
      const blinking = time < this.invincibleUntil && Math.floor(time / 70) % 2 === 0;
      this.setAlpha(blinking ? 0.25 : 1);
    }

    // Leave fading copies behind while dashing.
    if (this.isDashing && time >= this.nextGhostAt) {
      this.nextGhostAt = time + 28;
      const ghost = this.scene.add.image(this.x, this.y, 'player', DASH_FRAME);
      ghost.setFlipX(this.flipX).setAlpha(0.5).setTint(0xff2b3d).setDepth(this.depth - 1);
      this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
    }
  }
}
