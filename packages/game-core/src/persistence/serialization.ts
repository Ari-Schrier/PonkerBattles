/**
 * Serialization Helpers - Phase 3
 * 
 * Bidirectional conversion between engine GameState and persistence Match format.
 * Ensures lossless round-trip conversion.
 */

import type { GameState, Unit, Objective } from '../engine/types.js';
import type { Match, UnitState, ObjectiveState } from './schemas.js';
import { Direction } from '../engine/types.js';

/**
 * Convert engine GameState to persistence Match format
 */
export function gameStateToMatch(
  state: GameState,
  matchId: string,
  players: Match['players'],
  mapId: string,
  mapWidth: number,
  mapHeight: number,
  rngSeed: number,
  existingMatch?: Partial<Match>
): Match {
  const now = new Date().toISOString();
  
  // Determine match status
  let status: Match['status'] = 'active';
  if (state.winner !== null) {
    status = 'complete';
  }
  
  // Find active player
  const activePlayer = players.find(p => p.team === state.activeTeam);
  if (!activePlayer) {
    throw new Error(`No player found for active team ${state.activeTeam}`);
  }
  
  return {
    id: matchId,
    _etag: existingMatch?._etag,
    version: existingMatch?.version ?? 1,
    status,
    createdAt: existingMatch?.createdAt ?? now,
    updatedAt: now,
    mapId,
    mapWidth,
    mapHeight,
    players,
    activePlayerId: activePlayer.playerId,
    currentRound: state.currentRound,
    currentPhase: state.currentPhase,
    activeTeam: state.activeTeam,
    turnNumber: existingMatch?.turnNumber ?? 0,
    units: state.units.map(unitToUnitState),
    objectives: state.objectives.map(objectiveToObjectiveState),
    winner: state.winner,
    rngSeed,
    lastProcessedTurnId: existingMatch?.lastProcessedTurnId
  };
}

/**
 * Convert persistence Match to engine GameState
 */
export function matchToGameState(match: Match): GameState {
  return {
    currentRound: match.currentRound,
    currentPhase: match.currentPhase,
    activeTeam: match.activeTeam,
    units: match.units.map(unitStateToUnit),
    objectives: match.objectives.map(objectiveStateToObjective),
    winner: match.winner
  };
}

/**
 * Convert engine Unit to persistence UnitState
 */
export function unitToUnitState(unit: Unit): UnitState {
  const state: UnitState = {
    id: unit.id,
    name: unit.name,
    team: unit.team,
    unitClass: unit.unitClass,
    spriteKey: unit.spriteKey,
    maxHp: unit.stats.maxHp,
    hp: unit.stats.hp,
    movementRange: unit.stats.movementRange,
    attackBonus: unit.stats.attackBonus,
    evasion: unit.stats.evasion,
    armor: unit.stats.armor,
    x: unit.position.x,
    y: unit.position.y,
    currentDirection: unit.currentDirection,
    hasActivated: unit.hasActivated,
    hasUsedMovement: unit.hasUsedMovement,
    hasUsedMainAction: unit.hasUsedMainAction
  };
  
  // Handle abilities if present
  if (unit.abilities && unit.abilities.length > 0) {
    state.abilityIds = unit.abilities.map(a => a.definitionId);
    
    const cooldowns: Record<string, number> = {};
    const charges: Record<string, number> = {};
    const triggerCounts: Record<string, number> = {};
    
    for (const ability of unit.abilities) {
      if (ability.currentCooldown !== undefined) {
        cooldowns[ability.definitionId] = ability.currentCooldown;
      }
      if (ability.remainingCharges !== undefined) {
        charges[ability.definitionId] = ability.remainingCharges;
      }
      triggerCounts[ability.definitionId] = ability.triggerCount;
    }
    
    if (Object.keys(cooldowns).length > 0) state.abilityCooldowns = cooldowns;
    if (Object.keys(charges).length > 0) state.abilityCharges = charges;
    if (Object.keys(triggerCounts).length > 0) state.abilityTriggerCounts = triggerCounts;
  }
  
  // Note: statuses are stored directly on UnitState (already ActiveStatus[])
  // This will be populated separately when we add status management
  
  return state;
}

/**
 * Convert persistence UnitState to engine Unit
 */
export function unitStateToUnit(state: UnitState): Unit {
  const unit: Unit = {
    id: state.id,
    name: state.name,
    team: state.team,
    unitClass: state.unitClass,
    spriteKey: state.spriteKey,
    stats: {
      maxHp: state.maxHp,
      hp: state.hp,
      movementRange: state.movementRange,
      attackBonus: state.attackBonus,
      evasion: state.evasion,
      armor: state.armor
    },
    position: {
      x: state.x,
      y: state.y
    },
    currentDirection: state.currentDirection as Direction,
    hasActivated: state.hasActivated,
    hasUsedMovement: state.hasUsedMovement,
    hasUsedMainAction: state.hasUsedMainAction
  };
  
  // Reconstruct abilities if present
  if (state.abilityIds && state.abilityIds.length > 0) {
    unit.abilities = state.abilityIds.map(id => ({
      definitionId: id,
      remainingCharges: state.abilityCharges?.[id],
      currentCooldown: state.abilityCooldowns?.[id],
      triggerCount: state.abilityTriggerCounts?.[id] ?? 0
    }));
  }
  
  // Note: statuses will be handled separately when we add status management
  
  return unit;
}

/**
 * Convert engine Objective to persistence ObjectiveState
 */
export function objectiveToObjectiveState(objective: Objective): ObjectiveState {
  return {
    id: objective.id,
    x: objective.position.x,
    y: objective.position.y,
    controlledBy: objective.controlledBy
  };
}

/**
 * Convert persistence ObjectiveState to engine Objective
 */
export function objectiveStateToObjective(state: ObjectiveState): Objective {
  return {
    id: state.id,
    position: {
      x: state.x,
      y: state.y
    },
    controlledBy: state.controlledBy
  };
}

/**
 * Validate that a round-trip conversion preserves all data
 * Useful for testing serialization correctness
 */
export function validateRoundTrip(
  state: GameState,
  matchId: string,
  players: Match['players'],
  mapId: string,
  mapWidth: number,
  mapHeight: number,
  rngSeed: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Convert to Match
    const match = gameStateToMatch(state, matchId, players, mapId, mapWidth, mapHeight, rngSeed);
    
    // Convert back to GameState
    const reconstructed = matchToGameState(match);
    
    // Compare key fields
    if (reconstructed.currentRound !== state.currentRound) {
      errors.push(`Round mismatch: ${reconstructed.currentRound} !== ${state.currentRound}`);
    }
    
    if (reconstructed.currentPhase !== state.currentPhase) {
      errors.push(`Phase mismatch: ${reconstructed.currentPhase} !== ${state.currentPhase}`);
    }
    
    if (reconstructed.activeTeam !== state.activeTeam) {
      errors.push(`Active team mismatch: ${reconstructed.activeTeam} !== ${state.activeTeam}`);
    }
    
    if (reconstructed.winner !== state.winner) {
      errors.push(`Winner mismatch: ${reconstructed.winner} !== ${state.winner}`);
    }
    
    // Compare units
    if (reconstructed.units.length !== state.units.length) {
      errors.push(`Unit count mismatch: ${reconstructed.units.length} !== ${state.units.length}`);
    } else {
      for (let i = 0; i < state.units.length; i++) {
        const original = state.units[i];
        const rebuilt = reconstructed.units[i];
        
        if (original.id !== rebuilt.id) {
          errors.push(`Unit ${i} ID mismatch: ${rebuilt.id} !== ${original.id}`);
        }
        if (original.stats.hp !== rebuilt.stats.hp) {
          errors.push(`Unit ${original.id} HP mismatch: ${rebuilt.stats.hp} !== ${original.stats.hp}`);
        }
        if (original.position.x !== rebuilt.position.x || original.position.y !== rebuilt.position.y) {
          errors.push(`Unit ${original.id} position mismatch`);
        }
        if (original.hasActivated !== rebuilt.hasActivated) {
          errors.push(`Unit ${original.id} hasActivated mismatch`);
        }
      }
    }
    
    // Compare objectives
    if (reconstructed.objectives.length !== state.objectives.length) {
      errors.push(`Objective count mismatch: ${reconstructed.objectives.length} !== ${state.objectives.length}`);
    }
    
  } catch (error) {
    errors.push(`Exception during round-trip: ${error}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}