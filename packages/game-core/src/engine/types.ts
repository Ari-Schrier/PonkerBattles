/**
 * Core type definitions for the game engine
 */

import type { Team, Phase } from '../config/gameConfig.js';

export interface Position {
  x: number;
  y: number;
}

export interface UnitStats {
  maxHp: number;
  hp: number;
  movementRange: number;
  attackBonus: number;
  evasion: number;
  armor: number;
}

export interface Unit {
  id: string;
  name: string;
  team: Team;
  unitClass: 'Hunter' | 'Soldier' | 'Thief';
  spriteKey: string;
  stats: UnitStats;
  position: Position;
  currentDirection: Direction;
  hasActivated: boolean;
  hasUsedMovement: boolean;
  hasUsedMainAction: boolean;
  abilities?: ActiveAbility[];  // Optional abilities array for ability system
}

// Import ability types (defined in abilities/types.ts)
export interface ActiveAbility {
  definitionId: string;
  remainingCharges?: number;
  currentCooldown?: number;
  triggerCount: number;
}

export interface Tile {
  x: number;
  y: number;
  terrainType: string;
  walkable: boolean;
  occupant: Unit | null;
}

export interface TileAnimationFrame {
  frame: number;
  duration: number;
}

export enum Direction {
  Down = 0,
  DownRight = 1,
  Right = 2,
  UpRight = 3,
  Up = 4,
  UpLeft = 5,
  Left = 6,
  DownLeft = 7
}

export type TerrainCategory = 'land' | 'forest' | 'cliff' | 'water';
export type TerrainLayer = 'ground' | 'overlay';

export interface TileDefinition {
  gid: number;
  terrainType: TerrainCategory;
  layer: TerrainLayer;
  objectiveMarker?: boolean;
  animationFrames?: TileAnimationFrame[];
}

export interface Objective {
  id: string;
  position: Position;
  controlledBy: Team | null;
}

export interface GameState {
  currentRound: number;
  currentPhase: Phase;
  activeTeam: Team;
  units: Unit[];
  objectives: Objective[];
  winner: Team | null;
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  targetDefeated: boolean;
}

export interface MapData {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: MapLayer[];
  tilesets: TilesetData[];
}

export interface MapLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: MapObject[];
  width?: number;
  height?: number;
}

export interface MapObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  properties?: MapProperty[];
}

export interface MapProperty {
  name: string;
  type: string;
  value: any;
}

export interface TilesetData {
  firstgid: number;
  source?: string;
  name: string;
  tilewidth: number;
  tileheight: number;
  imagewidth: number;
  imageheight: number;
  image: string;
}

export interface MapDefinition {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  groundLayer: number[];
  overlayLayer: number[];
  tileDefs: TileDefinition[];
  objectives: Objective[];
  spawnPoints: MapObject[];
}