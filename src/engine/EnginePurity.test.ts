/**
 * Engine Purity Test
 * Verifies that the engine has no Phaser dependencies
 * This is critical for Phase 1 of the serverless migration
 */

import { describe, it, expect } from 'vitest';
import { GameConfig } from '@config/gameConfig';
import type { Unit } from './types';
import { Direction } from './types';

describe('Engine Purity', () => {
  it('should import all engine modules without Phaser', async () => {
    // This test verifies that all engine modules can be imported in Node.js
    // If any module has Phaser dependencies, this test will fail
    
    // Core engine modules
    await import('./CombatResolver');
    await import('./MovementEngine');
    await import('./TurnManager');
    await import('./ObjectiveController');
    await import('./TerrainRules');
    await import('./types');
    await import('./RNG');
    
    // Utils
    await import('./utils/DirectionUtils');
    
    // Ability system
    await import('./abilities/AbilityResolver');
    await import('./abilities/EffectResolver');
    await import('./abilities/StatusManager');
    await import('./abilities/TargetingSystem');
    await import('./abilities/TriggerManager');
    await import('./abilities/AbilityDataLoader');
    
    // If we get here, all modules loaded successfully
    expect(true).toBe(true);
  });

  it('should create RNG instance and produce deterministic results', async () => {
    const { RNG } = await import('./RNG');
    
    const rng1 = new RNG(12345);
    const rng2 = new RNG(12345);
    
    // Same seed should produce same sequence
    const sequence1 = [rng1.next(), rng1.next(), rng1.next()];
    const sequence2 = [rng2.next(), rng2.next(), rng2.next()];
    
    expect(sequence1).toEqual(sequence2);
  });

  it('should produce consistent dice rolls with same seed', async () => {
    const { RNG } = await import('./RNG');
    
    const rng1 = new RNG(54321);
    const rng2 = new RNG(54321);
    
    const rolls1 = [
      rng1.rollDice(2, 10),
      rng1.rollDice(2, 10),
      rng1.rollDice(2, 10)
    ];
    
    const rolls2 = [
      rng2.rollDice(2, 10),
      rng2.rollDice(2, 10),
      rng2.rollDice(2, 10)
    ];
    
    expect(rolls1).toEqual(rolls2);
  });

  it('should produce deterministic combat results with seeded RNG', async () => {
    const { CombatResolver } = await import('./CombatResolver');
    const { RNG } = await import('./RNG');
    
    const attacker: Unit = {
      id: 'a1',
      name: 'Attacker',
      team: GameConfig.TEAMS.BLUE,
      unitClass: 'Soldier',
      spriteKey: 'soldier-blue',
      stats: {
        maxHp: 20,
        hp: 20,
        movementRange: 3,
        attackBonus: 6,
        evasion: 10,
        armor: 2
      },
      position: { x: 0, y: 0 },
      currentDirection: Direction.Down,
      hasActivated: false,
      hasUsedMovement: false,
      hasUsedMainAction: false
    };

    const defender: Unit = {
      id: 'd1',
      name: 'Defender',
      team: GameConfig.TEAMS.RED,
      unitClass: 'Soldier',
      spriteKey: 'soldier-red',
      stats: {
        maxHp: 20,
        hp: 20,
        movementRange: 3,
        attackBonus: 6,
        evasion: 10,
        armor: 2
      },
      position: { x: 1, y: 0 },
      currentDirection: Direction.Down,
      hasActivated: false,
      hasUsedMovement: false,
      hasUsedMainAction: false
    };

    const rng1 = new RNG(99999);
    const rng2 = new RNG(99999);

    const result1 = CombatResolver.resolveAttack(attacker, defender, rng1);
    const result2 = CombatResolver.resolveAttack(attacker, defender, rng2);

    expect(result1).toEqual(result2);
  });
});