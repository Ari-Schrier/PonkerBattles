import { describe, expect, it, vi } from 'vitest';
import { TurnManager } from './TurnManager';
import { GameConfig } from '../config/gameConfig.js';
import type { GameState, Unit } from './types';
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

const buildState = (units: Unit[]): GameState => ({
  currentRound: 1,
  currentPhase: GameConfig.PHASES.SETUP,
  activeTeam: GameConfig.TEAMS.BLUE,
  units,
  objectives: [],
  winner: null
});

describe('TurnManager', () => {
  it('starts the game with blue team activation', () => {
    const manager = new TurnManager(buildState([buildUnit()]));

    manager.startGame();

    const state = manager.getGameState();
    expect(state.currentRound).toBe(1);
    expect(state.currentPhase).toBe(GameConfig.PHASES.PLAYER_ACTIVATION);
    expect(state.activeTeam).toBe(GameConfig.TEAMS.BLUE);
  });

  it('alternates teams when activations remain', () => {
    const units = [
      buildUnit({ id: 'blue', team: GameConfig.TEAMS.BLUE }),
      buildUnit({ id: 'red', team: GameConfig.TEAMS.RED })
    ];
    const manager = new TurnManager(buildState(units));
    manager.startGame();

    manager.activateUnit(units[0]);
    manager.nextTeam();

    expect(manager.getGameState().activeTeam).toBe(GameConfig.TEAMS.RED);
  });

  it('fires round-end callback and increments round after all activations', () => {
    const units = [
      buildUnit({ id: 'blue', team: GameConfig.TEAMS.BLUE }),
      buildUnit({ id: 'red', team: GameConfig.TEAMS.RED })
    ];
    const onRoundEnd = vi.fn();
    const manager = new TurnManager(buildState(units), onRoundEnd);
    manager.startGame();

    manager.completeUnitActivation(units[0]);
    manager.completeUnitActivation(units[1]);

    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(manager.getGameState().currentRound).toBe(2);
  });

  it('ends the game after max rounds', () => {
    const units = [
      buildUnit({ id: 'blue', team: GameConfig.TEAMS.BLUE }),
      buildUnit({ id: 'red', team: GameConfig.TEAMS.RED })
    ];
    const state = buildState(units);
    const manager = new TurnManager(state);
    manager.startGame();
    manager.getGameState().currentRound = GameConfig.MAX_ROUNDS;

    manager.completeUnitActivation(units[0]);
    manager.completeUnitActivation(units[1]);

    expect(manager.isGameOver()).toBe(true);
    expect(manager.getGameState().currentPhase).toBe(GameConfig.PHASES.GAME_END);
  });
});