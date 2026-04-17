import { LEVEL_THREE } from '../config/level-three.js';
import { LevelOneScene } from './LevelOneScene.js';

export class LevelThreeScene extends LevelOneScene {
  constructor() {
    super('LevelThreeScene', LEVEL_THREE);
  }
}
