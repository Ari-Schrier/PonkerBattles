/**
 * AnimationManager
 * Handles character animation creation and direction management
 */

import Phaser from 'phaser';
import { Direction, type Position } from './types';

export class AnimationManager {
  /**
   * Calculate the direction (0-7) from one position to another
   * 0=down, 1=down-right, 2=right, 3=up-right, 4=up, 5=up-left, 6=left, 7=down-left
   */
  static getDirection(from: Position, to: Position): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // Handle same position
    if (dx === 0 && dy === 0) {
      return Direction.Down; // Default to down
    }

    // Calculate angle in radians
    const angle = Math.atan2(dy, dx);
    
    // Convert to degrees and normalize to 0-360
    let degrees = (angle * 180 / Math.PI + 360) % 360;
    
    // Map to 8 directions
    // 0° (right) -> direction 2
    // 45° (down-right) -> direction 1
    // 90° (down) -> direction 0
    // 135° (down-left) -> direction 7
    // 180° (left) -> direction 6
    // 225° (up-left) -> direction 5
    // 270° (up) -> direction 4
    // 315° (up-right) -> direction 3
    
    const directionMap = [
      { min: 337.5, max: 360, dir: Direction.Right },   // right
      { min: 0, max: 22.5, dir: Direction.Right },      // right
      { min: 22.5, max: 67.5, dir: Direction.DownRight },   // down-right
      { min: 67.5, max: 112.5, dir: Direction.Down },  // down
      { min: 112.5, max: 157.5, dir: Direction.DownLeft }, // down-left
      { min: 157.5, max: 202.5, dir: Direction.Left }, // left
      { min: 202.5, max: 247.5, dir: Direction.UpLeft }, // up-left
      { min: 247.5, max: 292.5, dir: Direction.Up }, // up
      { min: 292.5, max: 337.5, dir: Direction.UpRight }  // up-right
    ];
    
    for (const range of directionMap) {
      if (degrees >= range.min && degrees < range.max) {
        return range.dir;
      }
    }
    
    return Direction.Down; // Fallback to down
  }

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