import { CHARACTERS } from '../config/characters.js';

export function registerCharacterAnimations(scene) {
  for (const character of CHARACTERS) {
    const idleKey = `${character.id}:idle`;

    if (scene.anims.exists(idleKey)) {
      continue;
    }

    scene.anims.create({
      key: idleKey,
      frames: [{ key: character.textureKey }],
      frameRate: 1,
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

  1. Put exported spritesheets in assets/sprites.
  2. Load them in BootScene.preload with this.load.spritesheet(...).
  3. Replace the single-frame animation above with generated frame ranges:

     scene.anims.create({
       key: 'pink:run',
       frames: scene.anims.generateFrameNumbers('pink-run-sheet', { start: 0, end: 7 }),
       frameRate: 10,
       repeat: -1
     });

  LevelOneScene only calls playCharacterAnimation, so character art can change
  without rewriting movement, material rules, or level logic.
*/
