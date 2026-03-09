/**
 * BattleScene
 * Main gameplay scene with map, units, and turn-based interaction
 */

import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Unit, GameState, Objective, Position, MapData, MapDefinition, TileDefinition } from '@engine/types';
import { Direction } from '@engine/types';
import { TurnManager } from '@engine/TurnManager';
import { ObjectiveController } from '@engine/ObjectiveController';
import { MapLoader } from '@data/maps/MapLoader';
import { MovementEngine } from '@engine/MovementEngine';
import { TerrainRules } from '@engine/TerrainRules';
import { UnitController } from './controllers/UnitController';
import { UIController } from './controllers/UIController';
import { MovementController } from './controllers/MovementController';
import { CombatController } from './controllers/CombatController';
import { ActionQueue } from './controllers/ActionQueue';

export class BattleScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private mapDefinition!: MapDefinition;
  private tileDefLookup: Map<number, TileDefinition> = new Map();
  private gameState!: GameState;
  private turnManager!: TurnManager;
  private selectedUnit: Unit | null = null;
  private unitController!: UnitController;
  private uiController!: UIController;
  private movementController!: MovementController;
  private combatController!: CombatController;
  private actionQueue!: ActionQueue;
  private terrainRules!: TerrainRules;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);

    // Create tilemap
    this.map = this.make.tilemap({ key: 'basicMap' });
    const tileset = this.map.addTilesetImage('punyworld-overworld-tileset', 'world-tileset');

    if (tileset) {
      const groundLayer = this.map.createLayer('Tile Layer 1', tileset, 0, 0);
      const overlayLayer = this.map.createLayer('Tile Layer 2', tileset, 0, 0);
      const scale = GameConfig.TILE_SIZE / this.map.tileWidth;
      groundLayer?.setScale(scale);
      overlayLayer?.setScale(scale);
    }

    this.mapDefinition = this.loadMapDefinition();

    // Initialize game state
    this.initializeGameState();

    // Create controllers
    this.actionQueue = new ActionQueue();
    this.terrainRules = new TerrainRules(this.mapDefinition, this.mapDefinition.tileDefs);
    this.unitController = new UnitController(this);
    this.uiController = new UIController(this);
    this.movementController = new MovementController(
      this,
      this.unitController,
      this.mapDefinition,
      this.terrainRules,
      this.actionQueue
    );
    this.combatController = new CombatController(this, this.unitController, this.actionQueue);

    // Create turn manager
    this.turnManager = new TurnManager(this.gameState, () => {
      ObjectiveController.updateObjectiveControl(this.gameState.objectives, this.gameState.units);
      this.uiController.updateObjectiveVisuals(this.gameState);
    });
    this.turnManager.startGame();

    // Place objectives
    this.uiController.createObjectives(this.gameState);

    // Place units
    this.unitController.createUnits(this.gameState.units);

    // Create UI
    this.uiController.createUI();

    // Enable input
    this.input.on('pointerdown', this.handleClick, this);

    this.updateUI();
  }

  private initializeGameState(): void {
    const blueTeamData = this.cache.json.get('blueTeam');
    const redTeamData = this.cache.json.get('redTeam');

    // Create units
    const units: Unit[] = [];

    [...blueTeamData, ...redTeamData].forEach((unitData: any) => {
      units.push({
        id: unitData.id,
        name: unitData.name,
        team: unitData.team,
        unitClass: unitData.unitClass,
        spriteKey: unitData.spriteKey,
        stats: { ...unitData.stats },
        position: { ...unitData.startPosition },
        currentDirection: Direction.Down,
        hasActivated: false,
        hasUsedMovement: false,
        hasUsedMainAction: false
      });
    });

    // Create objectives
    const objectives: Objective[] = this.mapDefinition.objectives.map(obj => ({
      id: obj.id,
      position: { ...obj.position },
      controlledBy: null
    }));

    this.gameState = {
      currentRound: 1,
      currentPhase: GameConfig.PHASES.SETUP,
      activeTeam: GameConfig.TEAMS.BLUE,
      units,
      objectives,
      winner: null
    };
  }

  private updateUI(): void {
    if (this.selectedUnit) {
      const movementStatus = this.selectedUnit.hasUsedMovement ? '✓' : 'Available';
      const mainActionStatus = this.selectedUnit.hasUsedMainAction ? '✓' : 'Available';

      this.uiController.updateUI(
        this.gameState,
        this.selectedUnit.name,
        `${this.selectedUnit.stats.hp}/${this.selectedUnit.stats.maxHp}`,
        movementStatus,
        mainActionStatus
      );
    } else {
      this.uiController.updateUI(this.gameState);
    }
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    const tileX = Math.floor(pointer.worldX / GameConfig.TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / GameConfig.TILE_SIZE);

    // Check if clicking on a unit
    const clickedUnit = this.unitController.getUnitAtPosition(this.gameState.units, { x: tileX, y: tileY });

    if (this.selectedUnit) {
      // Unit is already selected
      if (clickedUnit && clickedUnit === this.selectedUnit) {
        // If unit has used any actions, end their turn
        if (this.selectedUnit.hasUsedMovement || this.selectedUnit.hasUsedMainAction) {
          this.endUnitActivation(this.selectedUnit);
        } else {
          // Otherwise just deselect
          this.deselectUnit();
        }
      } else if (clickedUnit && clickedUnit.team !== this.selectedUnit.team) {
        if (this.movementController.canUnitAttack(this.selectedUnit)) {
          // Attack enemy
          this.attemptAttack(this.selectedUnit, clickedUnit);
        }
      } else {
        // Try to move
        if (this.movementController.canUnitMove(this.selectedUnit)) {
          this.attemptMove(this.selectedUnit, { x: tileX, y: tileY });
        }
      }
    } else {
      // No unit selected
      if (clickedUnit && this.canUnitSelect(clickedUnit)) {
        this.selectUnit(clickedUnit);
      }
    }
  }

  private canUnitSelect(unit: Unit): boolean {
    return unit.team === this.gameState.activeTeam && !unit.hasActivated && unit.stats.hp > 0;
  }

  private selectUnit(unit: Unit): void {
    this.selectedUnit = unit;
    this.movementController.showMovementRange(unit, this.gameState.units);
    this.updateUI();
  }

  private deselectUnit(): void {
    this.selectedUnit = null;
    this.movementController.clearHighlights();
    this.updateUI();
  }

  private attemptMove(unit: Unit, targetPos: Position): void {
    this.movementController.attemptMove(
      unit,
      targetPos,
      this.gameState.units,
      (movedUnit, wasDash) => {
        if (wasDash) {
          movedUnit.hasUsedMainAction = true;
        } else {
          movedUnit.hasUsedMovement = true;
        }

        if (this.isUnitTurnComplete(movedUnit)) {
          this.endUnitActivation(movedUnit);
        } else {
          this.movementController.showMovementRange(movedUnit, this.gameState.units);
          this.updateUI();
        }
      },
      interruptedUnit => {
        this.endUnitActivation(interruptedUnit);
      }
    );
  }

  private attemptAttack(attacker: Unit, defender: Unit): void {
    if (!this.movementController.canUnitAttack(attacker)) {
      return;
    }

    if (MovementEngine.isAdjacent(attacker.position, defender.position)) {
      this.movementController.clearHighlights();
      this.combatController.attemptAttack(attacker, defender, completedAttacker => {
        completedAttacker.hasUsedMainAction = true;

        if (this.isUnitTurnComplete(completedAttacker)) {
          this.endUnitActivation(completedAttacker);
        } else {
          this.movementController.showMovementRange(completedAttacker, this.gameState.units);
          this.updateUI();
        }
      });
    }
  }

  private isUnitTurnComplete(unit: Unit): boolean {
    return unit.hasUsedMovement && unit.hasUsedMainAction;
  }

  private endUnitActivation(unit: Unit): void {
    this.unitController.setUnitDimmed(unit, true);
    this.deselectUnit();

    const { roundEnded, gameEnded } = this.turnManager.completeUnitActivation(unit);

    if (roundEnded) {
      this.unitController.resetActivationVisuals(this.gameState.units);
    }

    if (gameEnded) {
      this.endGame();
    }

    this.updateUI();
  }

  private endGame(): void {
    this.gameState.winner = ObjectiveController.determineWinner(this.gameState.objectives);
    this.scene.start('ResultsScene', { winner: this.gameState.winner });
  }

  private loadMapDefinition(): MapDefinition {
    const cachedMap = this.cache.tilemap.get('basicMap') as unknown;
    const mapData = this.extractMapData(cachedMap);
    const tileDefs = this.cache.json.get('tileDefs') as TileDefinition[] | undefined;

    if (!tileDefs) {
      throw new Error('Tile definitions failed to load.');
    }

    const mapDefinition = MapLoader.fromTiledJson(mapData, tileDefs);

    this.tileDefLookup.clear();
    tileDefs.forEach(def => this.tileDefLookup.set(def.gid, def));

    return mapDefinition;
  }

  private extractMapData(cachedMap: unknown): MapData {
    if (cachedMap && typeof cachedMap === 'object') {
      if ('layers' in cachedMap) {
        return cachedMap as MapData;
      }
      if ('data' in cachedMap && cachedMap.data && typeof cachedMap.data === 'object' && 'layers' in cachedMap.data) {
        return cachedMap.data as MapData;
      }
    }

    throw new Error('Map data is missing or invalid.');
  }
}