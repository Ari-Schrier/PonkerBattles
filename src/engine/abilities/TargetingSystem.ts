/**
 * TargetingSystem
 * Handles validation and resolution of ability targeting
 */

import type { Position, Unit } from '../types';
import type {
  TargetingDefinition,
  ResolvedTarget,
  TargetValidation
} from './types';

export class TargetingSystem {
  /**
   * Calculate Manhattan distance between two positions
   */
  private static manhattanDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Calculate Chebyshev distance (8-directional, max of x/y diff)
   */
  private static chebyshevDistance(a: Position, b: Position): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  /**
   * Check if two positions are adjacent (8-directional)
   */
  private static isAdjacent(a: Position, b: Position): boolean {
    return this.chebyshevDistance(a, b) === 1;
  }

  /**
   * Check if a position is within map bounds
   */
  private static isInBounds(pos: Position, mapWidth: number, mapHeight: number): boolean {
    return pos.x >= 0 && pos.x < mapWidth && pos.y >= 0 && pos.y < mapHeight;
  }

  /**
   * Get all positions within a radius
   */
  private static getPositionsInRadius(
    center: Position,
    radius: number,
    mapWidth: number,
    mapHeight: number
  ): Position[] {
    const positions: Position[] = [];
    
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let y = center.y - radius; y <= center.y + radius; y++) {
        const pos = { x, y };
        if (
          this.isInBounds(pos, mapWidth, mapHeight) &&
          this.manhattanDistance(center, pos) <= radius
        ) {
          positions.push(pos);
        }
      }
    }
    
    return positions;
  }

  /**
   * Get all positions in a line from start to target
   */
  private static getPositionsInLine(
    start: Position,
    target: Position,
    maxLength: number
  ): Position[] {
    const positions: Position[] = [];
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    
    if (distance === 0) return [start];
    
    const steps = Math.min(distance, maxLength);
    const stepX = dx / distance;
    const stepY = dy / distance;
    
    for (let i = 0; i <= steps; i++) {
      positions.push({
        x: Math.round(start.x + stepX * i),
        y: Math.round(start.y + stepY * i)
      });
    }
    
    return positions;
  }

  /**
   * Get adjacent positions (8-directional)
   */
  private static getAdjacentPositions(
    center: Position,
    mapWidth: number,
    mapHeight: number
  ): Position[] {
    const offsets = [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 0 },                    { x: 1, y: 0 },
      { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 }
    ];
    
    return offsets
      .map(offset => ({ x: center.x + offset.x, y: center.y + offset.y }))
      .filter(pos => this.isInBounds(pos, mapWidth, mapHeight));
  }

  /**
   * Find unit at position
   */
  private static findUnitAtPosition(position: Position, units: Unit[]): Unit | undefined {
    return units.find(u => u.position.x === position.x && u.position.y === position.y);
  }

  /**
   * Filter units by team
   */
  private static filterByTeam(
    units: Unit[],
    casterTeam: string,
    includeAllies: boolean,
    includeEnemies: boolean
  ): Unit[] {
    return units.filter(u => {
      const isAlly = u.team === casterTeam;
      return (includeAllies && isAlly) || (includeEnemies && !isAlly);
    });
  }

  /**
   * Validate if a target selection is valid for the given targeting definition
   */
  static validateTarget(
    caster: Unit,
    targetPosition: Position,
    targeting: TargetingDefinition,
    units: Unit[],
    mapWidth: number,
    mapHeight: number
  ): TargetValidation {
    // Check if position is in bounds
    if (!this.isInBounds(targetPosition, mapWidth, mapHeight)) {
      return { isValid: false, reason: 'Target out of bounds' };
    }

    // Check range
    const distance = this.manhattanDistance(caster.position, targetPosition);
    if (targeting.range > 0 && distance > targeting.range) {
      return { isValid: false, reason: 'Target out of range' };
    }

    // Check minimum range
    if (targeting.minRange && distance < targeting.minRange) {
      return { isValid: false, reason: 'Target too close' };
    }

    // Check if targeting self is allowed
    if (
      caster.position.x === targetPosition.x &&
      caster.position.y === targetPosition.y &&
      !targeting.canTargetSelf
    ) {
      return { isValid: false, reason: 'Cannot target self' };
    }

    // Check tile occupancy requirements
    const unitAtTarget = this.findUnitAtPosition(targetPosition, units);
    
    if (targeting.mustTargetEmpty && unitAtTarget) {
      return { isValid: false, reason: 'Target tile must be empty' };
    }
    
    if (targeting.mustTargetOccupied && !unitAtTarget) {
      return { isValid: false, reason: 'Target tile must have a unit' };
    }

    // Check team-specific targeting
    if (unitAtTarget) {
      const isAlly = unitAtTarget.team === caster.team;
      const pattern = targeting.pattern;
      
      if (pattern === 'single_enemy' && isAlly) {
        return { isValid: false, reason: 'Must target enemy' };
      }
      
      if (pattern === 'single_ally' && !isAlly) {
        return { isValid: false, reason: 'Must target ally' };
      }
    }

    // Pattern-specific validation
    switch (targeting.pattern) {
      case 'adjacent':
      case 'adjacent_units':
      case 'adjacent_enemies':
        if (!this.isAdjacent(caster.position, targetPosition)) {
          return { isValid: false, reason: 'Target must be adjacent' };
        }
        break;

      case 'single_unit':
      case 'single_enemy':
      case 'single_ally':
        if (!unitAtTarget) {
          return { isValid: false, reason: 'Must target a unit' };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Resolve all targets based on targeting definition and selected position
   */
  static resolveTargets(
    caster: Unit,
    targetPosition: Position,
    targeting: TargetingDefinition,
    units: Unit[],
    mapWidth: number,
    mapHeight: number
  ): ResolvedTarget[] {
    const pattern = targeting.pattern;
    const targets: ResolvedTarget[] = [];

    switch (pattern) {
      case 'self':
        targets.push({
          position: caster.position,
          unit: caster
        });
        break;

      case 'single_tile':
        targets.push({
          position: targetPosition,
          unit: this.findUnitAtPosition(targetPosition, units)
        });
        break;

      case 'single_unit':
      case 'single_enemy':
      case 'single_ally': {
        const unit = this.findUnitAtPosition(targetPosition, units);
        if (unit) {
          targets.push({ position: targetPosition, unit });
        }
        break;
      }

      case 'adjacent':
      case 'adjacent_units':
      case 'adjacent_enemies': {
        const positions = this.getAdjacentPositions(caster.position, mapWidth, mapHeight);
        
        for (const pos of positions) {
          const unit = this.findUnitAtPosition(pos, units);
          
          if (pattern === 'adjacent') {
            targets.push({ position: pos, unit });
          } else if (pattern === 'adjacent_units' && unit) {
            targets.push({ position: pos, unit });
          } else if (pattern === 'adjacent_enemies' && unit && unit.team !== caster.team) {
            targets.push({ position: pos, unit });
          }
        }
        break;
      }

      case 'line': {
        const positions = this.getPositionsInLine(
          caster.position,
          targetPosition,
          targeting.range || 100
        );
        
        for (const pos of positions) {
          targets.push({
            position: pos,
            unit: this.findUnitAtPosition(pos, units)
          });
        }
        break;
      }

      case 'radius':
      case 'radius_units':
      case 'radius_enemies':
      case 'radius_allies': {
        const radius = targeting.radius || 1;
        const positions = this.getPositionsInRadius(
          targetPosition,
          radius,
          mapWidth,
          mapHeight
        );
        
        for (const pos of positions) {
          const unit = this.findUnitAtPosition(pos, units);
          
          if (pattern === 'radius') {
            targets.push({ position: pos, unit });
          } else if (pattern === 'radius_units' && unit) {
            targets.push({ position: pos, unit });
          } else if (pattern === 'radius_enemies' && unit && unit.team !== caster.team) {
            targets.push({ position: pos, unit });
          } else if (pattern === 'radius_allies' && unit && unit.team === caster.team) {
            // Only include ally if canTargetSelf or not the caster
            if (targeting.canTargetSelf || unit.id !== caster.id) {
              targets.push({ position: pos, unit });
            }
          }
        }
        break;
      }

      case 'all_enemies': {
        const enemies = this.filterByTeam(units, caster.team, false, true);
        for (const unit of enemies) {
          targets.push({ position: unit.position, unit });
        }
        break;
      }

      case 'all_allies': {
        const allies = this.filterByTeam(units, caster.team, true, false);
        for (const unit of allies) {
          // Only include if canTargetSelf or not the caster
          if (targeting.canTargetSelf || unit.id !== caster.id) {
            targets.push({ position: unit.position, unit });
          }
        }
        break;
      }

      case 'all_units': {
        for (const unit of units) {
          if (targeting.canTargetSelf || unit.id !== caster.id) {
            targets.push({ position: unit.position, unit });
          }
        }
        break;
      }

      case 'cone': {
        // Simplified cone: all tiles within radius in a 90-degree arc toward target
        const radius = targeting.radius || 3;
        const positions = this.getPositionsInRadius(
          caster.position,
          radius,
          mapWidth,
          mapHeight
        );
        
        // Calculate direction vector to target
        const dx = targetPosition.x - caster.position.x;
        const dy = targetPosition.y - caster.position.y;
        const targetAngle = Math.atan2(dy, dx);
        
        for (const pos of positions) {
          if (pos.x === caster.position.x && pos.y === caster.position.y) continue;
          
          const posAngle = Math.atan2(
            pos.y - caster.position.y,
            pos.x - caster.position.x
          );
          
          // Check if position is within 90-degree cone
          let angleDiff = Math.abs(posAngle - targetAngle);
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          
          if (angleDiff <= Math.PI / 4) { // 90-degree cone (45 degrees on each side)
            targets.push({
              position: pos,
              unit: this.findUnitAtPosition(pos, units)
            });
          }
        }
        break;
      }
    }

    return targets;
  }

  /**
   * Get all valid target positions for an ability (for UI highlighting)
   */
  static getValidTargetPositions(
    caster: Unit,
    targeting: TargetingDefinition,
    units: Unit[],
    mapWidth: number,
    mapHeight: number
  ): Position[] {
    const validPositions: Position[] = [];
    
    // For self-targeting, only return caster position
    if (targeting.pattern === 'self') {
      return [caster.position];
    }
    
    // For area patterns that don't require specific targeting, return all in range
    if (
      targeting.pattern === 'all_enemies' ||
      targeting.pattern === 'all_allies' ||
      targeting.pattern === 'all_units'
    ) {
      return [caster.position]; // Just highlight caster to show it's usable
    }
    
    // For adjacent patterns
    if (
      targeting.pattern === 'adjacent' ||
      targeting.pattern === 'adjacent_units' ||
      targeting.pattern === 'adjacent_enemies'
    ) {
      return this.getAdjacentPositions(caster.position, mapWidth, mapHeight)
        .filter(pos => {
          const validation = this.validateTarget(
            caster,
            pos,
            targeting,
            units,
            mapWidth,
            mapHeight
          );
          return validation.isValid;
        });
    }
    
    // For other patterns, check all positions within range
    const maxRange = targeting.range || 10;
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        const pos = { x, y };
        const validation = this.validateTarget(
          caster,
          pos,
          targeting,
          units,
          mapWidth,
          mapHeight
        );
        
        if (validation.isValid && this.manhattanDistance(caster.position, pos) <= maxRange) {
          validPositions.push(pos);
        }
      }
    }
    
    return validPositions;
  }
}