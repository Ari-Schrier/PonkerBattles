/**
 * TriggerManager
 * Manages automatic triggering of abilities and status effects based on game events
 */

import type { Unit } from '../types';
import type {
  TriggerType,
  AbilityDefinition,
  AbilityResult
} from './types';
import { AbilityResolver } from './AbilityResolver';
import { StatusManager } from './StatusManager';

export class TriggerManager {
  private abilityResolver: AbilityResolver;
  private statusManager: StatusManager;
  private abilityDefinitions: Map<string, AbilityDefinition> = new Map();

  constructor(abilityResolver: AbilityResolver, statusManager: StatusManager) {
    this.abilityResolver = abilityResolver;
    this.statusManager = statusManager;
  }

  /**
   * Register an ability definition
   */
  registerAbility(definition: AbilityDefinition): void {
    this.abilityDefinitions.set(definition.id, definition);
  }

  /**
   * Register multiple ability definitions
   */
  registerAbilities(definitions: AbilityDefinition[]): void {
    for (const def of definitions) {
      this.registerAbility(def);
    }
  }

  getAbilityDefinitions(): Map<string, AbilityDefinition> {
    return this.abilityDefinitions;
  }

  /**
   * Get an ability definition by ID
   */
  getAbility(abilityId: string): AbilityDefinition | undefined {
    return this.abilityDefinitions.get(abilityId);
  }

  /**
   * Trigger abilities and status effects for a specific event
   * Returns results of all triggered abilities
   */
  triggerEvent(
    triggerType: TriggerType,
    unit: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number,
    contextTarget?: Unit
  ): AbilityResult[] {
    const results: AbilityResult[] = [];

    // Check unit's abilities for triggered abilities
    if (unit.abilities) {
      for (const activeAbility of unit.abilities) {
        const definition = this.abilityDefinitions.get(activeAbility.definitionId);
        if (!definition) continue;

        // Check if this ability triggers on this event
        if (definition.trigger.type === triggerType) {
          // Check trigger chance
          const chance = definition.trigger.chance ?? 1.0;
          if (Math.random() > chance) continue;

          // Check max triggers
          if (
            definition.trigger.maxTriggers !== undefined &&
            activeAbility.triggerCount >= definition.trigger.maxTriggers
          ) {
            continue;
          }

          // Check cooldown
          if (
            activeAbility.currentCooldown !== undefined &&
            activeAbility.currentCooldown > 0
          ) {
            continue;
          }

          // Execute the triggered ability
          const result = this.abilityResolver.executeTriggeredAbility(
            definition,
            unit,
            allUnits,
            mapWidth,
            mapHeight,
            contextTarget
          );

          results.push(result);

          // Update trigger count
          activeAbility.triggerCount++;

          // Set cooldown if specified
          if (definition.trigger.cooldown !== undefined) {
            activeAbility.currentCooldown = definition.trigger.cooldown;
          }
        }
      }
    }

    // Check status effects for triggered effects
    const statusEffects = this.statusManager.getTriggeredEffects(unit, triggerType);
    
    // For status effects, we need to execute their effects directly
    // This is a simplified approach - in a full implementation, you might want
    // to convert status effects into temporary abilities and execute them
    for (const statusEffect of statusEffects) {
      // Apply each effect multiple times if stacked
      for (let i = 0; i < statusEffect.stacks; i++) {
        // Create a minimal ability result for status effect execution
        // In a full implementation, you'd want to properly execute the effects
        // through the EffectResolver with proper targeting
        const effectResult: AbilityResult = {
          success: true,
          effectResults: [],
          animationSequence: []
        };

        results.push(effectResult);
      }
    }

    return results;
  }

  /**
   * Trigger on_turn_start events for a unit
   */
  onTurnStart(
    unit: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_turn_start', unit, allUnits, mapWidth, mapHeight);
  }

  /**
   * Trigger on_turn_end events for a unit
   */
  onTurnEnd(
    unit: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    // Also tick status durations at turn end
    this.statusManager.tickStatuses(unit);
    
    return this.triggerEvent('on_turn_end', unit, allUnits, mapWidth, mapHeight);
  }

  /**
   * Trigger on_damage_taken events
   */
  onDamageTaken(
    unit: Unit,
    _damage: number,
    attacker: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_damage_taken', unit, allUnits, mapWidth, mapHeight, attacker);
  }

  /**
   * Trigger on_death events
   */
  onDeath(
    unit: Unit,
    killer: Unit | undefined,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_death', unit, allUnits, mapWidth, mapHeight, killer);
  }

  /**
   * Trigger on_kill events for the killer
   */
  onKill(
    killer: Unit,
    victim: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_kill', killer, allUnits, mapWidth, mapHeight, victim);
  }

  /**
   * Trigger on_attack events
   */
  onAttack(
    attacker: Unit,
    target: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_attack', attacker, allUnits, mapWidth, mapHeight, target);
  }

  /**
   * Trigger on_attacked events for the defender
   */
  onAttacked(
    defender: Unit,
    attacker: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_attacked', defender, allUnits, mapWidth, mapHeight, attacker);
  }

  /**
   * Trigger on_miss events when attacker misses
   */
  onMiss(
    attacker: Unit,
    target: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_miss', attacker, allUnits, mapWidth, mapHeight, target);
  }

  /**
   * Trigger on_missed_by events when defender dodges
   */
  onMissedBy(
    defender: Unit,
    attacker: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_missed_by', defender, allUnits, mapWidth, mapHeight, attacker);
  }

  /**
   * Trigger on_move events
   */
  onMove(
    unit: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_move', unit, allUnits, mapWidth, mapHeight);
  }

  /**
   * Trigger on_dash events
   */
  onDash(
    unit: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_dash', unit, allUnits, mapWidth, mapHeight);
  }

  /**
   * Trigger on_stationary events when unit ends turn without moving
   */
  onStationary(
    unit: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): AbilityResult[] {
    return this.triggerEvent('on_stationary', unit, allUnits, mapWidth, mapHeight);
  }

  /**
   * Trigger on_round_start events for all units
   */
  onRoundStart(
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): Map<string, AbilityResult[]> {
    const results = new Map<string, AbilityResult[]>();
    
    for (const unit of allUnits) {
      const unitResults = this.triggerEvent(
        'on_round_start',
        unit,
        allUnits,
        mapWidth,
        mapHeight
      );
      if (unitResults.length > 0) {
        results.set(unit.id, unitResults);
      }
    }

    return results;
  }

  /**
   * Trigger on_round_end events for all units
   */
  onRoundEnd(
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): Map<string, AbilityResult[]> {
    const results = new Map<string, AbilityResult[]>();
    
    for (const unit of allUnits) {
      const unitResults = this.triggerEvent(
        'on_round_end',
        unit,
        allUnits,
        mapWidth,
        mapHeight
      );
      if (unitResults.length > 0) {
        results.set(unit.id, unitResults);
      }
    }

    return results;
  }

  /**
   * Trigger on_ally_death for all allies of the deceased
   */
  onAllyDeath(
    deceased: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): Map<string, AbilityResult[]> {
    const results = new Map<string, AbilityResult[]>();
    
    const allies = allUnits.filter(u => u.team === deceased.team && u.id !== deceased.id);
    
    for (const ally of allies) {
      const allyResults = this.triggerEvent(
        'on_ally_death',
        ally,
        allUnits,
        mapWidth,
        mapHeight,
        deceased
      );
      if (allyResults.length > 0) {
        results.set(ally.id, allyResults);
      }
    }

    return results;
  }

  /**
   * Trigger on_enemy_death for all enemies of the deceased
   */
  onEnemyDeath(
    deceased: Unit,
    allUnits: Unit[],
    mapWidth: number,
    mapHeight: number
  ): Map<string, AbilityResult[]> {
    const results = new Map<string, AbilityResult[]>();
    
    const enemies = allUnits.filter(u => u.team !== deceased.team);
    
    for (const enemy of enemies) {
      const enemyResults = this.triggerEvent(
        'on_enemy_death',
        enemy,
        allUnits,
        mapWidth,
        mapHeight,
        deceased
      );
      if (enemyResults.length > 0) {
        results.set(enemy.id, enemyResults);
      }
    }

    return results;
  }

  /**
   * Update cooldowns for all abilities (call at turn end)
   */
  tickCooldowns(unit: Unit): void {
    if (!unit.abilities) return;

    for (const ability of unit.abilities) {
      if (ability.currentCooldown !== undefined && ability.currentCooldown > 0) {
        ability.currentCooldown--;
      }
    }
  }

  /**
   * Get all registered ability definitions
   */
  getAllAbilities(): AbilityDefinition[] {
    return Array.from(this.abilityDefinitions.values());
  }
}