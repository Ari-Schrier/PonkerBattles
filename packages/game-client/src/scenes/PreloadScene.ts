/**
 * PreloadScene
 * Loads all game assets before starting the battle
 */

import Phaser from 'phaser';
import { AnimationHelper } from './utils/AnimationHelper';
import { GameConfig } from '@battlegame/game-core';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '20px',
      color: '#ffffff'
    });
    loadingText.setOrigin(0.5, 0.5);

    // Update progress bar
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load tileset
    this.load.image('world-tileset', 'assets/tilesets/world.png');

    // Load character spritesheets (32x32 frames)
    this.load.spritesheet('hunter-blue', 'assets/character spritesheets/Hunter-Blue.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('hunter-red', 'assets/character spritesheets/Hunter-Red.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('soldier-blue', 'assets/character spritesheets/Soldier-Iron-Blue.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('soldier-red', 'assets/character spritesheets/Soldier-Iron-Red.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('thief-blue', 'assets/character spritesheets/Thief-Blue.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('thief-red', 'assets/character spritesheets/Thief-Red.png', {
      frameWidth: 32,
      frameHeight: 32
    });

    // Load ability effect spritesheets (16x16 frames)
    this.load.spritesheet(
      'fireball-projectile',
      'assets/ability spritesheets/projectiles/Fireball-Anim(Projectile).png',
      {
        frameWidth: 16,
        frameHeight: 16
      }
    );
    this.load.spritesheet(
      'poison-slash-overlay',
      'assets/ability spritesheets/damaged overlay/Poison-Slash-Anim.png',
      {
        frameWidth: 16,
        frameHeight: 16
      }
    );
    this.load.spritesheet(
      'fire-explosion',
      'assets/ability spritesheets/damaged overlay/Fire-Explosion-Anim.png',
      {
        frameWidth: 16,
        frameHeight: 16
      }
    );
    this.load.spritesheet(
      'take-fire-damage',
      'assets/ability spritesheets/damaged overlay/Take-Fire-Damage-Anim.png',
      {
        frameWidth: 16,
        frameHeight: 16
      }
    );
    this.load.spritesheet(
      'green-poison-bubbles',
      'assets/ability spritesheets/damaged overlay/Green-Poison-Bubbles-Anim.png',
      {
        frameWidth: 16,
        frameHeight: 16
      }
    );
    this.load.image('poisoned-indicator', 'assets/status indicators/Poisoned-Indicator.png');

    // Load map data
    this.load.tilemapTiledJSON('basicMap', new URL('../data/maps/BasicMap.tmj', import.meta.url).href);
    this.load.json('tileDefs', new URL('../data/maps/tileDefs.basicmap.stub.json', import.meta.url).href);

    // Load unit data
    this.load.json('blueTeam', new URL('../data/units/blueTeam.json', import.meta.url).href);
    this.load.json('redTeam', new URL('../data/units/redTeam.json', import.meta.url).href);

    // Load ability and status data
    this.load.json('abilities', new URL('../data/abilities.json', import.meta.url).href);
    this.load.json('statuses', new URL('../data/statuses.json', import.meta.url).href);
  }

  create(): void {
    // Create animations for all character spritesheets
    const spriteKeys = [
      'hunter-blue',
      'hunter-red',
      'soldier-blue',
      'soldier-red',
      'thief-blue',
      'thief-red'
    ];

    const frameRates = {
      walk: GameConfig.ANIMATION_FRAME_RATES.WALK,
      attack: GameConfig.ANIMATION_FRAME_RATES.ATTACK,
      damage: GameConfig.ANIMATION_FRAME_RATES.DAMAGE,
      death: GameConfig.ANIMATION_FRAME_RATES.DEATH,
      idle: GameConfig.ANIMATION_FRAME_RATES.IDLE
    };

    spriteKeys.forEach(key => {
      AnimationHelper.createAnimationsForSprite(this, key, frameRates);
    });

    // Transition to battle scene
    this.scene.start('BattleScene');
  }
}