/**
 * ObjectiveController
 * Manages objective control checks and scoring
 */

import { GameConfig, type Team } from '@config/gameConfig';
import type { Objective, Unit, Position } from './types';
import { MovementEngine } from './MovementEngine';

export class ObjectiveController {
  /**
   * Check if a position is within control radius of an objective
   */
  static isWithinControlRadius(unitPos: Position, objectivePos: Position): boolean {
    const distance = MovementEngine.getDistance(unitPos, objectivePos);
    return distance <= GameConfig.OBJECTIVE_CONTROL_RADIUS;
  }

  /**
   * Determine which team controls an objective (if any)
   * Control requires majority of units within radius
   * - If no units are in range, retain previous control
   * - If tied, control becomes neutral
   */
  static determineControl(objective: Objective, units: Unit[]): Team | null {
    const unitsInRange = units.filter(unit => 
      unit.stats.hp > 0 && 
      this.isWithinControlRadius(unit.position, objective.position)
    );

    if (unitsInRange.length === 0) {
      return objective.controlledBy;
    }

    // Count units by team
    const teamCounts = new Map<Team, number>();
    unitsInRange.forEach(unit => {
      teamCounts.set(unit.team, (teamCounts.get(unit.team) || 0) + 1);
    });

    // Find team with majority
    let controllingTeam: Team | null = null;
    let maxCount = 0;
    let tie = false;

    teamCounts.forEach((count, team) => {
      if (count > maxCount) {
        maxCount = count;
        controllingTeam = team;
        tie = false;
      } else if (count === maxCount) {
        tie = true;
      }
    });

    // No control if tied
    return tie ? null : controllingTeam;
  }

  /**
   * Update control status for all objectives
   */
  static updateObjectiveControl(objectives: Objective[], units: Unit[]): void {
    objectives.forEach(objective => {
      objective.controlledBy = this.determineControl(objective, units);
    });
  }

  /**
   * Count objectives controlled by each team
   */
  static getObjectiveScores(objectives: Objective[]): Map<Team, number> {
    const scores = new Map<Team, number>();
    scores.set(GameConfig.TEAMS.BLUE, 0);
    scores.set(GameConfig.TEAMS.RED, 0);

    objectives.forEach(objective => {
      if (objective.controlledBy) {
        scores.set(objective.controlledBy, (scores.get(objective.controlledBy) || 0) + 1);
      }
    });

    return scores;
  }

  /**
   * Determine winner based on objective control
   */
  static determineWinner(objectives: Objective[]): Team | null {
    const scores = this.getObjectiveScores(objectives);
    const blueScore = scores.get(GameConfig.TEAMS.BLUE) || 0;
    const redScore = scores.get(GameConfig.TEAMS.RED) || 0;

    if (blueScore > redScore) {
      return GameConfig.TEAMS.BLUE;
    } else if (redScore > blueScore) {
      return GameConfig.TEAMS.RED;
    }
    
    return null; // Tie
  }
}