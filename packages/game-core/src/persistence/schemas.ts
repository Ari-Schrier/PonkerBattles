/**
 * Persistence Schemas - Phase 3
 * 
 * Canonical data structures for storing match state and turn history.
 * These schemas are designed for Azure Cosmos DB storage with optimistic concurrency.
 */

import type { Team, Phase } from '../config/gameConfig.js';
import type { Position } from '../engine/types.js';
import type { ActiveStatus } from '../engine/abilities/types.js';

// ============================================================================
// MATCH STATE SCHEMA
// ============================================================================

export type MatchStatus = 'pending' | 'active' | 'complete' | 'resigned';

export interface Match {
  // Cosmos DB document metadata
  id: string;                   // Match UUID
  _etag?: string;              // Cosmos DB optimistic concurrency token
  version: number;             // Incremented on each turn submission
  
  // Match metadata
  status: MatchStatus;
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
  
  // Game configuration
  mapId: string;
  mapWidth: number;
  mapHeight: number;
  
  // Players
  players: MatchParticipant[];
  activePlayerId: string;      // Player whose turn it is
  
  // Game state
  currentRound: number;
  currentPhase: Phase;
  activeTeam: Team;
  turnNumber: number;          // Total turns taken across all rounds
  
  // Units (compressed representation)
  units: UnitState[];
  
  // Objectives
  objectives: ObjectiveState[];
  
  // Winner (null if game ongoing)
  winner: Team | null;
  
  // RNG seed for deterministic resolution
  rngSeed: number;
  
  // Last processed turn ID for idempotency
  lastProcessedTurnId?: string;
}

export interface MatchParticipant {
  playerId: string;            // Player identifier (for now, just a name)
  team: Team;
  joinedAt: string;            // ISO 8601 timestamp
}

export interface UnitState {
  id: string;
  name: string;
  team: Team;
  unitClass: 'Hunter' | 'Soldier' | 'Thief';
  spriteKey: string;
  
  // Stats
  maxHp: number;
  hp: number;
  movementRange: number;
  attackBonus: number;
  evasion: number;
  armor: number;
  
  // Position
  x: number;
  y: number;
  currentDirection: number;    // Direction enum value
  
  // Activation state
  hasActivated: boolean;
  hasUsedMovement: boolean;
  hasUsedMainAction: boolean;
  
  // Abilities (stored by ID reference only)
  abilityIds?: string[];
  abilityCooldowns?: Record<string, number>;
  abilityCharges?: Record<string, number>;
  abilityTriggerCounts?: Record<string, number>;
  
  // Active status effects
  statuses?: ActiveStatus[];
}

export interface ObjectiveState {
  id: string;
  x: number;
  y: number;
  controlledBy: Team | null;
}

// ============================================================================
// TURN EVENT SCHEMA (for history/replay)
// ============================================================================

export interface TurnEvent {
  id: string;                  // Turn event UUID
  matchId: string;
  turnNumber: number;
  turnId: string;              // Client-provided idempotency key
  
  // Actor
  playerId: string;
  team: Team;
  
  // Timestamp
  submittedAt: string;         // ISO 8601 timestamp
  
  // Commands submitted
  commands: ActionCommand[];
  
  // Results from execution
  results: ActionResult[];
  
  // State changes
  unitsChanged?: string[];     // Unit IDs that changed
  roundEnded?: boolean;
  gameEnded?: boolean;
  
  // RNG seed before/after for verification
  rngSeedBefore: number;
  rngSeedAfter: number;
}

export type ActionCommand =
  | { type: 'move'; unitId: string; path: Position[] }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'ability'; unitId: string; abilityId: string; target: Position }
  | { type: 'wait'; unitId: string };

export type ActionResult = 
  | { type: 'move'; success: boolean; error?: string; from: Position; to: Position; aooTriggered?: boolean }
  | { type: 'attack'; success: boolean; error?: string; hit: boolean; damage: number; targetDefeated: boolean }
  | { type: 'ability'; success: boolean; error?: string; effectResults: any[] }
  | { type: 'wait'; success: boolean };

// ============================================================================
// TURN SUBMISSION REQUEST
// ============================================================================

export interface SubmitTurnRequest {
  matchId: string;
  playerId: string;
  version: number;             // Expected match version (for optimistic concurrency)
  turnId: string;              // Client-generated idempotency key
  commands: ActionCommand[];   // All commands for this turn (or partial turn)
  endTurn?: boolean;           // If true, force end turn after commands
}

export interface SubmitTurnResponse {
  success: boolean;
  match: Match;
  turnEvent?: TurnEvent;
  error?: string;
  conflictVersion?: number;    // If version conflict, return current version
}

// ============================================================================
// MATCH CREATION REQUEST
// ============================================================================

export interface CreateMatchRequest {
  mapId: string;
  players: {
    playerId: string;
    team: Team;
  }[];
  rngSeed?: number;            // Optional seed for testing
}

export interface CreateMatchResponse {
  success: boolean;
  match?: Match;
  error?: string;
}