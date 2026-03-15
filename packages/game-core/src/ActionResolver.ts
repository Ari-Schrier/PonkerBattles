/**
 * ActionResolver - Server-authoritative action resolution
 * 
 * Provides the core `resolveAction` API that validates and executes
 * individual game actions deterministically.
 */

import type { GameState, Unit, Position } from './engine/types.js';
import { MovementEngine } from './engine/MovementEngine.js';
import { CombatResolver } from './engine/CombatResolver.js';
import { TurnManager } from './engine/TurnManager.js';
import { TerrainRules } from './engine/TerrainRules.js';
import { AbilityResolver } from './engine/abilities/AbilityResolver.js';
import { StatusManager } from './engine/abilities/StatusManager.js';
import { RNG } from './engine/RNG.js';
import type { AbilityDefinition } from './engine/abilities/types.js';

// Action command types
export type ActionCommand =
  | { type: 'move'; unitId: string; path: Position[] }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'ability'; unitId: string; abilityId: string; target: Position }
  | { type: 'wait'; unitId: string };

// Action result types
export type ActionResult = 
  | { type: 'move'; success: boolean; error?: string; from: Position; to: Position; aooTriggered?: boolean }
  | { type: 'attack'; success: boolean; error?: string; hit: boolean; damage: number; targetDefeated: boolean }
  | { type: 'ability'; success: boolean; error?: string; effectResults: any[] }
  | { type: 'wait'; success: boolean };

export interface ResolveActionInput {
  state: GameState;
  command: ActionCommand;
  rngSeed?: number;
  abilities?: AbilityDefinition[];
  terrainRules?: TerrainRules;
}

export interface ResolveActionOutput {
  newState: GameState;
  result: ActionResult;
  turnEnded: boolean;
  roundEnded: boolean;
  gameEnded: boolean;
  rngSeed: number;
}

/**
 * Resolves a single action command deterministically
 * 
 * This is the primary server-side entry point for executing game actions.
 * It validates the action, executes it, updates game state, and determines
 * if the unit's activation is complete.
 * 
 * @param input - Action command, game state, and optional dependencies
 * @returns Updated state, action result, and turn completion flags
 */
export function resolveAction(input: ResolveActionInput): ResolveActionOutput {
  const { state, command, rngSeed, abilities, terrainRules } = input;
  
  // Initialize RNG
  const rng = new RNG(rngSeed);
  
  // Deep clone state to avoid mutations
  const newState: GameState = JSON.parse(JSON.stringify(state));
  
  // Find the acting unit
  const unit = newState.units.find(u => u.id === command.unitId);
  if (!unit) {
    return {
      newState: state,
      result: { type: 'wait', success: false } as ActionResult,
      turnEnded: false,
      roundEnded: false,
      gameEnded: false,
      rngSeed: rng.getSeed()
    };
  }
  
  // Validate it's this unit's team's turn
  if (unit.team !== newState.activeTeam) {
    return {
      newState: state,
      result: { type: 'wait', success: false } as ActionResult,
      turnEnded: false,
      roundEnded: false,
      gameEnded: false,
      rngSeed: rng.getSeed()
    };
  }
  
  // Validate unit hasn't already activated
  if (unit.hasActivated) {
    return {
      newState: state,
      result: { type: 'wait', success: false } as ActionResult,
      turnEnded: false,
      roundEnded: false,
      gameEnded: false,
      rngSeed: rng.getSeed()
    };
  }
  
  let result: ActionResult;
  
  // Execute the action based on type
  switch (command.type) {
    case 'move':
      result = executeMove(newState, unit, command.path, terrainRules);
      break;
      
    case 'attack':
      result = executeAttack(newState, unit, command.targetId, rng);
      break;
      
    case 'ability':
      result = executeAbility(newState, unit, command.abilityId, command.target, abilities, rng);
      break;
      
    case 'wait':
      result = { type: 'wait', success: true };
      unit.hasUsedMovement = true;
      unit.hasUsedMainAction = true;
      break;
  }
  
  // Check if turn is complete
  const turnManager = new TurnManager(newState);
  const turnEnded = unit.hasUsedMovement && unit.hasUsedMainAction;
  
  let roundEnded = false;
  let gameEnded = false;
  
  if (turnEnded) {
    const completion = turnManager.completeUnitActivation(unit);
    roundEnded = completion.roundEnded;
    gameEnded = completion.gameEnded;
  }
  
  // Advance RNG state for next action by generating a new seed
  // This ensures deterministic progression while consuming the RNG sequence
  const nextSeed = rng.nextInt(0, 2147483647);
  
  return {
    newState,
    result,
    turnEnded,
    roundEnded,
    gameEnded,
    rngSeed: nextSeed
  };
}

function executeMove(
  state: GameState,
  unit: Unit,
  path: Position[],
  terrainRules?: TerrainRules
): ActionResult {
  // Validate unit hasn't already moved
  if (unit.hasUsedMovement) {
    return {
      type: 'move',
      success: false,
      error: 'Unit has already moved',
      from: unit.position,
      to: unit.position
    };
  }
  
  // Validate path is legal
  const from = { ...unit.position };
  const to = path[path.length - 1];
  
  // Check if path is within movement range
  const distance = MovementEngine.getDistance(from, to);
  if (distance > unit.stats.movementRange) {
    return {
      type: 'move',
      success: false,
      error: 'Move exceeds movement range',
      from,
      to
    };
  }
  
  // Check if destination is walkable (if terrainRules provided)
  if (terrainRules && !terrainRules.isWalkable(to)) {
    return {
      type: 'move',
      success: false,
      error: 'Destination is not walkable',
      from,
      to
    };
  }
  
  // Check if destination is occupied
  const occupant = state.units.find(u => u.position.x === to.x && u.position.y === to.y && u.id !== unit.id);
  if (occupant) {
    return {
      type: 'move',
      success: false,
      error: 'Destination is occupied',
      from,
      to
    };
  }
  
  // Execute the move
  unit.position = to;
  unit.hasUsedMovement = true;
  
  // Check for attacks of opportunity
  // (Simplified - would need full AoO logic from game rules)
  let aooTriggered = false;
  
  return {
    type: 'move',
    success: true,
    from,
    to,
    aooTriggered
  };
}

function executeAttack(
  state: GameState,
  attacker: Unit,
  targetId: string,
  rng: RNG
): ActionResult {
  // Validate unit hasn't already used main action
  if (attacker.hasUsedMainAction) {
    return {
      type: 'attack',
      success: false,
      error: 'Unit has already used main action',
      hit: false,
      damage: 0,
      targetDefeated: false
    };
  }
  
  // Find target
  const defender = state.units.find(u => u.id === targetId);
  if (!defender) {
    return {
      type: 'attack',
      success: false,
      error: 'Target not found',
      hit: false,
      damage: 0,
      targetDefeated: false
    };
  }
  
  // Validate target is in range (adjacent)
  if (!MovementEngine.isAdjacent(attacker.position, defender.position)) {
    return {
      type: 'attack',
      success: false,
      error: 'Target not in range',
      hit: false,
      damage: 0,
      targetDefeated: false
    };
  }
  
  // Validate target is enemy
  if (attacker.team === defender.team) {
    return {
      type: 'attack',
      success: false,
      error: 'Cannot attack allies',
      hit: false,
      damage: 0,
      targetDefeated: false
    };
  }
  
  // Resolve attack
  const attackResult = CombatResolver.resolveAttack(attacker, defender, rng);
  
  // Apply damage
  if (attackResult.hit) {
    defender.stats.hp -= attackResult.damage;
    if (defender.stats.hp <= 0) {
      defender.stats.hp = 0;
    }
  }
  
  // Mark action used
  attacker.hasUsedMainAction = true;
  
  return {
    type: 'attack',
    success: true,
    hit: attackResult.hit,
    damage: attackResult.damage,
    targetDefeated: attackResult.targetDefeated
  };
}

function executeAbility(
  state: GameState,
  caster: Unit,
  abilityId: string,
  target: Position,
  abilities?: AbilityDefinition[],
  _rng?: RNG
): ActionResult {
  // Validate unit hasn't already used main action
  if (caster.hasUsedMainAction) {
    return {
      type: 'ability',
      success: false,
      error: 'Unit has already used main action',
      effectResults: []
    };
  }
  
  // Find ability definition
  if (!abilities) {
    return {
      type: 'ability',
      success: false,
      error: 'Abilities not provided',
      effectResults: []
    };
  }
  
  const abilityDef = abilities.find(a => a.id === abilityId);
  if (!abilityDef) {
    return {
      type: 'ability',
      success: false,
      error: 'Ability not found',
      effectResults: []
    };
  }
  
  // Create ability resolver
  const statusManager = new StatusManager();
  const abilityResolver = new AbilityResolver(statusManager);
  
  // Execute ability (simplified - would need full map dimensions)
  const result = abilityResolver.executeActivatedAbility(
    abilityDef,
    caster,
    target,
    state.units,
    20, // mapWidth - would need to pass this in
    20  // mapHeight
  );
  
  // Mark action used
  caster.hasUsedMainAction = true;
  
  return {
    type: 'ability',
    success: result.success,
    effectResults: result.effectResults
  };
}