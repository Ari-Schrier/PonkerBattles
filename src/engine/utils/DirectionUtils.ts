/**
 * DirectionUtils
 * Pure utility functions for calculating sprite directions from positions
 * No Phaser dependencies - can run in Node.js
 */

import { Direction, type Position } from '../types';

export class DirectionUtils {
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
}