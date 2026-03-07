/**
 * MovementEngine
 * Calculates legal movement ranges and pathfinding
 */

import type { Position, Unit } from './types';

export class MovementEngine {
  /**
   * Calculate Manhattan distance between two positions
   */
  static getDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Get all tiles within movement range (using flood fill)
   */
  static getLegalMoves(
    unit: Unit,
    occupiedPositions: Map<string, boolean>,
    mapWidth: number,
    mapHeight: number,
    options?: {
      isWalkable?: (pos: Position) => boolean;
      getMoveCost?: (pos: Position) => number;
    }
  ): Position[] {
    const legalMoves: Position[] = [];
    const visited = new Map<string, number>();
    const queue: { pos: Position; remainingMoves: number }[] = [];

    const isWalkable = options?.isWalkable ?? (() => true);
    const getMoveCost = options?.getMoveCost ?? (() => 1);

    const startKey = `${unit.position.x},${unit.position.y}`;
    queue.push({ pos: unit.position, remainingMoves: unit.stats.movementRange });
    visited.set(startKey, unit.stats.movementRange);

    const legalMoveKeys = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Add neighbors
      const neighbors = [
        { x: current.pos.x + 1, y: current.pos.y },
        { x: current.pos.x - 1, y: current.pos.y },
        { x: current.pos.x, y: current.pos.y + 1 },
        { x: current.pos.x, y: current.pos.y - 1 }
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;

        // Skip if out of bounds
        if (neighbor.x < 0 || neighbor.x >= mapWidth || neighbor.y < 0 || neighbor.y >= mapHeight) {
          continue;
        }

        // Skip if not walkable
        if (!isWalkable(neighbor)) continue;

        // Skip if occupied (can't move through units)
        if (occupiedPositions.has(key)) continue;

        const moveCost = Math.max(1, getMoveCost(neighbor));
        const remainingAfterMove = current.remainingMoves - moveCost;

        if (remainingAfterMove < 0) {
          continue;
        }

        // Skip the starting tile
        if (key === startKey) {
          continue;
        }

        // Add to legal moves once
        if (!legalMoveKeys.has(key)) {
          legalMoveKeys.add(key);
          legalMoves.push(neighbor);
        }

        // Only explore further if we have remaining moves and this path is better
        if (remainingAfterMove > 0) {
          const bestRemaining = visited.get(key);
          if (bestRemaining === undefined || remainingAfterMove > bestRemaining) {
            visited.set(key, remainingAfterMove);
            queue.push({ pos: neighbor, remainingMoves: remainingAfterMove });
          }
        }
      }
    }

    return legalMoves;
  }

  /**
   * Check if two positions are adjacent (for melee attacks)
   */
  static isAdjacent(pos1: Position, pos2: Position): boolean {
    return this.getDistance(pos1, pos2) === 1;
  }

  /**
   * Get all adjacent positions
   */
  static getAdjacentPositions(pos: Position): Position[] {
    return [
      { x: pos.x + 1, y: pos.y },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x, y: pos.y - 1 }
    ];
  }
}