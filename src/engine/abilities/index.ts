/**
 * Ability System
 * Exports all ability system modules for easy importing
 */

// Core type definitions
export * from './types';

// System components
export { TargetingSystem } from './TargetingSystem';
export { EffectResolver } from './EffectResolver';
export { StatusManager } from './StatusManager';
export { AbilityResolver } from './AbilityResolver';
export { TriggerManager } from './TriggerManager';
export { AbilityDataLoader } from './AbilityDataLoader';

// Re-export commonly used types for convenience
export type {
  AbilityDefinition,
  StatusDefinition,
  TriggerType,
  TargetingPattern,
  EffectType,
  AbilityResult,
  EffectResult,
  ActiveAbility,
  ActiveStatus,
  AnimationStep
} from './types';