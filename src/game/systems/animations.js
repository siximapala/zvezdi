import { CHARACTERS } from '../config/characters.js';

export function registerCharacterAnimations(scene) {
  for (const character of CHARACTERS) {
    const idleKey = `${character.id}:idle`;
    const runKey = `${character.id}:run`;
    const deathKey = `${character.id}:death`;
    const idleTextureKey = `${character.id}-static`;

    if (scene.anims.exists(idleKey)) {
      continue;
    }

    scene.anims.create({
      key: idleKey,
      frames: scene.anims.generateFrameNumbers(idleTextureKey, { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    scene.anims.create({
      key: runKey,
      frames: scene.anims.generateFrameNumbers(character.textureKey, { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1
    });

    scene.anims.create({
      key: deathKey,
      frames: scene.anims.generateFrameNumbers(`${character.id}-death`, { start: 0, end: 3 }),
      frameRate: 12,
      repeat: 0
    });
  }

  if (!scene.anims.exists('green:leaves')) {
    scene.anims.create({
      key: 'green:leaves',
      frames: scene.anims.generateFrameNumbers('green-leaves', { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1
    });
  }
}

export function playCharacterAnimation(sprite, character, state) {
  const key = `${character.id}:${state}`;

  if (sprite.scene.anims.exists(key)) {
    sprite.anims.play(key, true);
  }
}

/*
  Future spritesheet hook:

  1. Put exported .png spritesheets in assets/sprites.
  2. Load them in BootScene.preload with this.load.spritesheet(...).
  3. Build the animation from frame ranges:

     scene.anims.create({
       key: 'pink:run',
       frames: scene.anims.generateFrameNumbers('pink-run', { start: 0, end: 7 }),
       frameRate: 10,
       repeat: -1
     });

  GameplayScene only calls playCharacterAnimation, so character art can change
  without rewriting movement, material rules, or level logic.
*/
