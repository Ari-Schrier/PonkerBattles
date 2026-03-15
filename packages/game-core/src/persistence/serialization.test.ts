/**
 * Serialization Tests - Phase 3
 * 
 * Validates that GameState <-> Match conversion is lossless
 */

import { describe, it, expect } from 'vitest';
import { 
  gameStateToMatch, 
  matchToGameState, 
  validateRoundTrip 
} from './serialization.js';
import type { GameState } from '../engine/types.js';
import { GameConfig } from '../config/gameConfig.js';

describe('Serialization', () => {
  const createTestGameState = (): GameState => ({
    currentRound: 1,
    currentPhase: GameConfig.PHASES.PLAYER_ACTIVATION,
    activeTeam: GameConfig.TEAMS.BLUE,
    units: [
      {
        id: 'unit-1',
        name: 'Hunter',
        team: GameConfig.TEAMS.BLUE,
        unitClass: 'Hunter',
        spriteKey: 'hunter-blue',
        stats: {
          maxHp: 20,
          hp: 15,
          movementRange: 5,
          attackBonus: 2,
          evasion: 3,
          armor: 1
        },
        position: { x: 5, y: 5 },
        currentDirection: 0,
        hasActivated: false,
        hasUsedMovement: false,
        hasUsedMainAction: false
      },
      {
        id: 'unit-2',
        name: 'Soldier',
        team: GameConfig.TEAMS.RED,
        unitClass: 'Soldier',
        spriteKey: 'soldier-red',
        stats: {
          maxHp: 25,
          hp: 25,
          movementRange: 4,
          attackBonus: 3,
          evasion: 1,
          armor: 2
        },
        position: { x: 10, y: 10 },
        currentDirection: 0,
        hasActivated: false,
        hasUsedMovement: false,
        hasUsedMainAction: false
      }
    ],
    objectives: [
      { id: 'obj-1', position: { x: 7, y: 7 }, controlledBy: null },
      { id: 'obj-2', position: { x: 12, y: 12 }, controlledBy: GameConfig.TEAMS.BLUE }
    ],
    winner: null
  });

  it('should convert GameState to Match', () => {
    const state = createTestGameState();
    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const match = gameStateToMatch(
      state,
      'match-1',
      players,
      'map01',
      20,
      20,
      12345
    );

    expect(match.id).toBe('match-1');
    expect(match.mapId).toBe('map01');
    expect(match.currentRound).toBe(1);
    expect(match.activeTeam).toBe(GameConfig.TEAMS.BLUE);
    expect(match.units).toHaveLength(2);
    expect(match.objectives).toHaveLength(2);
    expect(match.rngSeed).toBe(12345);
    expect(match.activePlayerId).toBe('player1');
  });

  it('should convert Match to GameState', () => {
    const state = createTestGameState();
    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const match = gameStateToMatch(
      state,
      'match-1',
      players,
      'map01',
      20,
      20,
      12345
    );

    const reconstructed = matchToGameState(match);

    expect(reconstructed.currentRound).toBe(state.currentRound);
    expect(reconstructed.currentPhase).toBe(state.currentPhase);
    expect(reconstructed.activeTeam).toBe(state.activeTeam);
    expect(reconstructed.units).toHaveLength(state.units.length);
    expect(reconstructed.objectives).toHaveLength(state.objectives.length);
  });

  it('should preserve unit stats in round-trip', () => {
    const state = createTestGameState();
    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const match = gameStateToMatch(state, 'match-1', players, 'map01', 20, 20, 12345);
    const reconstructed = matchToGameState(match);

    const originalUnit = state.units[0];
    const reconstructedUnit = reconstructed.units[0];

    expect(reconstructedUnit.id).toBe(originalUnit.id);
    expect(reconstructedUnit.name).toBe(originalUnit.name);
    expect(reconstructedUnit.stats.hp).toBe(originalUnit.stats.hp);
    expect(reconstructedUnit.stats.maxHp).toBe(originalUnit.stats.maxHp);
    expect(reconstructedUnit.position.x).toBe(originalUnit.position.x);
    expect(reconstructedUnit.position.y).toBe(originalUnit.position.y);
    expect(reconstructedUnit.hasActivated).toBe(originalUnit.hasActivated);
  });

  it('should validate successful round-trip', () => {
    const state = createTestGameState();
    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const result = validateRoundTrip(
      state,
      'match-1',
      players,
      'map01',
      20,
      20,
      12345
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle units with abilities', () => {
    const state = createTestGameState();
    state.units[0].abilities = [
      {
        definitionId: 'fireball',
        remainingCharges: 3,
        currentCooldown: 0,
        triggerCount: 1
      }
    ];

    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const match = gameStateToMatch(state, 'match-1', players, 'map01', 20, 20, 12345);
    const reconstructed = matchToGameState(match);

    expect(reconstructed.units[0].abilities).toBeDefined();
    expect(reconstructed.units[0].abilities).toHaveLength(1);
    expect(reconstructed.units[0].abilities![0].definitionId).toBe('fireball');
    expect(reconstructed.units[0].abilities![0].remainingCharges).toBe(3);
    expect(reconstructed.units[0].abilities![0].triggerCount).toBe(1);
  });

  it('should preserve objective control state', () => {
    const state = createTestGameState();
    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const match = gameStateToMatch(state, 'match-1', players, 'map01', 20, 20, 12345);
    const reconstructed = matchToGameState(match);

    expect(reconstructed.objectives[0].controlledBy).toBeNull();
    expect(reconstructed.objectives[1].controlledBy).toBe(GameConfig.TEAMS.BLUE);
  });

  it('should preserve winner state', () => {
    const state = createTestGameState();
    state.winner = GameConfig.TEAMS.RED;

    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const match = gameStateToMatch(state, 'match-1', players, 'map01', 20, 20, 12345);
    
    expect(match.status).toBe('complete');
    expect(match.winner).toBe(GameConfig.TEAMS.RED);

    const reconstructed = matchToGameState(match);
    expect(reconstructed.winner).toBe(GameConfig.TEAMS.RED);
  });

  it('should increment version when using existingMatch', () => {
    const state = createTestGameState();
    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    const match1 = gameStateToMatch(state, 'match-1', players, 'map01', 20, 20, 12345);
    expect(match1.version).toBe(1);

    const match2 = gameStateToMatch(state, 'match-1', players, 'map01', 20, 20, 12345, {
      ...match1,
      version: 5
    });
    expect(match2.version).toBe(5);
  });
});