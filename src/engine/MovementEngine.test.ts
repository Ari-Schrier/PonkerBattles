import { describe, expect, it } from 'vitest';
import { MovementEngine } from './MovementEngine';
import { GameConfig } from '@config/gameConfig';
import type { Unit } from './types';

const buildUnit = (overrides: Partial<Unit> = {}): Unit => ({
  id: 'unit',
  name: 'Unit',
  team: GameConfig.TEAMS.BLUE,
  unitClass: 'Hunter',
  spriteKey: 'hunter-blue',
  stats: {
    maxHp: 10,
    hp: 10,
    movementRange: 2,
    attackBonus: 3,
    evasion: 10,
    armor: 1
  },
  position: { x: 1, y: 1 },
  hasActivated: false,
  hasUsedMovement: false,
  hasUsedMainAction: false,
  ...overrides
});

describe('MovementEngine', () => {
  it('returns legal moves within range and bounds', () => {
    const unit = buildUnit();
    const occupied = new Map<string, boolean>();

    const moves = MovementEngine.getLegalMoves(unit, occupied, 3, 3);
    const keys = new Set(moves.map(pos => `${pos.x},${pos.y}`));

    expect(keys.has('1,1')).toBe(false);
    expect(keys.has('0,1')).toBe(true);
    expect(keys.has('2,1')).toBe(true);
    expect(keys.has('1,0')).toBe(true);
    expect(keys.has('1,2')).toBe(true);
    expect(keys.has('0,0')).toBe(true);
    expect(keys.has('2,2')).toBe(true);
    expect(keys.has('2,0')).toBe(true);
    expect(keys.has('0,2')).toBe(true);
  });

  it('respects occupied positions', () => {
    const unit = buildUnit();
    const occupied = new Map<string, boolean>([['0,1', true]]);

    const moves = MovementEngine.getLegalMoves(unit, occupied, 3, 3);
    const keys = new Set(moves.map(pos => `${pos.x},${pos.y}`));

    expect(keys.has('0,1')).toBe(false);
  });

  it('respects walkability callback', () => {
    const unit = buildUnit();
    const occupied = new Map<string, boolean>();

    const moves = MovementEngine.getLegalMoves(unit, occupied, 3, 3, {
      isWalkable: pos => !(pos.x === 1 && pos.y === 2)
    });
    const keys = new Set(moves.map(pos => `${pos.x},${pos.y}`));

    expect(keys.has('1,2')).toBe(false);
  });

  it('respects movement costs when exploring', () => {
    const unit = buildUnit({ stats: { ...buildUnit().stats, movementRange: 2 } });
    const occupied = new Map<string, boolean>();

    const moves = MovementEngine.getLegalMoves(unit, occupied, 4, 4, {
      getMoveCost: pos => (pos.x === 2 && pos.y === 1 ? 2 : 1)
    });

    const keys = new Set(moves.map(pos => `${pos.x},${pos.y}`));
    expect(keys.has('2,1')).toBe(true);
    expect(keys.has('3,1')).toBe(false);
  });
});