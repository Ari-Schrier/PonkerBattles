/**
 * IAbilityDataSource
 * Abstraction for loading ability/status definitions.
 * Phase 1: keep engine pure by decoupling loading mechanism (fetch vs filesystem).
 */

import type { AbilityDefinition, StatusDefinition } from './types';

export interface IAbilityDataSource {
  loadAbilities(path?: string): Promise<AbilityDefinition[]>;
  loadStatuses(path?: string): Promise<StatusDefinition[]>;
}