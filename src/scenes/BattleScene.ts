/**
 * BattleScene
 * Main gameplay scene with map, units, and turn-based interaction
 */

import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Unit, GameState, Objective, Position } from '@engine/types';
import { TurnManager } from '@engine/TurnManager';
import { MovementEngine } from '@engine/MovementEngine';
import { CombatResolver } from '@engine/CombatResolver';
import { ObjectiveController } from '@engine/ObjectiveController';

export class BattleScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private gameState!: GameState;
  private turnManager!: TurnManager;
  private unitSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private objectiveSprites: Phaser.GameObjects.Graphics[] = [];
  private selectedUnit: Unit | null = null;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private uiText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    // Create tilemap
    this.map = this.make.tilemap({ key: 'map01' });
    const tileset = this.map.addTilesetImage('world', 'world-tileset');
    
    if (tileset) {
      this.map.createLayer('Ground', tileset, 0, 0);
    }

    // Initialize game state
    this.initializeGameState();
    
    // Create turn manager
    this.turnManager = new TurnManager(this.gameState);
    this.turnManager.startGame();

    // Create graphics for highlights
    this.highlightGraphics = this.add.graphics();

    // Place objectives
    this.createObjectives();

    // Place units
    this.createUnits();

    // Create UI
    this.createUI();

    // Enable input
    this.input.on('pointerdown', this.handleClick, this);

    this.updateUI();
  }

  private initializeGameState(): void {
    const blueTeamData = this.cache.json.get('blueTeam');
    const redTeamData = this.cache.json.get('redTeam');
    const objectivesData = this.cache.json.get('objectives');

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
        hasActivated: false
      });
    });

    // Create objectives
    const objectives: Objective[] = objectivesData.map((objData: any) => ({
      id: objData.id,
      position: { ...objData.position },
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

  private createObjectives(): void {
    this.gameState.objectives.forEach(objective => {
      const x = objective.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const y = objective.position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      
      const graphics = this.add.graphics();
      graphics.lineStyle(2, 0xffff00, 1);
      graphics.strokeCircle(x, y, 12);
      graphics.fillStyle(0xffff00, 0.3);
      graphics.fillCircle(x, y, 12);
      
      this.objectiveSprites.push(graphics);
    });
  }

  private createUnits(): void {
    this.gameState.units.forEach(unit => {
      const x = unit.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const y = unit.position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      
      const sprite = this.add.image(x, y, unit.spriteKey);
      sprite.setFrame(0); // Display first frame of spritesheet
      sprite.setDisplaySize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      sprite.setData('unit', unit);
      
      this.unitSprites.set(unit.id, sprite);
    });
  }

  private createUI(): void {
    this.uiText = this.add.text(10, 10, '', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 10 }
    });
  }

  private updateUI(): void {
    const round = this.gameState.currentRound;
    const activeTeam = this.gameState.activeTeam;
    const scores = ObjectiveController.getObjectiveScores(this.gameState.objectives);
    
    const text = [
      `Round: ${round}/${GameConfig.MAX_ROUNDS}`,
      `Active Team: ${activeTeam.toUpperCase()}`,
      `Blue Objectives: ${scores.get(GameConfig.TEAMS.BLUE)}`,
      `Red Objectives: ${scores.get(GameConfig.TEAMS.RED)}`
    ];

    if (this.selectedUnit) {
      text.push('', `Selected: ${this.selectedUnit.name}`, `HP: ${this.selectedUnit.stats.hp}/${this.selectedUnit.stats.maxHp}`);
    }

    this.uiText.setText(text.join('\n'));
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    const tileX = Math.floor(pointer.worldX / GameConfig.TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / GameConfig.TILE_SIZE);

    // Check if clicking on a unit
    const clickedUnit = this.getUnitAtPosition({ x: tileX, y: tileY });

    if (this.selectedUnit) {
      // Unit is already selected
      if (clickedUnit && clickedUnit === this.selectedUnit) {
        // Deselect
        this.deselectUnit();
      } else if (clickedUnit && clickedUnit.team !== this.selectedUnit.team) {
        // Attack enemy
        this.attemptAttack(this.selectedUnit, clickedUnit);
      } else {
        // Try to move
        this.attemptMove(this.selectedUnit, { x: tileX, y: tileY });
      }
    } else {
      // No unit selected
      if (clickedUnit && clickedUnit.team === this.gameState.activeTeam && !clickedUnit.hasActivated) {
        this.selectUnit(clickedUnit);
      }
    }
  }

  private selectUnit(unit: Unit): void {
    this.selectedUnit = unit;
    this.showMovementRange(unit);
    this.updateUI();
  }

  private deselectUnit(): void {
    this.selectedUnit = null;
    this.highlightGraphics.clear();
    this.updateUI();
  }

  private showMovementRange(unit: Unit): void {
    this.highlightGraphics.clear();

    // Get occupied positions
    const occupiedPositions = new Map<string, boolean>();
    this.gameState.units.forEach(u => {
      if (u.id !== unit.id && u.stats.hp > 0) {
        occupiedPositions.set(`${u.position.x},${u.position.y}`, true);
      }
    });

    // Get legal moves
    const legalMoves = MovementEngine.getLegalMoves(
      unit,
      occupiedPositions,
      GameConfig.MAP_WIDTH,
      GameConfig.MAP_HEIGHT
    );

    // Highlight tiles
    this.highlightGraphics.fillStyle(0x00ff00, 0.3);
    legalMoves.forEach(pos => {
      const x = pos.x * GameConfig.TILE_SIZE;
      const y = pos.y * GameConfig.TILE_SIZE;
      this.highlightGraphics.fillRect(x, y, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
    });

    // Highlight attackable enemies
    const adjacentPositions = MovementEngine.getAdjacentPositions(unit.position);
    this.highlightGraphics.fillStyle(0xff0000, 0.3);
    adjacentPositions.forEach(pos => {
      const enemy = this.getUnitAtPosition(pos);
      if (enemy && enemy.team !== unit.team) {
        const x = pos.x * GameConfig.TILE_SIZE;
        const y = pos.y * GameConfig.TILE_SIZE;
        this.highlightGraphics.fillRect(x, y, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      }
    });
  }

  private attemptMove(unit: Unit, targetPos: Position): void {
    // Get occupied positions
    const occupiedPositions = new Map<string, boolean>();
    this.gameState.units.forEach(u => {
      if (u.id !== unit.id && u.stats.hp > 0) {
        occupiedPositions.set(`${u.position.x},${u.position.y}`, true);
      }
    });

    // Check if move is legal
    const legalMoves = MovementEngine.getLegalMoves(
      unit,
      occupiedPositions,
      GameConfig.MAP_WIDTH,
      GameConfig.MAP_HEIGHT
    );

    const isLegal = legalMoves.some(pos => pos.x === targetPos.x && pos.y === targetPos.y);

    if (isLegal) {
      // Move unit
      unit.position = targetPos;
      
      // Update sprite
      const sprite = this.unitSprites.get(unit.id);
      if (sprite) {
        sprite.setPosition(
          targetPos.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2,
          targetPos.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2
        );
      }

      // End unit's turn
      this.endUnitActivation(unit);
    }
  }

  private attemptAttack(attacker: Unit, defender: Unit): void {
    if (MovementEngine.isAdjacent(attacker.position, defender.position)) {
      const result = CombatResolver.resolveAttack(attacker, defender);
      
      console.log(`${attacker.name} attacks ${defender.name}: ${result.hit ? 'HIT' : 'MISS'}${result.hit ? ` for ${result.damage} damage` : ''}`);

      if (result.targetDefeated) {
        // Remove defeated unit sprite
        const sprite = this.unitSprites.get(defender.id);
        if (sprite) {
          sprite.setAlpha(0.3);
        }
      }

      // End attacker's turn
      this.endUnitActivation(attacker);
    }
  }

  private endUnitActivation(unit: Unit): void {
    this.turnManager.activateUnit(unit);
    this.deselectUnit();

    const roundComplete = this.turnManager.isRoundComplete();
    if (roundComplete) {
      ObjectiveController.updateObjectiveControl(this.gameState.objectives, this.gameState.units);
      this.updateObjectiveVisuals();
    }

    this.turnManager.nextTeam();
    
    if (this.turnManager.isGameOver()) {
      this.endGame();
    }

    this.updateUI();
  }

  private updateObjectiveVisuals(): void {
    this.gameState.objectives.forEach((objective, index) => {
      const graphics = this.objectiveSprites[index];
      graphics.clear();
      
      const x = objective.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const y = objective.position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      
      let color = 0xffff00; // Neutral
      if (objective.controlledBy === GameConfig.TEAMS.BLUE) {
        color = 0x0000ff;
      } else if (objective.controlledBy === GameConfig.TEAMS.RED) {
        color = 0xff0000;
      }
      
      graphics.lineStyle(2, color, 1);
      graphics.strokeCircle(x, y, 12);
      graphics.fillStyle(color, 0.3);
      graphics.fillCircle(x, y, 12);
    });
  }

  private getUnitAtPosition(pos: Position): Unit | null {
    return this.gameState.units.find(
      u => u.position.x === pos.x && u.position.y === pos.y && u.stats.hp > 0
    ) || null;
  }

  private endGame(): void {
    this.gameState.winner = ObjectiveController.determineWinner(this.gameState.objectives);
    this.scene.start('ResultsScene', { winner: this.gameState.winner });
  }
}