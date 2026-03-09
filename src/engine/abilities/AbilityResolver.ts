/**
 * AbilityResolver
 * Orchestrates ability execution: targeting, effects, and animation sequencing
 */

import type { Unit, Position } from '../types';
import type {
  AbilityDefinition,
  AbilityResult,
  ResolvedTarget,
  EffectResult
} from './types';
import { TargetingSystem } from './TargetingSystem';
import { EffectResolver } from './EffectResolver';
import { StatusManager } from './StatusManager';

export class AbilityResolver {
  private statusManager: StatusManager;

  constructor(statusManager: StatusManager) {
    this.statusManager = statusManager;
  }

  /**
   * Execute a player-activated ability
   */
  executeActivatedAbility(
    ability: AbilityDefinition,
    caster: Unit,
    targetPosition: Position,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult {
    // Validate targeting
    const validation = TargetingSystem.validateTarget(
      caster,
      targetPosition,
      ability.targeting,
      allUnits,
      mapWidth,
      mapHeight
    );

    if (!validation.isValid) {
      return {
        success: false,
        effectResults: [],
        animationSequence: []
      };
    }

    // Resolve targets
    const targets = TargetingSystem.resolveTargets(
      caster,
      targetPosition,
      ability.targeting,
      allUnits,
      mapWidth,
      mapHeight
    );

    // Execute ability
    return this.executeAbility(ability, caster, targets, allUnits);
  }

  /**
   * Execute a triggered ability (automatic activation)
   */
  executeTriggeredAbility(
    ability: AbilityDefinition,
    caster: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number,
    contextTarget?: Unit
  ): AbilityResult {
    // For triggered abilities, resolve targets automatically
    let targets: ResolvedTarget[];

    // If ability targets self, use caster position
    if (ability.targeting.pattern === 'self') {
      targets = [{ position: caster.position, unit: caster }];
    }
    // If there's a context target (e.g., on_attacked), use that
    else if (contextTarget) {
      targets = TargetingSystem.resolveTargets(
        caster,
        contextTarget.position,
        ability.targeting,
        allUnits,
        mapWidth,
        mapHeight
      );
    }
    // Otherwise, resolve targets from caster position
    else {
      targets = TargetingSystem.resolveTargets(
        caster,
        caster.position,
        ability.targeting,
        allUnits,
        mapWidth,
        mapHeight
      );
    }

    return this.executeAbility(ability, caster, targets, allUnits);
  }

  /**
   * Core ability execution logic
   */
  private executeAbility(
    ability: AbilityDefinition,
    caster: Unit,
    targets: ResolvedTarget[],
    allUnits: Unit[]
  ): AbilityResult {
    const effectResults: EffectResult[] = [];

    // Execute each effect in sequence
    for (const effect of ability.effects) {
      const results = EffectResolver.applyEffect(
        effect,
        caster,
        targets,
        allUnits,
        this.statusManager
      );
      effectResults.push(...results);
    }

    // Build animation sequence
    const animationSequence = ability.animationSteps || [];

    return {
      success: true,
      effectResults,
      animationSequence
    };
  }

  /**
   * Check if an ability can be used by a unit
   */
  canUseAbility(
    ability: AbilityDefinition,
    caster: Unit,
    targetPosition: Position,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): boolean {
    // Check action cost
    if (ability.cost.type === 'movement' && caster.hasUsedMovement) {
      return false;
    }
    if (ability.cost.type === 'main_action' && caster.hasUsedMainAction) {
      return false;
    }

    // Check cooldown (if implemented)
    // TODO: Track cooldowns per unit

    // Check charges (if implemented)
    // TODO: Track remaining charges

    // Check targeting validity
    const validation = TargetingSystem.validateTarget(
      caster,
      targetPosition,
      ability.targeting,
      allUnits,
      mapWidth,
      mapHeight
    );

    return validation.isValid;
  }

  /**
   * Get valid target positions for UI highlighting
   */
  getValidTargets(
    ability: AbilityDefinition,
    caster: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): Position[] {
    return TargetingSystem.getValidTargetPositions(
      caster,
      ability.targeting,
      allUnits,
      mapWidth,
      mapHeight
    );
  }

  /**
   * Get the status manager instance
   */
  getStatusManager(): StatusManager {
    return this.statusManager;
  }
}