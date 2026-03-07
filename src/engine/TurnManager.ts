/**
 * TurnManager
 * Manages game phases, turn order, and round progression
 */

import { GameConfig, type Team, type Phase } from '@config/gameConfig';
import type { GameState, Unit } from './types';

export class TurnManager {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Initialize game state for a new match
   */
  startGame(): void {
    this.gameState.currentRound = 1;
    this.gameState.currentPhase = GameConfig.PHASES.PLAYER_ACTIVATION;
    this.gameState.activeTeam = GameConfig.TEAMS.BLUE;
    this.resetActivations();
  }

  /**
   * Reset activation flags for all units
   */
  private resetActivations(): void {
    this.gameState.units.forEach(unit => {
      unit.hasActivated = false;
      unit.hasUsedMovement = false;
      unit.hasUsedMainAction = false;
    });
  }

  /**
   * Mark a unit as activated
   */
  activateUnit(unit: Unit): void {
    unit.hasActivated = true;
  }

  /**
   * Get units that can still activate this round
   */
  getUnactivatedUnits(team: Team): Unit[] {
    return this.gameState.units.filter(
      unit => unit.team === team && !unit.hasActivated && unit.stats.hp > 0
    );
  }

  /**
   * Check if all units of a team have activated
   */
  hasTeamFinishedActivations(team: Team): boolean {
    const unactivated = this.getUnactivatedUnits(team);
    return unactivated.length === 0;
  }

  /**
   * Check if both teams have finished activations this round
   */
  isRoundComplete(): boolean {
    return (
      this.hasTeamFinishedActivations(GameConfig.TEAMS.BLUE) &&
      this.hasTeamFinishedActivations(GameConfig.TEAMS.RED)
    );
  }

  /**
   * Advance to next team's activation phase
   */
  nextTeam(): void {
    if (this.isRoundComplete()) {
      this.endRound();
      return;
    }

    const blueRemaining = !this.hasTeamFinishedActivations(GameConfig.TEAMS.BLUE);
    const redRemaining = !this.hasTeamFinishedActivations(GameConfig.TEAMS.RED);

    if (this.gameState.activeTeam === GameConfig.TEAMS.BLUE) {
      if (redRemaining) {
        this.gameState.activeTeam = GameConfig.TEAMS.RED;
      }
    } else {
      if (blueRemaining) {
        this.gameState.activeTeam = GameConfig.TEAMS.BLUE;
      }
    }
  }

  /**
   * End current round and start next (or end game)
   */
  private endRound(): void {
    this.gameState.currentPhase = GameConfig.PHASES.ROUND_END;
    
    // Check if game should end
    if (this.gameState.currentRound >= GameConfig.MAX_ROUNDS) {
      this.endGame();
    } else {
      this.startNextRound();
    }
  }

  /**
   * Start the next round
   */
  private startNextRound(): void {
    this.gameState.currentRound++;
    this.gameState.activeTeam = GameConfig.TEAMS.BLUE;
    this.resetActivations();
    this.gameState.currentPhase = GameConfig.PHASES.PLAYER_ACTIVATION;
  }

  /**
   * End the game
   */
  private endGame(): void {
    this.gameState.currentPhase = GameConfig.PHASES.GAME_END;
  }

  /**
   * Check if game is over
   */
  isGameOver(): boolean {
    return this.gameState.currentPhase === GameConfig.PHASES.GAME_END;
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.gameState;
  }
}