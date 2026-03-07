import { describe, expect, it } from 'vitest';
import { ObjectiveController } from './ObjectiveController';
import { GameConfig } from '@config/gameConfig';
import type { Objective, Unit } from './types';

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
  hasActivated: false,
  hasUsedMovement: false,
  hasUsedMainAction: false,
  ...overrides
});

const buildObjective = (overrides: Partial<Objective> = {}): Objective => ({
  id: 'obj',
  position: { x: 2, y: 2 },
  controlledBy: null,
  ...overrides
});

describe('ObjectiveController', () => {
  it('retains control when no units are in range', () => {
    const objective = buildObjective({ controlledBy: GameConfig.TEAMS.BLUE });
    const units: Unit[] = [
      buildUnit({ position: { x: 10, y: 10 } })
    ];

    expect(ObjectiveController.determineControl(objective, units)).toBe(GameConfig.TEAMS.BLUE);
  });

  it('sets control when one team has majority', () => {
    const objective = buildObjective();
    const units: Unit[] = [
      buildUnit({ team: GameConfig.TEAMS.BLUE, position: { x: 2, y: 2 } }),
      buildUnit({ id: 'red', team: GameConfig.TEAMS.RED, position: { x: 5, y: 5 } })
    ];

    expect(ObjectiveController.determineControl(objective, units)).toBe(GameConfig.TEAMS.BLUE);
  });

  it('returns neutral on tie', () => {
    const objective = buildObjective();
    const units: Unit[] = [
      buildUnit({ team: GameConfig.TEAMS.BLUE, position: { x: 2, y: 2 } }),
      buildUnit({ id: 'red', team: GameConfig.TEAMS.RED, position: { x: 3, y: 2 } })
    ];

    expect(ObjectiveController.determineControl(objective, units)).toBeNull();
  });

  it('updates objective control list', () => {
    const objectives: Objective[] = [
      buildObjective({ id: 'obj-1', position: { x: 2, y: 2 } })
    ];
    const units: Unit[] = [
      buildUnit({ team: GameConfig.TEAMS.BLUE, position: { x: 2, y: 2 } })
    ];

    ObjectiveController.updateObjectiveControl(objectives, units);
    expect(objectives[0].controlledBy).toBe(GameConfig.TEAMS.BLUE);
  });
});