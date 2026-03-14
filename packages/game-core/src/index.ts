/**
 * @battlegame/game-core
 * Deterministic game engine for BattleGame
 * Server and client compatible
 */

// Core engine modules
export { CombatResolver } from './engine/CombatResolver.js';
export { MovementEngine } from './engine/MovementEngine.js';
export { ObjectiveController } from './engine/ObjectiveController.js';
export { TurnManager } from './engine/TurnManager.js';
export { TerrainRules } from './engine/TerrainRules.js';
export { RNG, globalRNG } from './engine/RNG.js';

// Types
export type {
  Position,
  UnitStats,
  Unit,
  Tile,
  TileAnimationFrame,
  TerrainCategory,
  TerrainLayer,
  TileDefinition,
  Objective,
  GameState,
  AttackResult,
  MapData,
  MapLayer,
  MapObject,
  MapProperty,
  TilesetData,
  MapDefinition,
  ActiveAbility
} from './engine/types.js';

export { Direction } from './engine/types.js';

// Ability system
export {
  AbilityResolver,
  EffectResolver,
  StatusManager,
  TargetingSystem,
  TriggerManager
} from './engine/abilities/index.js';

export type { IAbilityDataSource } from './engine/abilities/IAbilityDataSource.js';

export type {
  TriggerType,
  TriggerCondition,
  TargetingPattern,
  TargetingDefinition,
  TargetValidation,
  ResolvedTarget,
  EffectType,
  StatModifierType,
  EffectDefinition,
  EffectCondition,
  AnimationStepType,
  AnimationStep,
  ActionCostType,
  AbilityCost,
  AbilityDefinition,
  AIHints,
  StatusDefinition,
  StatModifier,
  ActiveStatus,
  AbilityContext,
  EffectResult,
  AbilityResult
} from './engine/abilities/types.js';

// Utils
export { DirectionUtils } from './engine/utils/DirectionUtils.js';

// Config
export { GameConfig } from './config/gameConfig.js';
export type { Team, Phase } from './config/gameConfig.js';

// Action Resolution
export { resolveAction } from './ActionResolver.js';
export type {
  ActionCommand,
  ActionResult,
  ResolveActionInput,
  ResolveActionOutput
} from './ActionResolver.js';
