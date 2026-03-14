/**
 * Ability System Type Definitions
 * Core types for the data-driven ability system
 */

import type { Position, Unit } from '../types';

// ============================================================================
// TRIGGER SYSTEM
// ============================================================================

export type TriggerType =
  | 'activated'           // Player-activated ability
  | 'on_damage_taken'     // When this unit takes damage
  | 'on_death'            // When this unit dies
  | 'on_kill'             // When this unit kills an enemy
  | 'on_turn_start'       // At start of this unit's turn
  | 'on_turn_end'         // At end of this unit's turn
  | 'on_round_start'      // At start of each round
  | 'on_round_end'        // At end of each round
  | 'on_move'             // When this unit moves
  | 'on_dash'             // When this unit uses dash
  | 'on_stationary'       // When turn ends without moving
  | 'on_attack'           // When this unit attacks
  | 'on_attacked'         // When this unit is attacked
  | 'on_miss'             // When this unit misses an attack
  | 'on_missed_by'        // When an attack against this unit misses
  | 'on_ally_death'       // When an ally dies
  | 'on_enemy_death';     // When an enemy dies

export interface TriggerCondition {
  type: TriggerType;
  chance?: number;        // 0-1, probability of triggering (default 1.0)
  maxTriggers?: number;   // Max times this can trigger per battle
  cooldown?: number;      // Turns before can trigger again
}

// ============================================================================
// TARGETING SYSTEM
// ============================================================================

export type TargetingPattern =
  | 'self'                    // The caster
  | 'single_tile'             // A single tile (may be empty)
  | 'single_unit'             // A single unit
  | 'single_enemy'            // A single enemy unit
  | 'single_ally'             // A single ally unit
  | 'line'                    // All tiles in a line
  | 'radius'                  // All tiles within radius
  | 'radius_units'            // All units within radius
  | 'radius_enemies'          // All enemy units within radius
  | 'radius_allies'           // All ally units within radius
  | 'adjacent'                // Adjacent tiles (8-directional)
  | 'adjacent_units'          // Adjacent units
  | 'adjacent_enemies'        // Adjacent enemy units
  | 'cone'                    // Cone in a direction
  | 'all_enemies'             // All enemy units on map
  | 'all_allies'              // All ally units on map
  | 'all_units';              // All units on map

export interface TargetingDefinition {
  pattern: TargetingPattern;
  range: number;              // Max distance from caster (0 = unlimited)
  minRange?: number;          // Minimum distance (default 0)
  radius?: number;            // For radius/cone patterns
  requiresLineOfSight?: boolean; // Must have clear path (default false)
  canTargetSelf?: boolean;    // For patterns that might include caster
  mustTargetEmpty?: boolean;  // For teleport/summon - require empty tile
  mustTargetOccupied?: boolean; // Must target occupied tile
}

export interface TargetValidation {
  isValid: boolean;
  reason?: string;            // Why targeting failed
}

export interface ResolvedTarget {
  position: Position;
  unit?: Unit;                // Present if targeting a unit
}

// ============================================================================
// EFFECT SYSTEM
// ============================================================================

export type EffectType =
  | 'damage'
  | 'heal'
  | 'teleport'
  | 'move'
  | 'push'
  | 'pull'
  | 'dash'                    // Grant extra movement action
  | 'apply_status'
  | 'remove_status'
  | 'modify_stat'
  | 'spawn_entity'
  | 'attack'                  // Use unified combat system
  | 'kill'                    // Instant death
  | 'swap_positions'
  | 'create_hazard';

export type StatModifierType = 'flat' | 'percent' | 'multiply';

export interface EffectDefinition {
  type: EffectType;
  
  // Damage/Heal
  amount?: number;
  useAttackerStat?: keyof UnitStats; // Use attacker's stat as base
  useTargetStat?: keyof UnitStats;   // Use target's stat as base
  
  // Stat Modification
  stat?: keyof UnitStats;
  modifierType?: StatModifierType;
  
  // Status Effects
  statusId?: string;
  statusDuration?: number;
  removeStatusId?: string;
  
  // Movement
  distance?: number;
  direction?: 'toward_caster' | 'away_from_caster' | 'forward';
  targetPosition?: Position;  // For teleport with fixed destination
  
  // Entity Spawning
  entityId?: string;          // ID of entity to spawn
  
  // Attack (unified combat)
  attackStatOverride?: {
    attackBonus?: number;
    useAlternateStat?: keyof UnitStats; // e.g., use target's attack
  };
  
  // Conditional execution
  condition?: EffectCondition;
}

export interface EffectCondition {
  type: 'target_hp_below' | 'target_hp_above' | 'target_has_status' | 'target_is_type';
  value?: number | string;
}

export interface UnitStats {
  maxHp: number;
  hp: number;
  movementRange: number;
  attackBonus: number;
  evasion: number;
  armor: number;
}

// ============================================================================
// ANIMATION SYSTEM
// ============================================================================

export type AnimationStepType =
  | 'caster_anim'        // Play animation on caster
  | 'target_anim'        // Play animation on target(s)
  | 'projectile'         // Fire projectile from caster to target
  | 'effect_visual'      // Show effect visual at position
  | 'camera_shake'       // Shake camera
  | 'wait'               // Wait for duration
  | 'sound';             // Play sound effect

export interface AnimationStep {
  type: AnimationStepType;
  
  // Animation
  animationType?: 'walk' | 'attack' | 'damage' | 'death' | 'idle' | 'cast' | 'shoot';
  
  // Projectile
  projectileSprite?: string;
  projectileSpeed?: number;  // pixels per second
  
  // Effect visual
  effectSprite?: string;
  effectDuration?: number;   // milliseconds
  
  // Camera
  intensity?: number;
  
  // Timing
  duration?: number;         // milliseconds
  waitForCompletion?: boolean; // Wait for this step to finish (default true)
  
  // Sound
  soundKey?: string;
}

// ============================================================================
// COST SYSTEM
// ============================================================================

export type ActionCostType = 'movement' | 'main_action' | 'free' | 'reaction';

export interface AbilityCost {
  type: ActionCostType;
  movementCost?: number;     // For abilities that consume movement points
}

// ============================================================================
// ABILITY DEFINITION
// ============================================================================

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  
  // Activation
  trigger: TriggerCondition;
  cost: AbilityCost;
  
  // Targeting
  targeting: TargetingDefinition;
  
  // Effects (executed in order)
  effects: EffectDefinition[];
  
  // Animation sequence
  animationSteps?: AnimationStep[];
  
  // Future features
  cooldown?: number;         // Turns before can use again
  maxCharges?: number;       // Limited uses per battle
  
  // AI Hints
  aiHints?: AIHints;
}

export interface AIHints {
  priority: 'low' | 'medium' | 'high' | 'critical';
  preferredTargetType?: 'low_hp' | 'high_hp' | 'closest' | 'furthest' | 'high_value';
  estimatedValue?: number;   // Relative value for AI decision-making
  role?: 'offensive' | 'defensive' | 'utility' | 'mobility';
  useWhen?: string;          // Human-readable hint
}

// ============================================================================
// STATUS EFFECT DEFINITION
// ============================================================================

export interface StatusDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  
  duration: number;          // Turns (-1 = permanent)
  stackable?: boolean;       // Can apply multiple times
  maxStacks?: number;
  
  // Status effects use same trigger/effect system as abilities
  triggers: TriggerCondition[];
  effects: EffectDefinition[];
  
  // Visual
  tint?: number;             // Color tint to apply to unit
  animationSteps?: AnimationStep[];
  
  // Stat modifiers (persistent while status active)
  statModifiers?: StatModifier[];
}

export interface StatModifier {
  stat: keyof UnitStats;
  modifierType: StatModifierType;
  amount: number;
}

// ============================================================================
// RUNTIME ABILITY INSTANCE
// ============================================================================

export interface ActiveAbility {
  definitionId: string;
  remainingCharges?: number;
  currentCooldown?: number;
  triggerCount: number;       // Times triggered this battle
}

export interface ActiveStatus {
  definitionId: string;
  remainingDuration: number;
  stacks: number;
  appliedBy?: string;         // Unit ID that applied this status
}

// ============================================================================
// ABILITY EXECUTION CONTEXT
// ============================================================================

export interface AbilityContext {
  ability: AbilityDefinition;
  caster: Unit;
  targets: ResolvedTarget[];
  triggerSource?: TriggerType;
  gameState: any;             // Reference to current game state
}

export interface EffectResult {
  success: boolean;
  damageDealt?: number;
  healingDone?: number;
  statusApplied?: string;
  unitKilled?: boolean;
  message?: string;
}

export interface AbilityResult {
  success: boolean;
  effectResults: EffectResult[];
  animationSequence: AnimationStep[];
}