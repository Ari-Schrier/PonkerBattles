/**
 * Turn Resolver Tests - Phase 3
 * 
 * Tests partial turn submission, turn resolution, and status triggers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTurn, createMatch } from './TurnResolver.js';
import type { Match } from './schemas.js';
import { GameConfig } from '../config/gameConfig.js';
import type { GameState } from '../engine/types.js';

describe('TurnResolver', () => {
  let initialState: GameState;
  let match: Match;

  beforeEach(() => {
    // Create a simple test game state
    initialState = {
      currentRound: 1,
      currentPhase: GameConfig.PHASES.PLAYER_ACTIVATION,
      activeTeam: GameConfig.TEAMS.BLUE,
      units: [
        {
          id: 'blue-1',
          name: 'Blue Hunter',
          team: GameConfig.TEAMS.BLUE,
          unitClass: 'Hunter',
          spriteKey: 'hunter-blue',
          stats: {
            maxHp: 20,
            hp: 20,
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
          id: 'red-1',
          name: 'Red Soldier',
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
          position: { x: 6, y: 6 },
          currentDirection: 0,
          hasActivated: false,
          hasUsedMovement: false,
          hasUsedMainAction: false
        }
      ],
      objectives: [
        { id: 'obj-1', position: { x: 10, y: 10 }, controlledBy: null }
      ],
      winner: null
    };

    const players = [
      { playerId: 'player1', team: GameConfig.TEAMS.BLUE, joinedAt: '2026-03-15T00:00:00Z' },
      { playerId: 'player2', team: GameConfig.TEAMS.RED, joinedAt: '2026-03-15T00:00:00Z' }
    ];

    match = createMatch(
      'test-match',
      'map01',
      20,
      20,
      players,
      initialState,
      12345
    );
  });

  it('should create a match', () => {
    expect(match.id).toBe('test-match');
    expect(match.status).toBe('active');
    expect(match.turnNumber).toBe(0);
    expect(match.version).toBe(1);
    expect(match.activePlayerId).toBe('player1');
    expect(match.units).toHaveLength(2);
  });

  it('should reject turn from wrong player', async () => {
    await expect(
      resolveTurn(
        match,
        'player2', // Wrong player (it's player1's turn)
        'turn-1',
        [{ type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] }]
      )
    ).rejects.toThrow("Not player2's turn");
  });

  it('should reject turn from player not in match', async () => {
    await expect(
      resolveTurn(
        match,
        'player3', // Not in match
        'turn-1',
        [{ type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] }]
      )
    ).rejects.toThrow('not in match');
  });

  it('should process a move command', async () => {
    const result = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [{ type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] }]
    );

    expect(result.match.version).toBe(2);
    expect(result.match.turnNumber).toBe(1);
    expect(result.turnEvent.commands).toHaveLength(1);
    expect(result.turnEvent.results).toHaveLength(1);
    expect(result.turnEnded).toBe(false); // Only used movement, not main action
    
    // Verify unit moved
    const movedUnit = result.match.units.find(u => u.id === 'blue-1');
    expect(movedUnit?.x).toBe(5);
    expect(movedUnit?.y).toBe(6);
    expect(movedUnit?.hasUsedMovement).toBe(true);
    expect(movedUnit?.hasUsedMainAction).toBe(false);
  });

  it('should support partial turn submission', async () => {
    // First, move the unit
    const result1 = await resolveTurn(
      match,
      'player1',
      'turn-1a',
      [{ type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] }]
    );

    expect(result1.turnEnded).toBe(false);
    expect(result1.match.units.find(u => u.id === 'blue-1')?.hasUsedMovement).toBe(true);
    expect(result1.match.units.find(u => u.id === 'blue-1')?.hasUsedMainAction).toBe(false);

    // Then, attack with the same unit
    const result2 = await resolveTurn(
      result1.match,
      'player1',
      'turn-1b',
      [{ type: 'attack', unitId: 'blue-1', targetId: 'red-1' }]
    );

    expect(result2.turnEnded).toBe(true); // Now turn is complete
    expect(result2.match.units.find(u => u.id === 'blue-1')?.hasActivated).toBe(true);
    expect(result2.match.units.find(u => u.id === 'blue-1')?.hasUsedMainAction).toBe(true);
  });

  it('should enforce idempotency', async () => {
    const result1 = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [{ type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] }]
    );

    // Try to submit the same turnId again
    await expect(
      resolveTurn(
        result1.match,
        'player1',
        'turn-1', // Same turnId
        [{ type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 7 }] }]
      )
    ).rejects.toThrow('already processed');
  });

  it('should support endTurn flag for wait/skip', async () => {
    const result = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [], // No commands
      {},
      true // endTurn = true
    );

    expect(result.turnEnded).toBe(true);
    const unit = result.match.units.find(u => u.id === 'blue-1');
    expect(unit?.hasActivated).toBe(true);
    expect(unit?.hasUsedMovement).toBe(true);
    expect(unit?.hasUsedMainAction).toBe(true);
  });

  it('should track units changed in turn event', async () => {
    const result = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [
        { type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] },
        { type: 'attack', unitId: 'blue-1', targetId: 'red-1' }
      ]
    );

    // Both units should be in unitsChanged (blue-1 moved/activated, red-1 possibly took damage)
    expect(result.turnEvent.unitsChanged).toContain('blue-1');
  });

  it('should preserve RNG seed progression', async () => {
    const result = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [{ type: 'attack', unitId: 'blue-1', targetId: 'red-1' }]
    );

    // RNG seed should have changed due to attack roll
    expect(result.turnEvent.rngSeedAfter).not.toBe(result.turnEvent.rngSeedBefore);
    expect(result.match.rngSeed).toBe(result.turnEvent.rngSeedAfter);
  });

  it('should handle multiple commands in one turn', async () => {
    const result = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [
        { type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] },
        { type: 'attack', unitId: 'blue-1', targetId: 'red-1' }
      ]
    );

    expect(result.turnEvent.commands).toHaveLength(2);
    expect(result.turnEvent.results).toHaveLength(2);
    expect(result.turnEnded).toBe(true);
  });

  it('should increment match version on each turn', async () => {
    expect(match.version).toBe(1);

    const result1 = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [{ type: 'wait', unitId: 'blue-1' }]
    );
    expect(result1.match.version).toBe(2);

    // Note: In a real game, active player would switch to player2 after turn ends
    // For this test, we're just verifying version increments
  });

  it('should create proper turn event', async () => {
    const result = await resolveTurn(
      match,
      'player1',
      'turn-1',
      [{ type: 'move', unitId: 'blue-1', path: [{ x: 5, y: 6 }] }]
    );

    expect(result.turnEvent.id).toBe('test-match-turn-1');
    expect(result.turnEvent.matchId).toBe('test-match');
    expect(result.turnEvent.turnNumber).toBe(1);
    expect(result.turnEvent.turnId).toBe('turn-1');
    expect(result.turnEvent.playerId).toBe('player1');
    expect(result.turnEvent.team).toBe(GameConfig.TEAMS.BLUE);
    expect(result.turnEvent.submittedAt).toBeDefined();
  });
});