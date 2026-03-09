import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { MapDefinition, Position, Unit } from '@engine/types';
import { Direction } from '@engine/types';
import { MovementEngine } from '@engine/MovementEngine';
import { CombatResolver } from '@engine/CombatResolver';
import { AnimationManager } from '@engine/AnimationManager';
import type { TerrainRules } from '@engine/TerrainRules';
import type { UnitController } from './UnitController';
import type { ActionQueue, ActionStep } from './ActionQueue';

type MovementCompleteCallback = (unit: Unit, wasDash: boolean) => void;
type MovementInterruptedCallback = (unit: Unit) => void;

export class MovementController {
  private scene: Phaser.Scene;
  private unitController: UnitController;
  private actionQueue: ActionQueue;
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private mapDefinition: MapDefinition;
  private terrainRules: TerrainRules;

  constructor(
    scene: Phaser.Scene,
    unitController: UnitController,
    mapDefinition: MapDefinition,
    terrainRules: TerrainRules,
    actionQueue: ActionQueue
  ) {
    this.scene = scene;
    this.unitController = unitController;
    this.mapDefinition = mapDefinition;
    this.terrainRules = terrainRules;
    this.actionQueue = actionQueue;
    this.highlightGraphics = this.scene.add.graphics();
  }

  clearHighlights(): void {
    this.highlightGraphics.clear();
  }

  showMovementRange(unit: Unit, units: Unit[]): void {
    this.highlightGraphics.clear();

    const occupiedPositions = this.getOccupiedPositions(units, unit.id);

    if (this.canUnitTakeMove(unit)) {
      const legalMoves = MovementEngine.getLegalMoves(
        unit,
        occupiedPositions,
        this.mapDefinition.width,
        this.mapDefinition.height,
        this.getMovementOptions()
      );

      this.highlightGraphics.fillStyle(0x00ff00, 0.3);
      legalMoves.forEach(pos => this.fillTile(pos));
    }

    if (this.canUnitDash(unit)) {
      const dashMoves = MovementEngine.getLegalMoves(
        unit,
        occupiedPositions,
        this.mapDefinition.width,
        this.mapDefinition.height,
        this.getMovementOptions()
      );

      this.highlightGraphics.fillStyle(0x0099ff, 0.3);
      dashMoves.forEach(pos => this.fillTile(pos));
    }

    if (this.canUnitAttack(unit)) {
      const adjacentPositions = MovementEngine.getAdjacentPositions(unit.position);
      this.highlightGraphics.fillStyle(0xff0000, 0.3);
      adjacentPositions.forEach(pos => {
        const enemy = this.unitController.getUnitAtPosition(units, pos);
        if (enemy && enemy.team !== unit.team) {
          this.fillTile(pos);
        }
      });
    }
  }

  attemptMove(
    unit: Unit,
    targetPos: Position,
    units: Unit[],
    onComplete: MovementCompleteCallback,
    onInterrupted: MovementInterruptedCallback
  ): void {
    if (this.actionQueue.isRunning) {
      return;
    }

    const occupiedPositions = this.getOccupiedPositions(units, unit.id);
    const legalMoves = MovementEngine.getLegalMoves(
      unit,
      occupiedPositions,
      this.mapDefinition.width,
      this.mapDefinition.height,
      this.getMovementOptions()
    );
    const isLegal = legalMoves.some(pos => pos.x === targetPos.x && pos.y === targetPos.y);

    if (!isLegal) {
      return;
    }

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

    const isDash = unit.hasUsedMovement && !unit.hasUsedMainAction;
    const sprite = this.unitController.getSprite(unit.id);
    const healthText = this.unitController.getHealthText(unit.id);

    if (!sprite) {
      return;
    }

    this.highlightGraphics.clear();

    const steps: ActionStep[] = [];
    let unitKilled = false;

    const startPos = path[0];
    const endPos = path[path.length - 1];
    const enemiesWithAoO = this.getEnemiesWithAttackOfOpportunity(unit, startPos, endPos, units);

    enemiesWithAoO.forEach(enemy => {
      steps.push(() => this.processAttackOfOpportunity(enemy, unit, sprite, healthText, () => {
        unitKilled = true;
      }));
    });

    steps.push(...this.buildMovementSteps(unit, path, sprite, healthText, () => unitKilled));

    steps.push(() => {
      if (unitKilled) {
        onInterrupted(unit);
        return Promise.resolve();
      }

      unit.position = targetPos;
      AnimationManager.playAnimation(sprite, unit.spriteKey, 'idle', unit.currentDirection);
      onComplete(unit, isDash);
      return Promise.resolve();
    });

    this.actionQueue.enqueueAll(steps);
  }

  canUnitMove(unit: Unit): boolean {
    return this.canUnitTakeMove(unit) || this.canUnitDash(unit);
  }

  canUnitAttack(unit: Unit): boolean {
    return unit.stats.hp > 0 && !unit.hasUsedMainAction;
  }

  private canUnitTakeMove(unit: Unit): boolean {
    return unit.stats.hp > 0 && !unit.hasUsedMovement;
  }

  private canUnitDash(unit: Unit): boolean {
    return unit.stats.hp > 0 && unit.hasUsedMovement && !unit.hasUsedMainAction;
  }

  private buildMovementSteps(
    unit: Unit,
    path: Position[],
    sprite: Phaser.GameObjects.Sprite,
    healthText: Phaser.GameObjects.Text | undefined,
    wasKilled: () => boolean
  ): ActionStep[] {
    const steps: ActionStep[] = [];

    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1];
      const to = path[index];

      steps.push(() => new Promise<void>(resolve => {
        if (wasKilled()) {
          resolve();
          return;
        }
        this.executeMovementSegment(unit, from, to, sprite, healthText, resolve);
      }));
    }

    return steps;
  }

  private executeMovementSegment(
    unit: Unit,
    from: Position,
    to: Position,
    sprite: Phaser.GameObjects.Sprite,
    healthText: Phaser.GameObjects.Text | undefined,
    onComplete: () => void
  ): void {
    const direction = AnimationManager.getDirection(from, to);
    unit.currentDirection = direction;

    AnimationManager.playAnimation(sprite, unit.spriteKey, 'walk', direction);

    const targetX = to.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
    const targetY = to.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;

    this.scene.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      duration: GameConfig.MOVEMENT_DURATION_MS,
      ease: 'Linear',
      onComplete
    });

    if (healthText) {
      this.scene.tweens.add({
        targets: healthText,
        x: targetX,
        y: targetY - GameConfig.TILE_SIZE * 0.4,
        duration: GameConfig.MOVEMENT_DURATION_MS,
        ease: 'Linear'
      });
    }
  }

  private processAttackOfOpportunity(
    attacker: Unit,
    movingUnit: Unit,
    movingSprite: Phaser.GameObjects.Sprite,
    movingHealthText: Phaser.GameObjects.Text | undefined,
    onKilled: () => void
  ): Promise<void> {
    return new Promise(resolve => {
      if (movingUnit.stats.hp <= 0) {
        resolve();
        return;
      }

      const attackerSprite = this.unitController.getSprite(attacker.id);
      if (!attackerSprite) {
        resolve();
        return;
      }

      console.log(`${attacker.name} gets an attack of opportunity on ${movingUnit.name}!`);

      const direction = AnimationManager.getDirection(attacker.position, movingUnit.position);
      attacker.currentDirection = direction;

      AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'attack', direction);

      attackerSprite.once('animationcomplete', () => {
        const result = CombatResolver.resolveAttack(attacker, movingUnit);

        console.log(`Attack of Opportunity: ${result.hit ? 'HIT' : 'MISS'}${result.hit ? ` for ${result.damage} damage` : ''}`);

        if (result.hit) {
          movingUnit.stats.hp = Math.max(0, movingUnit.stats.hp - result.damage);
          this.unitController.updateHealthText(movingUnit);

          const defenderDirection = AnimationManager.getDirection(movingUnit.position, attacker.position);
          movingUnit.currentDirection = defenderDirection;

          if (result.targetDefeated) {
            AnimationManager.playAnimation(movingSprite, movingUnit.spriteKey, 'death', defenderDirection);

            movingSprite.once('animationcomplete', () => {
              AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
              movingSprite.setFrame(24);
              onKilled();
              resolve();
            });
          } else {
            AnimationManager.playAnimation(movingSprite, movingUnit.spriteKey, 'damage', defenderDirection);

            movingSprite.once('animationcomplete', () => {
              AnimationManager.playAnimation(movingSprite, movingUnit.spriteKey, 'idle', defenderDirection);
              AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
              resolve();
            });
          }
        } else {
          const originalX = movingSprite.x;
          const originalY = movingSprite.y;
          const dodgeOffset = this.calculateDodgeOffset(direction);

          this.scene.tweens.add({
            targets: movingSprite,
            x: originalX + dodgeOffset.x,
            y: originalY + dodgeOffset.y,
            duration: GameConfig.DODGE_DURATION_MS,
            ease: 'Quad.easeOut',
            onComplete: () => {
              this.scene.tweens.add({
                targets: movingSprite,
                x: originalX,
                y: originalY,
                duration: GameConfig.DODGE_DURATION_MS,
                ease: 'Quad.easeIn',
                onComplete: () => {
                  AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
                  resolve();
                }
              });

              if (movingHealthText) {
                this.scene.tweens.add({
                  targets: movingHealthText,
                  x: originalX,
                  y: originalY - GameConfig.TILE_SIZE * 0.4,
                  duration: GameConfig.DODGE_DURATION_MS,
                  ease: 'Quad.easeIn'
                });
              }
            }
          });

          if (movingHealthText) {
            this.scene.tweens.add({
              targets: movingHealthText,
              x: originalX + dodgeOffset.x,
              y: originalY + dodgeOffset.y - GameConfig.TILE_SIZE * 0.4,
              duration: GameConfig.DODGE_DURATION_MS,
              ease: 'Quad.easeOut'
            });
          }
        }
      });
    });
  }

  private getEnemiesWithAttackOfOpportunity(
    movingUnit: Unit,
    fromPos: Position,
    toPos: Position,
    units: Unit[]
  ): Unit[] {
    const enemiesWithAoO: Unit[] = [];
    const enemies = units.filter(u => u.team !== movingUnit.team && u.stats.hp > 0);

    for (const enemy of enemies) {
      const wasAdjacent = MovementEngine.isAdjacent(enemy.position, fromPos);
      const willBeAdjacent = MovementEngine.isAdjacent(enemy.position, toPos);

      if (wasAdjacent && !willBeAdjacent) {
        enemiesWithAoO.push(enemy);
      }
    }

    return enemiesWithAoO;
  }

  private calculateDodgeOffset(attackDirection: Direction): { x: number; y: number } {
    const offset = GameConfig.DODGE_OFFSET_PIXELS;

    switch (attackDirection) {
      case Direction.Down:
      case Direction.Up:
        return { x: offset, y: 0 };
      case Direction.DownRight:
        return { x: offset, y: -offset };
      case Direction.Right:
      case Direction.Left:
        return { x: 0, y: -offset };
      case Direction.UpRight:
        return { x: offset, y: offset };
      case Direction.UpLeft:
        return { x: -offset, y: offset };
      case Direction.DownLeft:
        return { x: -offset, y: -offset };
      default:
        return { x: offset, y: 0 };
    }
  }

  private getMovementOptions(): { isWalkable?: (pos: Position) => boolean; getMoveCost?: (pos: Position) => number } {
    return {
      isWalkable: pos => this.terrainRules.isWalkable(pos),
      getMoveCost: pos => this.terrainRules.getMoveCost(pos)
    };
  }

  private getOccupiedPositions(units: Unit[], unitId: string): Map<string, boolean> {
    const occupiedPositions = new Map<string, boolean>();
    units.forEach(u => {
      if (u.id !== unitId && u.stats.hp > 0) {
        occupiedPositions.set(`${u.position.x},${u.position.y}`, true);
      }
    });
    return occupiedPositions;
  }

  private fillTile(pos: Position): void {
    const x = pos.x * GameConfig.TILE_SIZE;
    const y = pos.y * GameConfig.TILE_SIZE;
    this.highlightGraphics.fillRect(x, y, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
  }
}