import Phaser from 'phaser';
import { GameConfig } from '@battlegame/game-core';
import type { GameState, Position, Unit } from '@battlegame/game-core';
import { MovementEngine } from '@battlegame/game-core';
import type { AbilityDefinition } from '@battlegame/game-core';
import type { UnitController } from './UnitController';
import type { MovementController } from './MovementController';
import type { CombatController } from './CombatController';
import type { AbilityController } from './AbilityController';
import type { ActionMenuController } from './ActionMenuController';
import type { GameFlowController } from './GameFlowController';

type UpdateUICallback = (selectedUnit: Unit | null) => void;

export class InputController {
  private unitController: UnitController;
  private movementController: MovementController;
  private combatController: CombatController;
  private abilityController: AbilityController;
  private actionMenuController: ActionMenuController;
  private gameFlowController: GameFlowController;
  private selectedUnit: Unit | null = null;
  private updateUI: UpdateUICallback;

  constructor(
    unitController: UnitController,
    movementController: MovementController,
    combatController: CombatController,
    abilityController: AbilityController,
    actionMenuController: ActionMenuController,
    gameFlowController: GameFlowController,
    updateUI: UpdateUICallback
  ) {
    this.unitController = unitController;
    this.movementController = movementController;
    this.combatController = combatController;
    this.abilityController = abilityController;
    this.actionMenuController = actionMenuController;
    this.gameFlowController = gameFlowController;
    this.updateUI = updateUI;
  }

  getSelectedUnit(): Unit | null {
    return this.selectedUnit;
  }

  handlePointerDown(pointer: Phaser.Input.Pointer, gameState: GameState): void {
    const tileX = Math.floor(pointer.worldX / GameConfig.TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / GameConfig.TILE_SIZE);

    if (this.actionMenuController.isClickInMenu(pointer.worldX, pointer.worldY)) {
      return;
    }

    const clickedUnit = this.unitController.getUnitAtPosition(gameState.units, { x: tileX, y: tileY });
    const selectedAbility = this.abilityController.getSelectedAbility();

    if (this.selectedUnit && selectedAbility) {
      if (clickedUnit && clickedUnit === this.selectedUnit) {
        this.abilityController.clearAbilitySelection();
        this.movementController.showMovementRange(this.selectedUnit, gameState.units);
        this.showActionMenu(this.selectedUnit, gameState);
        this.updateUI(this.selectedUnit);
        return;
      }

      this.attemptAbility(this.selectedUnit, selectedAbility, { x: tileX, y: tileY }, gameState);
      return;
    }

    if (this.selectedUnit) {
      if (clickedUnit && clickedUnit === this.selectedUnit) {
        if (this.selectedUnit.hasUsedMovement || this.selectedUnit.hasUsedMainAction) {
          this.endUnitActivation(this.selectedUnit, gameState);
        } else {
          this.deselectUnit();
        }
      } else if (clickedUnit && clickedUnit.team !== this.selectedUnit.team) {
        if (this.movementController.canUnitAttack(this.selectedUnit)) {
          this.attemptAttack(this.selectedUnit, clickedUnit, gameState);
        }
      } else {
        if (this.movementController.canUnitMove(this.selectedUnit)) {
          this.attemptMove(this.selectedUnit, { x: tileX, y: tileY }, gameState);
        }
      }
    } else {
      if (clickedUnit && this.canUnitSelect(clickedUnit, gameState)) {
        this.selectUnit(clickedUnit, gameState);
      }
    }
  }

  private canUnitSelect(unit: Unit, gameState: GameState): boolean {
    return unit.team === gameState.activeTeam && !unit.hasActivated && unit.stats.hp > 0;
  }

  private selectUnit(unit: Unit, gameState: GameState): void {
    this.selectedUnit = unit;
    this.movementController.showMovementRange(unit, gameState.units);
    this.showActionMenu(unit, gameState);
    this.updateUI(this.selectedUnit);
  }

  private deselectUnit(): void {
    this.selectedUnit = null;
    this.movementController.clearHighlights();
    this.abilityController.clearAbilitySelection();
    this.actionMenuController.clear();
    this.updateUI(this.selectedUnit);
  }

  private attemptMove(unit: Unit, targetPos: Position, gameState: GameState): void {
    this.movementController.attemptMove(
      unit,
      targetPos,
      gameState.units,
      (movedUnit, wasDash) => {
        if (wasDash) {
          movedUnit.hasUsedMainAction = true;
        } else {
          movedUnit.hasUsedMovement = true;
        }

        if (this.isUnitTurnComplete(movedUnit)) {
          this.endUnitActivation(movedUnit, gameState);
        } else {
          this.movementController.showMovementRange(movedUnit, gameState.units);
          this.showActionMenu(movedUnit, gameState);
          this.updateUI(this.selectedUnit);
        }
      },
      interruptedUnit => {
        this.endUnitActivation(interruptedUnit, gameState);
      }
    );
  }

  private attemptAttack(attacker: Unit, defender: Unit, gameState: GameState): void {
    if (!this.movementController.canUnitAttack(attacker)) {
      return;
    }

    if (MovementEngine.isAdjacent(attacker.position, defender.position)) {
      this.movementController.clearHighlights();
      this.combatController.attemptAttack(attacker, defender, completedAttacker => {
        completedAttacker.hasUsedMainAction = true;

        if (this.isUnitTurnComplete(completedAttacker)) {
          this.endUnitActivation(completedAttacker, gameState);
        } else {
          this.movementController.showMovementRange(completedAttacker, gameState.units);
          this.showActionMenu(completedAttacker, gameState);
          this.updateUI(this.selectedUnit);
        }
      });
    }
  }

  private attemptAbility(
    unit: Unit,
    ability: AbilityDefinition,
    targetPos: Position,
    gameState: GameState
  ): void {
    const success = this.abilityController.attemptAbility(
      unit,
      ability,
      targetPos,
      gameState.units,
      () => {
        if (this.isUnitTurnComplete(unit)) {
          this.endUnitActivation(unit, gameState);
        } else {
          this.movementController.showMovementRange(unit, gameState.units);
          this.showActionMenu(unit, gameState);
          this.updateUI(this.selectedUnit);
        }
      }
    );

    if (!success) {
      return;
    }
  }

  private isUnitTurnComplete(unit: Unit): boolean {
    return unit.hasUsedMovement && unit.hasUsedMainAction;
  }

  private endUnitActivation(unit: Unit, gameState: GameState): void {
    this.gameFlowController.completeUnitActivation(unit, gameState);
    this.deselectUnit();
    this.updateUI(this.selectedUnit);
  }

  private showActionMenu(unit: Unit, gameState: GameState): void {
    const abilityDefinitions = this.abilityController.getAbilityDefinitions();

    const abilities = (unit.abilities || [])
      .map(active => abilityDefinitions.get(active.definitionId))
      .filter((ability): ability is AbilityDefinition => Boolean(ability))
      .filter(ability => ability.trigger.type === 'activated');

    this.actionMenuController.show(
      unit,
      abilities,
      (ability) => this.abilityController.isAbilityDisabled(unit, ability),
      (ability) => this.selectAbility(unit, ability, gameState)
    );
  }

  private selectAbility(unit: Unit, ability: AbilityDefinition, gameState: GameState): void {
    this.abilityController.selectAbility(unit, ability);
    this.actionMenuController.clear();
    this.movementController.clearHighlights();
    this.abilityController.updateTargetHighlights(unit, ability, gameState.units);
    this.updateUI(this.selectedUnit);
  }
}