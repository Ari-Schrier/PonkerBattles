/**
 * Turn Resolver - Phase 3
 * 
 * Server-authoritative turn resolution that handles:
 * - Partial turn submission (move, then later attack)
 * - Status effect triggers (round start/end, turn start/end)
 * - Multiple commands in a single turn
 * - Turn event logging for replay
 */

import type { Match, TurnEvent, ActionCommand, ActionResult } from './schemas.js';
import { matchToGameState, gameStateToMatch } from './serialization.js';
import { resolveAction } from '../ActionResolver.js';
import { RNG } from '../engine/RNG.js';
import { TurnManager } from '../engine/TurnManager.js';
import { TriggerManager } from '../engine/abilities/TriggerManager.js';
import { AbilityResolver } from '../engine/abilities/AbilityResolver.js';
import { StatusManager } from '../engine/abilities/StatusManager.js';
import type { AbilityDefinition, StatusDefinition } from '../engine/abilities/types.js';
import { GameConfig } from '../config/gameConfig.js';

/**
 * Configuration for turn resolution
 */
export interface TurnResolutionConfig {
  abilities?: AbilityDefinition[];
  statuses?: StatusDefinition[];
  mapWidth?: number;
  mapHeight?: number;
}

/**
 * Result of turn resolution
 */
export interface TurnResolutionResult {
  match: Match;
  turnEvent: TurnEvent;
  turnEnded: boolean;
  roundEnded: boolean;
  gameEnded: boolean;
}

/**
 * Resolve a turn submission (potentially partial)
 * 
 * This is the primary server-side entry point for turn processing.
 * It handles:
 * - Command validation and execution
 * - Status effect triggers
 * - Turn/round progression
 * - Turn event creation for history
 * 
 * @param match - Current match state
 * @param playerId - Player submitting the turn
 * @param turnId - Client-provided idempotency key
 * @param commands - Commands to execute (may be partial turn)
 * @param config - Ability/status definitions and map config
 * @param endTurn - If true, force end turn after commands
 * @returns Updated match, turn event, and completion flags
 */
export async function resolveTurn(
  match: Match,
  playerId: string,
  turnId: string,
  commands: ActionCommand[],
  config: TurnResolutionConfig = {},
  endTurn: boolean = false
): Promise<TurnResolutionResult> {
  const { abilities = [], statuses = [], mapWidth, mapHeight } = config;
  
  // Validate player is in the match
  const player = match.players.find(p => p.playerId === playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not in match ${match.id}`);
  }
  
  // Validate it's this player's turn
  if (match.activePlayerId !== playerId) {
    throw new Error(`Not ${playerId}'s turn (active player: ${match.activePlayerId})`);
  }
  
  // Check for idempotency - if this turnId was already processed, return current state
  if (match.lastProcessedTurnId === turnId) {
    // Already processed - return current state without changes
    // (In a real system, you'd want to return the cached TurnEvent too)
    throw new Error(`Turn ${turnId} already processed`);
  }
  
  // Convert match to GameState
  let state = matchToGameState(match);
  
  // Initialize RNG with match seed
  const rng = new RNG(match.rngSeed);
  const rngSeedBefore = rng.getSeed();
  
  // Initialize trigger system if abilities/statuses provided
  let triggerManager: TriggerManager | undefined;
  if (abilities.length > 0 || statuses.length > 0) {
    const statusManager = new StatusManager();
    const abilityResolver = new AbilityResolver(statusManager);
    triggerManager = new TriggerManager(abilityResolver, statusManager);
    
    triggerManager.registerAbilities(abilities);
    statusManager.registerStatuses(statuses);
  }
  
  // Handle round start triggers if we're at round start
  if (state.currentPhase === GameConfig.PHASES.SETUP && triggerManager) {
    const width = mapWidth ?? match.mapWidth;
    const height = mapHeight ?? match.mapHeight;
    
    triggerManager.onRoundStart(state.units, width, height);
  }
  
  // Execute commands in sequence
  const results: ActionResult[] = [];
  let turnEnded = false;
  let roundEnded = false;
  let gameEnded = false;
  
  for (const command of commands) {
    // Find the unit executing this command
    const unit = state.units.find(u => u.id === command.unitId);
    
    // Fire turn start trigger if this is the first action for this unit
    if (unit && !unit.hasUsedMovement && !unit.hasUsedMainAction && triggerManager) {
      const width = mapWidth ?? match.mapWidth;
      const height = mapHeight ?? match.mapHeight;
      triggerManager.onTurnStart(unit, state.units, width, height);
    }
    
    // Resolve the action
    const actionResult = resolveAction({
      state,
      command,
      rngSeed: rng.getSeed(),
      abilities,
      terrainRules: undefined // Will need to pass this in later
    });
    
    state = actionResult.newState;
    results.push(actionResult.result);
    
    // Update RNG seed
    rng.setSeed(actionResult.rngSeed);
    
    // Check if this action completed the turn
    if (actionResult.turnEnded) {
      turnEnded = true;
      roundEnded = actionResult.roundEnded;
      gameEnded = actionResult.gameEnded;
      
      // Fire turn end trigger
      if (unit && triggerManager) {
        const width = mapWidth ?? match.mapWidth;
        const height = mapHeight ?? match.mapHeight;
        triggerManager.onTurnEnd(unit, state.units, width, height);
      }
    }
  }
  
  // If endTurn flag is set, force turn completion even if unit hasn't used all actions
  if (endTurn && !turnEnded) {
    // Find active unit and mark all actions as used
    const activeUnit = state.units.find(u => u.team === state.activeTeam && !u.hasActivated);
    
    if (activeUnit) {
      activeUnit.hasUsedMovement = true;
      activeUnit.hasUsedMainAction = true;
      
      // Fire turn end trigger
      if (triggerManager) {
        const width = mapWidth ?? match.mapWidth;
        const height = mapHeight ?? match.mapHeight;
        triggerManager.onTurnEnd(activeUnit, state.units, width, height);
      }
      
      // Complete the turn
      const turnManager = new TurnManager(state);
      const completion = turnManager.completeUnitActivation(activeUnit);
      turnEnded = true;
      roundEnded = completion.roundEnded;
      gameEnded = completion.gameEnded;
    }
  }
  
  // Handle round end triggers if round ended
  if (roundEnded && triggerManager) {
    const width = mapWidth ?? match.mapWidth;
    const height = mapHeight ?? match.mapHeight;
    
    triggerManager.onRoundEnd(state.units, width, height);
  }
  
  // Convert back to Match format
  const updatedMatch = gameStateToMatch(
    state,
    match.id,
    match.players,
    match.mapId,
    match.mapWidth,
    match.mapHeight,
    rng.getSeed(),
    {
      ...match,
      turnNumber: match.turnNumber + 1,
      version: match.version + 1,
      lastProcessedTurnId: turnId
    }
  );
  
  // Create turn event for history
  const turnEvent: TurnEvent = {
    id: `${match.id}-turn-${match.turnNumber + 1}`,
    matchId: match.id,
    turnNumber: match.turnNumber + 1,
    turnId,
    playerId,
    team: player.team,
    submittedAt: new Date().toISOString(),
    commands,
    results,
    unitsChanged: state.units
      .filter(u => {
        // Find original unit
        const original = match.units.find(orig => orig.id === u.id);
        // Check if changed
        return !original || 
               original.hp !== u.stats.hp || 
               original.x !== u.position.x || 
               original.y !== u.position.y ||
               original.hasActivated !== u.hasActivated;
      })
      .map(u => u.id),
    roundEnded,
    gameEnded,
    rngSeedBefore,
    rngSeedAfter: rng.getSeed()
  };
  
  return {
    match: updatedMatch,
    turnEvent,
    turnEnded,
    roundEnded,
    gameEnded
  };
}

/**
 * Create a new match from initial setup
 * 
 * @param matchId - Unique match identifier
 * @param mapId - Map to use
 * @param mapWidth - Map width in tiles
 * @param mapHeight - Map height in tiles
 * @param players - Players participating
 * @param initialState - Initial game state (units, objectives, etc.)
 * @param rngSeed - Optional RNG seed (for testing/replay)
 * @returns New match ready for play
 */
export function createMatch(
  matchId: string,
  mapId: string,
  mapWidth: number,
  mapHeight: number,
  players: Match['players'],
  initialState: ReturnType<typeof matchToGameState>,
  rngSeed?: number
): Match {
  const seed = rngSeed ?? Date.now();
  
  return gameStateToMatch(
    initialState,
    matchId,
    players,
    mapId,
    mapWidth,
    mapHeight,
    seed,
    {
      status: 'active',
      turnNumber: 0
    }
  );
}