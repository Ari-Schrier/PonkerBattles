/**
 * AnimationHelper
 * Phaser-specific animation creation and playback utilities
 * This file contains Phaser dependencies and should only be used in scenes/controllers
 */

import Phaser from 'phaser';
import { Direction } from '@battlegame/game-core';

export class AnimationHelper {
  /**
   * Create all animations for a single spritesheet
   */
  static createAnimationsForSprite(
    scene: Phaser.Scene,
    spriteKey: string,
    frameRates: {
      walk: number;
      attack: number;
      damage: number;
      death: number;
      idle: number;
    }
  ): void {
    const anims = scene.anims;

    // Create walking animations for all 8 directions (frames 0-3 per direction)
    for (let direction = 0; direction < 8; direction++) {
      const frames = [];
      for (let frame = 0; frame < 4; frame++) {
        frames.push({ key: spriteKey, frame: direction * 29 + frame });
      }
      
      anims.create({
        key: `${spriteKey}-walk-${direction}`,
        frames: frames,
        frameRate: frameRates.walk,
        repeat: -1 // Loop
      });
    }

    // Create melee attack animations for all 8 directions (frames 4-7 per direction)
    for (let direction = 0; direction < 8; direction++) {
      const frames = [];
      for (let frame = 4; frame < 8; frame++) {
        frames.push({ key: spriteKey, frame: direction * 29 + frame });
      }
      
      anims.create({
        key: `${spriteKey}-attack-${direction}`,
        frames: frames,
        frameRate: frameRates.attack,
        repeat: 0 // Play once
      });
    }

    // Create damage animations for all 8 directions (frames 18-20 per direction)
    for (let direction = 0; direction < 8; direction++) {
      const frames = [];
      for (let frame = 18; frame <= 20; frame++) {
        frames.push({ key: spriteKey, frame: direction * 29 + frame });
      }
      
      anims.create({
        key: `${spriteKey}-damage-${direction}`,
        frames: frames,
        frameRate: frameRates.damage,
        repeat: 0 // Play once
      });
    }

    // Create death animations for all 8 directions (frames 21-23 per direction, ending at 24)
    for (let direction = 0; direction < 8; direction++) {
      const frames = [];
      for (let frame = 21; frame <= 24; frame++) {
        frames.push({ key: spriteKey, frame: direction * 29 + frame });
      }
      
      anims.create({
        key: `${spriteKey}-death-${direction}`,
        frames: frames,
        frameRate: frameRates.death,
        repeat: 0 // Play once
      });
    }

    // Create idle animation for each direction (just frame 0 of each row)
    for (let direction = 0; direction < 8; direction++) {
      anims.create({
        key: `${spriteKey}-idle-${direction}`,
        frames: [{ key: spriteKey, frame: direction * 29 }],
        frameRate: frameRates.idle,
        repeat: 0
      });
    }
  }

  /**
   * Play an animation on a sprite with a direction
   */
  static playAnimation(
    sprite: Phaser.GameObjects.Sprite,
    spriteKey: string,
    animationType: 'walk' | 'attack' | 'damage' | 'death' | 'idle' | 'cast' | 'shoot',
    direction: Direction
  ): void {
    const resolvedType = animationType === 'cast' || animationType === 'shoot' ? 'attack' : animationType;
    const animKey = `${spriteKey}-${resolvedType}-${direction}`;
    sprite.play(animKey);
  }

  /**
   * Stop animation and show idle frame for direction
   */
  static stopAnimation(
    sprite: Phaser.GameObjects.Sprite,
    _spriteKey: string,
    direction: Direction
  ): void {
    sprite.stop();
    sprite.setFrame(direction * 29); // Set to first frame of direction row
  }
}