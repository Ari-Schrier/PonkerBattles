/**
 * Main entry point
 * Initializes Phaser game instance and registers scenes
 */

import Phaser from 'phaser';
import { PreloadScene } from '@scenes/PreloadScene';
import { BattleScene } from '@scenes/BattleScene';
import { ResultsScene } from '@scenes/ResultsScene';
import { GameConfig } from '@config/gameConfig';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GameConfig.MAP_WIDTH * GameConfig.TILE_SIZE,
  height: GameConfig.MAP_HEIGHT * GameConfig.TILE_SIZE,
  parent: 'game-container',
  backgroundColor: '#1a1a1a',
  scene: [PreloadScene, BattleScene, ResultsScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
};

new Phaser.Game(config);