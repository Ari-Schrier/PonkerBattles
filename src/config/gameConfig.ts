/**
 * Game Configuration
 * Single source of truth for all game balance constants and rules.
 * Modify values here to rebalance gameplay without touching logic code.
 */

export const GameConfig = {
  // Match structure
  MAX_ROUNDS: 4,
  UNITS_PER_SIDE: 3,
  OBJECTIVE_COUNT: 3,
  
  // Objective control
  OBJECTIVE_CONTROL_RADIUS: 2, // tiles
  
  // Combat formulas
  HIT_ROLL_DICE_COUNT: 2,
  HIT_ROLL_DICE_SIDES: 10,
  HIT_BASE_SUBTRACT: 8,
  MIN_DAMAGE: 1,
  
  // Map and rendering
  TILE_SIZE: 32, // pixels
  MAP_WIDTH: 25, // tiles (BasicMap.tmj)
  MAP_HEIGHT: 25, // tiles (BasicMap.tmj)
  
  // Turn phases
  PHASES: {
    SETUP: 'setup',
    PLAYER_ACTIVATION: 'player_activation',
    ROUND_END: 'round_end',
    GAME_END: 'game_end'
  } as const,
  
  // Teams
  TEAMS: {
    BLUE: 'blue',
    RED: 'red'
  } as const
} as const;

export type Team = typeof GameConfig.TEAMS[keyof typeof GameConfig.TEAMS];
export type Phase = typeof GameConfig.PHASES[keyof typeof GameConfig.PHASES];