/**
 * BattleScene
 * Main gameplay scene with map, units, and turn-based interaction
 */

import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { GameState, MapData, MapDefinition, Objective, TileDefinition, Unit } from '@engine/types';
import { Direction } from '@engine/types';
import { TurnManager } from '@engine/TurnManager';
import { ObjectiveController } from '@engine/ObjectiveController';
import { MapLoader } from '@data/maps/MapLoader';
import { TerrainRules } from '@engine/TerrainRules';
import { UnitController } from './controllers/UnitController';
import { UIController } from './controllers/UIController';
import { MovementController } from './controllers/MovementController';
import { CombatController } from './controllers/CombatController';
import { AbilityController } from './controllers/AbilityController';
import { StatusEffectController } from './controllers/StatusEffectController';
import { ActionMenuController } from './controllers/ActionMenuController';
import { ActionQueue } from './controllers/ActionQueue';
import { GameFlowController } from './controllers/GameFlowController';
import { InputController } from './controllers/InputController';

export class BattleScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private mapDefinition!: MapDefinition;
  private tileDefLookup: Map<number, TileDefinition> = new Map();
  private gameState!: GameState;
  private turnManager!: TurnManager;
  private unitController!: UnitController;
  private uiController!: UIController;
  private movementController!: MovementController;
  private combatController!: CombatController;
  private abilityController!: AbilityController;
  private statusEffectController!: StatusEffectController;
  private actionMenuController!: ActionMenuController;
  private gameFlowController!: GameFlowController;
  private inputController!: InputController;
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
    this.abilityController = new AbilityController(
      this,
      this.unitController,
      this.actionQueue,
      this.mapDefinition
    );
    this.abilityController.initialize();
    this.statusEffectController = new StatusEffectController(
      this.unitController,
      this.abilityController,
      this.actionQueue
    );
    this.actionMenuController = new ActionMenuController(this);

    // Create turn manager
    this.turnManager = new TurnManager(this.gameState, () => {
      ObjectiveController.updateObjectiveControl(this.gameState.objectives, this.gameState.units);
      this.uiController.updateObjectiveVisuals(this.gameState);
    });
    this.turnManager.startGame();

    this.gameFlowController = new GameFlowController(
      this,
      this.unitController,
      this.statusEffectController,
      this.turnManager
    );

    this.inputController = new InputController(
      this.unitController,
      this.movementController,
      this.combatController,
      this.abilityController,
      this.actionMenuController,
      this.gameFlowController,
      (selectedUnit) => this.updateUI(selectedUnit)
    );

    // Place objectives
    this.uiController.createObjectives(this.gameState);

    // Place units
    this.unitController.createUnits(this.gameState.units);

    // Create UI
    this.uiController.createUI();

    // Enable input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.inputController.handlePointerDown(pointer, this.gameState);
    });

    this.updateUI(null);
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
        hasUsedMainAction: false,
        abilities: Array.isArray(unitData.abilities)
          ? unitData.abilities.map((definitionId: string) => ({
              definitionId,
              triggerCount: 0
            }))
          : undefined
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

  update(): void {
    this.statusEffectController.processRoundEffects(this.gameState);
  }

  private updateUI(selectedUnit: Unit | null): void {
    if (selectedUnit) {
      const movementStatus = selectedUnit.hasUsedMovement ? '✓' : 'Available';
      const mainActionStatus = selectedUnit.hasUsedMainAction ? '✓' : 'Available';

      this.uiController.updateUI(
        this.gameState,
        selectedUnit.name,
        `${selectedUnit.stats.hp}/${selectedUnit.stats.maxHp}`,
        movementStatus,
        mainActionStatus
      );
    } else {
      this.uiController.updateUI(this.gameState);
    }
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