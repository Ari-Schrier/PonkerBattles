import { GameConfig } from '@config/gameConfig';
import type { Unit, GameState } from '@engine/types';
import type { ResolvedTarget, TriggerType, AbilityDefinition } from '@engine/abilities';
import { EffectResolver } from '@engine/abilities';
import type { UnitController } from './UnitController';
import type { AbilityController } from './AbilityController';
import type { ActionQueue } from './ActionQueue';

export class StatusEffectController {
  private unitController: UnitController;
  private abilityController: AbilityController;
  private actionQueue: ActionQueue;
  private readonly statusIndicatorKey = 'poisoned-indicator';
  private lastProcessedRound = 0;

  constructor(
    unitController: UnitController,
    abilityController: AbilityController,
    actionQueue: ActionQueue
  ) {
    this.unitController = unitController;
    this.abilityController = abilityController;
    this.actionQueue = actionQueue;

    this.abilityController.getStatusManager().onStatusChanged((unit) => {
      this.refreshStatusIndicators([{ position: unit.position, unit }]);
    });
  }

  processRoundEffects(gameState: GameState): void {
    if (gameState.currentPhase !== GameConfig.PHASES.PLAYER_ACTIVATION) {
      return;
    }

    if (this.actionQueue.isRunning) {
      return;
    }

    if (gameState.currentRound === this.lastProcessedRound) {
      return;
    }

    this.lastProcessedRound = gameState.currentRound;

    const activeUnits = gameState.units.filter(unit => unit.stats.hp > 0);
    if (activeUnits.length === 0) {
      return;
    }

    activeUnits.forEach(unit => {
      this.applyTriggeredStatusEffects(unit, 'on_round_start', gameState.units);
    });

    this.refreshStatusIndicators(
      gameState.units.map(unit => ({ position: unit.position, unit }))
    );
  }

  processTurnEnd(unit: Unit, units: Unit[]): void {
    const statusManager = this.abilityController.getStatusManager();
    this.applyTriggeredStatusEffects(unit, 'on_turn_end', units);
    statusManager.tickStatuses(unit);
    this.refreshStatusIndicators([{ position: unit.position, unit }]);
  }

  private applyTriggeredStatusEffects(unit: Unit, triggerType: TriggerType, units: Unit[]): void {
    const statusManager = this.abilityController.getStatusManager();
    const triggered = statusManager.getTriggeredEffects(unit, triggerType);
    if (triggered.length === 0) {
      return;
    }

    const targets: ResolvedTarget[] = [{ position: unit.position, unit }];

    triggered.forEach(triggeredStatus => {
      for (let i = 0; i < triggeredStatus.stacks; i++) {
        triggeredStatus.effects.forEach(effect => {
          EffectResolver.applyEffect(effect, unit, targets, units, statusManager);
        });
      }

      const definition = statusManager.getDefinition(triggeredStatus.statusId);
      definition?.animationSteps?.forEach(step => {
        if (step.type === 'effect_visual') {
          this.actionQueue.enqueue(() => this.abilityController['playEffectVisual'](step, {
            id: 'status',
            name: 'status',
            description: '',
            trigger: { type: triggerType },
            cost: { type: 'free' },
            targeting: { pattern: 'self', range: 0 },
            effects: []
          } as AbilityDefinition, unit.position));
        }
      });
    });

    this.unitController.updateHealthText(unit);
    if (unit.stats.hp <= 0) {
      this.abilityController.playDeathAnimation(unit);
    }

    this.refreshStatusIndicators(targets);
  }

  private refreshStatusIndicators(targets: ResolvedTarget[]): void {
    const statusManager = this.abilityController.getStatusManager();
    targets
      .map(target => target.unit)
      .filter((unit): unit is Unit => Boolean(unit))
      .forEach(unit => {
        const hasPoison = statusManager.hasStatus(unit, 'poison') && unit.stats.hp > 0;
        this.unitController.setStatusIndicator(unit.id, hasPoison ? this.statusIndicatorKey : null);
      });
  }
}