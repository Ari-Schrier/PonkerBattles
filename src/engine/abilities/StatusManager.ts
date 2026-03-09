/**
 * StatusManager
 * Manages active status effects on units
 */

import type { Unit } from '../types';
import type {
  StatusDefinition,
  ActiveStatus,
  StatModifier,
  EffectDefinition,
  TriggerType
} from './types';

export class StatusManager {
  private statusDefinitions: Map<string, StatusDefinition> = new Map();
  private activeStatuses: Map<string, ActiveStatus[]> = new Map(); // unitId -> statuses

  /**
   * Register a status definition
   */
  registerStatus(definition: StatusDefinition): void {
    this.statusDefinitions.set(definition.id, definition);
  }

  /**
   * Register multiple status definitions
   */
  registerStatuses(definitions: StatusDefinition[]): void {
    for (const def of definitions) {
      this.registerStatus(def);
    }
  }

  /**
   * Add a status to a unit
   */
  addStatus(
    unit: Unit,
    statusId: string,
    duration: number,
    appliedBy?: string
  ): boolean {
    const definition = this.statusDefinitions.get(statusId);
    if (!definition) {
      console.warn(`Status definition not found: ${statusId}`);
      return false;
    }

    // Get or create status array for unit
    let unitStatuses = this.activeStatuses.get(unit.id);
    if (!unitStatuses) {
      unitStatuses = [];
      this.activeStatuses.set(unit.id, unitStatuses);
    }

    // Check if status already exists
    const existing = unitStatuses.find(s => s.definitionId === statusId);

    if (existing) {
      if (definition.stackable) {
        // Increase stacks if stackable
        const maxStacks = definition.maxStacks || 999;
        if (existing.stacks < maxStacks) {
          existing.stacks++;
          existing.remainingDuration = Math.max(
            existing.remainingDuration,
            duration
          );
        }
      } else {
        // Refresh duration if not stackable
        existing.remainingDuration = Math.max(
          existing.remainingDuration,
          duration
        );
      }
    } else {
      // Add new status
      unitStatuses.push({
        definitionId: statusId,
        remainingDuration: duration,
        stacks: 1,
        appliedBy
      });
    }

    return true;
  }

  /**
   * Remove a status from a unit
   */
  removeStatus(unit: Unit, statusId: string): boolean {
    const unitStatuses = this.activeStatuses.get(unit.id);
    if (!unitStatuses) return false;

    const index = unitStatuses.findIndex(s => s.definitionId === statusId);
    if (index === -1) return false;

    unitStatuses.splice(index, 1);
    return true;
  }

  /**
   * Remove all statuses from a unit
   */
  clearStatuses(unit: Unit): void {
    this.activeStatuses.delete(unit.id);
  }

  /**
   * Get all active statuses for a unit
   */
  getStatuses(unit: Unit): ActiveStatus[] {
    return this.activeStatuses.get(unit.id) || [];
  }

  /**
   * Check if unit has a specific status
   */
  hasStatus(unit: Unit, statusId: string): boolean {
    const statuses = this.getStatuses(unit);
    return statuses.some(s => s.definitionId === statusId);
  }

  /**
   * Get status definition
   */
  getDefinition(statusId: string): StatusDefinition | undefined {
    return this.statusDefinitions.get(statusId);
  }

  /**
   * Update status durations (call at end of turn/round)
   */
  tickStatuses(unit: Unit): void {
    const unitStatuses = this.activeStatuses.get(unit.id);
    if (!unitStatuses) return;

    // Decrement durations and remove expired statuses
    for (let i = unitStatuses.length - 1; i >= 0; i--) {
      const status = unitStatuses[i];
      const definition = this.statusDefinitions.get(status.definitionId);
      
      // Don't tick permanent statuses
      if (definition && definition.duration === -1) {
        continue;
      }

      status.remainingDuration--;
      
      if (status.remainingDuration <= 0) {
        unitStatuses.splice(i, 1);
      }
    }

    // Clean up empty arrays
    if (unitStatuses.length === 0) {
      this.activeStatuses.delete(unit.id);
    }
  }

  /**
   * Get all stat modifiers affecting a unit from statuses
   */
  getStatModifiers(unit: Unit): StatModifier[] {
    const statuses = this.getStatuses(unit);
    const modifiers: StatModifier[] = [];

    for (const status of statuses) {
      const definition = this.statusDefinitions.get(status.definitionId);
      if (definition && definition.statModifiers) {
        // Apply stack multiplier for stackable statuses
        for (const modifier of definition.statModifiers) {
          modifiers.push({
            ...modifier,
            amount: modifier.amount * status.stacks
          });
        }
      }
    }

    return modifiers;
  }

  /**
   * Get all status effects that should trigger for a specific event
   */
  getTriggeredEffects(
    unit: Unit,
    triggerType: TriggerType
  ): Array<{ statusId: string; effects: EffectDefinition[]; stacks: number }> {
    const statuses = this.getStatuses(unit);
    const triggered: Array<{ statusId: string; effects: EffectDefinition[]; stacks: number }> = [];

    for (const status of statuses) {
      const definition = this.statusDefinitions.get(status.definitionId);
      if (!definition) continue;

      // Check if any triggers match
      for (const trigger of definition.triggers) {
        if (trigger.type === triggerType) {
          // Check chance
          const chance = trigger.chance ?? 1.0;
          if (Math.random() <= chance) {
            triggered.push({
              statusId: status.definitionId,
              effects: definition.effects,
              stacks: status.stacks
            });
          }
        }
      }
    }

    return triggered;
  }

  /**
   * Apply stat modifiers to a unit's stats (for display/calculation purposes)
   * Returns modified stats without mutating the unit
   */
  getModifiedStats(unit: Unit): typeof unit.stats {
    const modifiers = this.getStatModifiers(unit);
    const modifiedStats = { ...unit.stats };

    for (const modifier of modifiers) {
      const currentValue = modifiedStats[modifier.stat] as number;
      let newValue = currentValue;

      switch (modifier.modifierType) {
        case 'flat':
          newValue = currentValue + modifier.amount;
          break;
        case 'percent':
          newValue = currentValue + (currentValue * modifier.amount / 100);
          break;
        case 'multiply':
          newValue = currentValue * modifier.amount;
          break;
      }

      (modifiedStats[modifier.stat] as number) = Math.round(newValue);
    }

    return modifiedStats;
  }

  /**
   * Get visual tint color for a unit based on active statuses
   * Returns the tint from the highest priority status, or undefined
   */
  getStatusTint(unit: Unit): number | undefined {
    const statuses = this.getStatuses(unit);
    
    for (const status of statuses) {
      const definition = this.statusDefinitions.get(status.definitionId);
      if (definition && definition.tint !== undefined) {
        return definition.tint;
      }
    }

    return undefined;
  }

  /**
   * Debug: Get all registered status definitions
   */
  getAllDefinitions(): StatusDefinition[] {
    return Array.from(this.statusDefinitions.values());
  }

  /**
   * Debug: Get all active statuses across all units
   */
  getAllActiveStatuses(): Map<string, ActiveStatus[]> {
    return this.activeStatuses;
  }
}