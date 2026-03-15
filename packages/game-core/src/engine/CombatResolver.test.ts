import { describe, expect, it, vi, afterEach } from 'vitest';
import { CombatResolver } from './CombatResolver';
import { RNG } from './RNG';
import { GameConfig } from '../config/gameConfig.js';
import type { Unit } from './types';
import { Direction } from './types';

const buildUnit = (overrides: Partial<Unit> = {}): Unit => ({
  id: 'unit',
  name: 'Unit',
  team: GameConfig.TEAMS.BLUE,
  unitClass: 'Hunter',
  spriteKey: 'hunter-blue',
  stats: {
    maxHp: 10,
    hp: 10,
    movementRange: 4,
    attackBonus: 3,
    evasion: 10,
    armor: 1
  },
  position: { x: 0, y: 0 },
  currentDirection: Direction.Down,
  hasActivated: false,
  hasUsedMovement: false,
  hasUsedMainAction: false,
  ...overrides
});

describe('CombatResolver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a hit and damage without mutating defender', () => {
    const attacker = buildUnit({ stats: { ...buildUnit().stats, attackBonus: 5 } });
    const defender = buildUnit({
      id: 'def',
      team: GameConfig.TEAMS.RED,
      stats: { ...buildUnit().stats, hp: 8, evasion: 5, armor: 1 }
    });

    const rng = new RNG(12345);
    vi.spyOn(rng, 'rollDice').mockReturnValue(20); // roll 10 on both dice

    const result = CombatResolver.resolveAttack(attacker, defender, rng);

    expect(result.hit).toBe(true);
    expect(result.damage).toBe(4); // 5 attackBonus - 1 armor
    expect(result.targetDefeated).toBe(false);
    expect(defender.stats.hp).toBe(8); // unchanged
  });

  it('returns miss when roll fails', () => {
    const attacker = buildUnit({ stats: { ...buildUnit().stats, attackBonus: 1 } });
    const defender = buildUnit({
      id: 'def',
      team: GameConfig.TEAMS.RED,
      stats: { ...buildUnit().stats, evasion: 20 }
    });

    const rng = new RNG(54321);
    vi.spyOn(rng, 'rollDice').mockReturnValue(2); // roll 1 on both dice

    const result = CombatResolver.resolveAttack(attacker, defender, rng);

    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.targetDefeated).toBe(false);
  });

  it('respects minimum damage', () => {
    const attacker = buildUnit({ stats: { ...buildUnit().stats, attackBonus: 1 } });
    const defender = buildUnit({
      id: 'def',
      team: GameConfig.TEAMS.RED,
      stats: { ...buildUnit().stats, armor: 10, evasion: 1 }
    });

    const rng = new RNG(99999);
    vi.spyOn(rng, 'rollDice').mockReturnValue(20); // roll 10 on both dice to hit

    const result = CombatResolver.resolveAttack(attacker, defender, rng);

    expect(result.hit).toBe(true);
    expect(result.damage).toBe(GameConfig.MIN_DAMAGE);
  });
});