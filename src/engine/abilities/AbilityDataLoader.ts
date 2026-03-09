/**
 * AbilityDataLoader
 * Loads ability and status definitions from JSON files
 */

import type { AbilityDefinition, StatusDefinition } from './types';

export class AbilityDataLoader {
  /**
   * Load abilities from JSON file
   */
  static async loadAbilities(path: string = '/src/data/abilities.json'): Promise<AbilityDefinition[]> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load abilities from ${path}: ${response.statusText}`);
      }
      const data = await response.json();
      return data as AbilityDefinition[];
    } catch (error) {
      console.error('Error loading abilities:', error);
      return [];
    }
  }

  /**
   * Load statuses from JSON file
   */
  static async loadStatuses(path: string = '/src/data/statuses.json'): Promise<StatusDefinition[]> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load statuses from ${path}: ${response.statusText}`);
      }
      const data = await response.json();
      return data as StatusDefinition[];
    } catch (error) {
      console.error('Error loading statuses:', error);
      return [];
    }
  }

  /**
   * Load both abilities and statuses
   */
  static async loadAll(
    abilitiesPath: string = '/src/data/abilities.json',
    statusesPath: string = '/src/data/statuses.json'
  ): Promise<{
    abilities: AbilityDefinition[];
    statuses: StatusDefinition[];
  }> {
    const [abilities, statuses] = await Promise.all([
      this.loadAbilities(abilitiesPath),
      this.loadStatuses(statusesPath)
    ]);

    return { abilities, statuses };
  }

  /**
   * Validate ability definition
   */
  static validateAbility(ability: AbilityDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!ability.id) errors.push('Missing id');
    if (!ability.name) errors.push('Missing name');
    if (!ability.trigger) errors.push('Missing trigger');
    if (!ability.cost) errors.push('Missing cost');
    if (!ability.targeting) errors.push('Missing targeting');
    if (!ability.effects || ability.effects.length === 0) {
      errors.push('Missing effects');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate status definition
   */
  static validateStatus(status: StatusDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!status.id) errors.push('Missing id');
    if (!status.name) errors.push('Missing name');
    if (status.duration === undefined) errors.push('Missing duration');
    if (!status.triggers) errors.push('Missing triggers');
    if (!status.effects) errors.push('Missing effects');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate all loaded abilities and statuses
   */
  static validateAll(
    abilities: AbilityDefinition[],
    statuses: StatusDefinition[]
  ): {
    valid: boolean;
    abilityErrors: Map<string, string[]>;
    statusErrors: Map<string, string[]>;
  } {
    const abilityErrors = new Map<string, string[]>();
    const statusErrors = new Map<string, string[]>();

    for (const ability of abilities) {
      const validation = this.validateAbility(ability);
      if (!validation.valid) {
        abilityErrors.set(ability.id, validation.errors);
      }
    }

    for (const status of statuses) {
      const validation = this.validateStatus(status);
      if (!validation.valid) {
        statusErrors.set(status.id, validation.errors);
      }
    }

    return {
      valid: abilityErrors.size === 0 && statusErrors.size === 0,
      abilityErrors,
      statusErrors
    };
  }
}