export function createControlSet(scene, controls) {
  const Phaser = window.Phaser;

  return {
    left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[controls.left]),
    right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[controls.right]),
    jump: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[controls.jump]),
    ability: controls.ability ? scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[controls.ability]) : null
  };
}

export function updatePlayerMovement(player, now) {
  const Phaser = window.Phaser;
  const { sprite, keys, character } = player;
  const tuning = sprite.scene.gameplayTuning;
  const velocity = sprite.body.velocity;
  const onGround = now - player.onGroundAt < 130;
  const ridingPlayer = now - player.ridingPlayerAt < 130;
  const surface = onGround && now - player.surfaceTouchedAt < 180 ? player.lastSurface : 'air';
  const surfaceBehavior = surface === 'air' ? 'air' : character.surfaces[surface] ?? 'solid';
  const slippery = surfaceBehavior === 'slippery';
  const preserveMomentum = now < player.slopeMomentumUntil;
  const left = keys.left.isDown;
  const right = keys.right.isDown;
  const inputAxis = (right ? 1 : 0) - (left ? 1 : 0);
  const jumpPressed = Phaser.Input.Keyboard.JustDown(keys.jump);
  const maxRunSpeed = (character.speed / 58) * tuning.speedScale;
  const targetSpeed = inputAxis * maxRunSpeed;
  const acceleration = onGround ? (slippery ? 0.035 : 0.24) * tuning.accelerationScale : 0.075 * tuning.airControlScale;
  const idleDamping = onGround ? (slippery ? 0.997 : 0.78) : preserveMomentum ? 0.997 : 0.986;
  let nextVelocityX = velocity.x;

  if (slippery && onGround) {
    const jumpCount = Math.min(player.slipperyJumpCount ?? 0, 2);
    const slideDirection = player.slopeSlideDirection ?? (surface === 'blue' ? -1 : 1);
    const slideImpulse = (surface === 'blue' ? 0.08 : 0.035) * tuning.rampForceScale * slideDirection * Math.pow(1.55, jumpCount);
    const maxSlideSpeed = maxRunSpeed * 2.45 * tuning.rampSpeedScale * Math.pow(1.2, jumpCount);

    nextVelocityX = Phaser.Math.Clamp(velocity.x + slideImpulse + targetSpeed * acceleration, -maxSlideSpeed, maxSlideSpeed);
    player.slopeMomentumUntil = now + 850;
  } else if (inputAxis !== 0) {
    nextVelocityX = Phaser.Math.Linear(velocity.x, targetSpeed, acceleration);
  } else {
    nextVelocityX = velocity.x * idleDamping;
  }

  if (inputAxis !== 0) {
    sprite.setFlipX(inputAxis < 0);
  }

  setVelocity(sprite, nextVelocityX, velocity.y);
  sprite.setFrictionAir(slippery || preserveMomentum ? 0.006 : 0.018);

  if (jumpPressed && onGround) {
    if (slippery) {
      player.slipperyJumpCount = Math.min((player.slipperyJumpCount ?? 0) + 1, 2);
      setVelocity(sprite, sprite.body.velocity.x, -(character.jump / 52) * tuning.jumpScale);
      player.slopeMomentumUntil = now + 1250;
    } else {
      player.slipperyJumpCount = 0;
      setVelocity(sprite, sprite.body.velocity.x, -(character.jump / 52) * tuning.jumpScale);
    }
  }

  if (!slippery && surface !== 'air') {
    player.slipperyJumpCount = 0;
  }

  if (sprite.body.velocity.y > 18) {
    setVelocity(sprite, sprite.body.velocity.x, 18);
  }

  player.wasRidingPlayer = ridingPlayer;
}

function setVelocity(sprite, x, y) {
  if (typeof sprite.setVelocity === 'function') {
    sprite.setVelocity(x, y);
    return;
  }

  sprite.body.setVelocity(x, y);
}
