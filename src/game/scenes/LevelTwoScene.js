import { LEVEL_TWO } from '../config/level-two.js';
import { LevelOneScene } from './LevelOneScene.js';

export class LevelTwoScene extends LevelOneScene {
  constructor() {
    super('LevelTwoScene', LEVEL_TWO);
  }
}
