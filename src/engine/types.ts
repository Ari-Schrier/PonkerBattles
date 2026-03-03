/**
 * Core type definitions for the game engine
 */

import type { Team, Phase } from '@config/gameConfig';

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
  hasActivated: boolean;
}

export interface Tile {
  x: number;
  y: number;
  terrainType: string;
  walkable: boolean;
  occupant: Unit | null;
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