import Phaser from 'phaser';
import type { GameState, Unit } from '@engine/types';
import { ObjectiveController } from '@engine/ObjectiveController';
import type { TurnManager } from '@engine/TurnManager';
import type { UnitController } from './UnitController';
import type { StatusEffectController } from './StatusEffectController';

export class GameFlowController {
  private scene: Phaser.Scene;
  private unitController: UnitController;
  private statusEffectController: StatusEffectController;
  private turnManager: TurnManager;

  constructor(
    scene: Phaser.Scene,
    unitController: UnitController,
    statusEffectController: StatusEffectController,
    turnManager: TurnManager
  ) {
    this.scene = scene;
    this.unitController = unitController;
    this.statusEffectController = statusEffectController;
    this.turnManager = turnManager;
  }

  completeUnitActivation(unit: Unit, gameState: GameState): void {
    this.statusEffectController.processTurnEnd(unit, gameState.units);
    this.unitController.setUnitDimmed(unit, true);

    const { roundEnded, gameEnded } = this.turnManager.completeUnitActivation(unit);

    if (roundEnded) {
      this.unitController.resetActivationVisuals(gameState.units);
    }

    if (gameEnded) {
      this.endGame(gameState);
    }
  }

  private endGame(gameState: GameState): void {
    gameState.winner = ObjectiveController.determineWinner(gameState.objectives);
    this.scene.scene.start('ResultsScene', { winner: gameState.winner });
  }
}