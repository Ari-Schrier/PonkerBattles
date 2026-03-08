/**
 * BattleScene
 * Main gameplay scene with map, units, and turn-based interaction
 */

import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Unit, GameState, Objective, Position, MapData, MapDefinition, TileDefinition, TerrainCategory } from '@engine/types';
import { TurnManager } from '@engine/TurnManager';
import { MovementEngine } from '@engine/MovementEngine';
import { CombatResolver } from '@engine/CombatResolver';
import { ObjectiveController } from '@engine/ObjectiveController';
import { MapLoader } from '@data/maps/MapLoader';
import { AnimationManager } from '@engine/AnimationManager';

export class BattleScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private mapDefinition!: MapDefinition;
  private tileDefLookup: Map<number, TileDefinition> = new Map();
  private gameState!: GameState;
  private turnManager!: TurnManager;
  private unitSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private healthTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private objectiveSprites: Phaser.GameObjects.Graphics[] = [];
  private selectedUnit: Unit | null = null;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private uiText!: Phaser.GameObjects.Text;

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
    
    // Create turn manager
    this.turnManager = new TurnManager(this.gameState, () => {
      ObjectiveController.updateObjectiveControl(this.gameState.objectives, this.gameState.units);
      this.updateObjectiveVisuals();
    });
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
        currentDirection: 0, // Default to facing down
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

  private createObjectives(): void {
    this.gameState.objectives.forEach(objective => {
      const x = objective.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const y = objective.position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      
      const graphics = this.add.graphics();
      const radius = GameConfig.TILE_SIZE * 0.2;
      graphics.lineStyle(2, 0xffff00, 1);
      graphics.strokeCircle(x, y, radius);
      graphics.fillStyle(0xffff00, 0.3);
      graphics.fillCircle(x, y, radius);
      
      this.objectiveSprites.push(graphics);
    });
  }

  private createUnits(): void {
    this.gameState.units.forEach(unit => {
      const x = unit.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const y = unit.position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      
      const sprite = this.add.sprite(x, y, unit.spriteKey);
      sprite.setDisplaySize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      sprite.setData('unit', unit);
      sprite.disableInteractive();
      
      // Show idle animation for initial direction
      AnimationManager.playAnimation(sprite, unit.spriteKey, 'idle', unit.currentDirection);
      
      this.unitSprites.set(unit.id, sprite);

      // Create health text above unit
      const healthText = this.add.text(x, y - GameConfig.TILE_SIZE * 0.4, `${unit.stats.hp}/${unit.stats.maxHp}`, {
        fontSize: `${Math.max(12, Math.round(GameConfig.TILE_SIZE * 0.25))}px`,
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 2, y: 2 }
      });
      healthText.setOrigin(0.5, 0.5); // Center the text
      
      this.healthTexts.set(unit.id, healthText);
    });
  }

  private createUI(): void {
    this.uiText = this.add.text(10, 10, '', {
      fontSize: `${Math.max(14, Math.round(GameConfig.TILE_SIZE * 0.25))}px`,
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
      const movementStatus = this.selectedUnit.hasUsedMovement ? '✓' : 'Available';
      const mainActionStatus = this.selectedUnit.hasUsedMainAction ? '✓' : 'Available';
      
      text.push(
        '',
        `Selected: ${this.selectedUnit.name}`,
        `HP: ${this.selectedUnit.stats.hp}/${this.selectedUnit.stats.maxHp}`,
        `Movement: ${movementStatus}`,
        `Main Action: ${mainActionStatus}`
      );
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
        // If unit has used any actions, end their turn
        if (this.selectedUnit.hasUsedMovement || this.selectedUnit.hasUsedMainAction) {
          this.endUnitActivation(this.selectedUnit);
        } else {
          // Otherwise just deselect
          this.deselectUnit();
        }
      } else if (clickedUnit && clickedUnit.team !== this.selectedUnit.team) {
        if (this.canUnitAttack(this.selectedUnit)) {
          // Attack enemy
          this.attemptAttack(this.selectedUnit, clickedUnit);
        }
      } else {
        // Try to move
        if (this.canUnitMove(this.selectedUnit)) {
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

  private canUnitTakeMove(unit: Unit): boolean {
    return unit.stats.hp > 0 && !unit.hasUsedMovement;
  }

  private canUnitDash(unit: Unit): boolean {
    return unit.stats.hp > 0 && unit.hasUsedMovement && !unit.hasUsedMainAction;
  }

  private canUnitMove(unit: Unit): boolean {
    return this.canUnitTakeMove(unit) || this.canUnitDash(unit);
  }

  private canUnitAttack(unit: Unit): boolean {
    return unit.stats.hp > 0 && !unit.hasUsedMainAction;
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

    // Show movement highlights if movement action available
    if (this.canUnitTakeMove(unit)) {
      const legalMoves = MovementEngine.getLegalMoves(
        unit,
        occupiedPositions,
        this.mapDefinition.width,
        this.mapDefinition.height,
        this.getMovementOptions()
      );

      // Green highlights for normal movement
      this.highlightGraphics.fillStyle(0x00ff00, 0.3);
      legalMoves.forEach(pos => {
        const x = pos.x * GameConfig.TILE_SIZE;
        const y = pos.y * GameConfig.TILE_SIZE;
        this.highlightGraphics.fillRect(x, y, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      });
    }

    // Show dash highlights if movement used but main action available
    if (this.canUnitDash(unit)) {
      const dashMoves = MovementEngine.getLegalMoves(
        unit,
        occupiedPositions,
        this.mapDefinition.width,
        this.mapDefinition.height,
        this.getMovementOptions()
      );

      // Blue highlights for dash movement
      this.highlightGraphics.fillStyle(0x0099ff, 0.3);
      dashMoves.forEach(pos => {
        const x = pos.x * GameConfig.TILE_SIZE;
        const y = pos.y * GameConfig.TILE_SIZE;
        this.highlightGraphics.fillRect(x, y, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      });
    }

    // Show attackable enemies if main action available
    if (this.canUnitAttack(unit)) {
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
      this.mapDefinition.width,
      this.mapDefinition.height,
      this.getMovementOptions()
    );

    const isLegal = legalMoves.some(pos => pos.x === targetPos.x && pos.y === targetPos.y);

    if (isLegal) {
      // Find path from current position to target
      const path = MovementEngine.findPath(
        unit.position,
        targetPos,
        occupiedPositions,
        this.mapDefinition.width,
        this.mapDefinition.height,
        this.getMovementOptions()
      );

      if (!path || path.length === 0) {
        console.warn('No path found to destination');
        return;
      }

      // Determine if this is normal movement or dash
      const isDash = unit.hasUsedMovement && !unit.hasUsedMainAction;
      
      // Get sprite and health text
      const sprite = this.unitSprites.get(unit.id);
      const healthText = this.healthTexts.get(unit.id);
      
      if (!sprite) {
        return;
      }

      // Clear highlights during movement
      this.highlightGraphics.clear();
      
      // Animate along the path
      this.animateAlongPath(unit, path, sprite, healthText, () => {
        // Movement complete
        // Update unit position in game state
        unit.position = targetPos;
        
        // Mark appropriate action as used
        if (isDash) {
          unit.hasUsedMainAction = true;
        } else {
          unit.hasUsedMovement = true;
        }

        // Check if unit's turn is complete
        if (this.isUnitTurnComplete(unit)) {
          this.endUnitActivation(unit);
        } else {
          // Re-highlight available actions
          this.showMovementRange(unit);
          this.updateUI();
        }
      });
    }
  }

  /**
   * Animate a unit moving along a path, segment by segment
   */
  private animateAlongPath(
    unit: Unit,
    path: Position[],
    sprite: Phaser.GameObjects.Sprite,
    healthText: Phaser.GameObjects.Text | undefined,
    onComplete: () => void
  ): void {
    // Path includes the starting position, so we start from index 1
    let currentIndex = 1;

    const animateNextSegment = () => {
      if (currentIndex >= path.length) {
        // Path complete - show idle animation
        AnimationManager.playAnimation(sprite, unit.spriteKey, 'idle', unit.currentDirection);
        onComplete();
        return;
      }

      const from = path[currentIndex - 1];
      const to = path[currentIndex];

      // Calculate direction for this segment
      const direction = AnimationManager.getDirection(from, to);
      unit.currentDirection = direction;

      // Play walk animation in the new direction
      AnimationManager.playAnimation(sprite, unit.spriteKey, 'walk', direction);

      // Calculate target position in pixels
      const targetX = to.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const targetY = to.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;

      // Tween sprite to next position
      this.tweens.add({
        targets: sprite,
        x: targetX,
        y: targetY,
        duration: GameConfig.MOVEMENT_DURATION_MS,
        ease: 'Linear',
        onComplete: () => {
          currentIndex++;
          animateNextSegment();
        }
      });

      // Tween health text alongside sprite
      if (healthText) {
        this.tweens.add({
          targets: healthText,
          x: targetX,
          y: targetY - GameConfig.TILE_SIZE * 0.4,
          duration: GameConfig.MOVEMENT_DURATION_MS,
          ease: 'Linear'
        });
      }
    };

    animateNextSegment();
  }

  private attemptAttack(attacker: Unit, defender: Unit): void {
    if (!this.canUnitAttack(attacker)) {
      return;
    }

    if (MovementEngine.isAdjacent(attacker.position, defender.position)) {
      // Calculate direction from attacker to defender
      const direction = AnimationManager.getDirection(attacker.position, defender.position);
      attacker.currentDirection = direction;
      
      const attackerSprite = this.unitSprites.get(attacker.id);
      const defenderSprite = this.unitSprites.get(defender.id);
      
      if (!attackerSprite || !defenderSprite) {
        return;
      }

      // Clear highlights during combat
      this.highlightGraphics.clear();
      
      // Play attack animation on attacker
      AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'attack', direction);
      
      // Wait for attack animation to complete, then resolve combat
      attackerSprite.once('animationcomplete', () => {
        // Resolve combat
        const result = CombatResolver.resolveAttack(attacker, defender);
        
        console.log(`${attacker.name} attacks ${defender.name}: ${result.hit ? 'HIT' : 'MISS'}${result.hit ? ` for ${result.damage} damage` : ''}`);

        if (result.hit) {
          defender.stats.hp = Math.max(0, defender.stats.hp - result.damage);
          
          // Update defender's health text
          const defenderHealthText = this.healthTexts.get(defender.id);
          if (defenderHealthText) {
            defenderHealthText.setText(`${defender.stats.hp}/${defender.stats.maxHp}`);
          }

          // Calculate defender's direction (face attacker)
          const defenderDirection = AnimationManager.getDirection(defender.position, attacker.position);
          defender.currentDirection = defenderDirection;

          if (result.targetDefeated) {
            // Play death animation
            AnimationManager.playAnimation(defenderSprite, defender.spriteKey, 'death', defenderDirection);
            
            // Wait for death animation to complete
            defenderSprite.once('animationcomplete', () => {
              // Death animation complete, attacker returns to idle
              AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
              
              // Mark main action as used
              attacker.hasUsedMainAction = true;

              // Check if unit's turn is complete
              if (this.isUnitTurnComplete(attacker)) {
                this.endUnitActivation(attacker);
              } else {
                // Re-highlight available actions
                this.showMovementRange(attacker);
                this.updateUI();
              }
            });
          } else {
            // Play damage animation on defender
            AnimationManager.playAnimation(defenderSprite, defender.spriteKey, 'damage', defenderDirection);
            
            // Wait for damage animation to complete
            defenderSprite.once('animationcomplete', () => {
              // Return defender to idle
              AnimationManager.playAnimation(defenderSprite, defender.spriteKey, 'idle', defenderDirection);
              
              // Return attacker to idle
              AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
              
              // Mark main action as used
              attacker.hasUsedMainAction = true;

              // Check if unit's turn is complete
              if (this.isUnitTurnComplete(attacker)) {
                this.endUnitActivation(attacker);
              } else {
                // Re-highlight available actions
                this.showMovementRange(attacker);
                this.updateUI();
              }
            });
          }
        } else {
          // Miss - just return attacker to idle
          AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
          
          // Mark main action as used
          attacker.hasUsedMainAction = true;

          // Check if unit's turn is complete
          if (this.isUnitTurnComplete(attacker)) {
            this.endUnitActivation(attacker);
          } else {
            // Re-highlight available actions
            this.showMovementRange(attacker);
            this.updateUI();
          }
        }
      });
    }
  }

  private isUnitTurnComplete(unit: Unit): boolean {
    return unit.hasUsedMovement && unit.hasUsedMainAction;
  }

  private setUnitDimmed(unit: Unit, dimmed: boolean): void {
    const sprite = this.unitSprites.get(unit.id);
    const healthText = this.healthTexts.get(unit.id);
    if (!sprite) {
      return;
    }

    if (unit.stats.hp <= 0) {
      sprite.setAlpha(1);
      if (healthText) {
        healthText.setAlpha(1);
      }
      return;
    }

    const alpha = dimmed ? 0.5 : 1;
    sprite.setAlpha(alpha);
    if (healthText) {
      healthText.setAlpha(alpha);
    }
  }

  private resetActivationVisuals(): void {
    this.gameState.units.forEach(unit => {
      this.setUnitDimmed(unit, false);
    });
  }

  private endUnitActivation(unit: Unit): void {
    this.setUnitDimmed(unit, true);
    this.deselectUnit();

    const { roundEnded, gameEnded } = this.turnManager.completeUnitActivation(unit);

    if (roundEnded) {
      this.resetActivationVisuals();
    }

    if (gameEnded) {
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
      const radius = GameConfig.TILE_SIZE * 0.2;
      graphics.strokeCircle(x, y, radius);
      graphics.fillStyle(0xffff00, 0.3);
      graphics.fillCircle(x, y, radius);
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

  private getMovementOptions(): { isWalkable?: (pos: Position) => boolean; getMoveCost?: (pos: Position) => number } {
    return {
      isWalkable: pos => {
        const def = this.getLogicalTileDef(pos);
        if (!def) {
          return true;
        }
        return this.isWalkable(def.terrainType);
      },
      getMoveCost: pos => {
        const def = this.getLogicalTileDef(pos);
        if (!def) {
          return 1;
        }
        return this.getMoveCost(def.terrainType);
      }
    };
  }

  private getLogicalTileDef(pos: Position): TileDefinition | undefined {
    const index = pos.y * this.mapDefinition.width + pos.x;
    const overlayGid = this.mapDefinition.overlayLayer[index];
    const groundGid = this.mapDefinition.groundLayer[index];
    const gid = overlayGid && overlayGid !== 0 ? overlayGid : groundGid;
    return gid ? this.tileDefLookup.get(gid) : undefined;
  }

  private isWalkable(category: TerrainCategory): boolean {
    return category === 'land' || category === 'forest';
  }

  private getMoveCost(category: TerrainCategory): number {
    switch (category) {
      case 'forest':
        return 2;
      case 'cliff':
      case 'water':
        return Number.POSITIVE_INFINITY;
      case 'land':
      default:
        return 1;
    }
  }
}