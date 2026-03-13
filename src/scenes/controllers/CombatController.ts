import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Unit } from '@engine/types';
import { Direction } from '@engine/types';
import { CombatResolver } from '@engine/CombatResolver';
import { DirectionUtils } from '@engine/utils/DirectionUtils';
import { AnimationHelper } from '../utils/AnimationHelper';
import type { UnitController } from './UnitController';
import type { ActionQueue, ActionStep } from './ActionQueue';

type CombatCompleteCallback = (attacker: Unit) => void;

export class CombatController {
  private scene: Phaser.Scene;
  private unitController: UnitController;
  private actionQueue: ActionQueue;

  constructor(scene: Phaser.Scene, unitController: UnitController, actionQueue: ActionQueue) {
    this.scene = scene;
    this.unitController = unitController;
    this.actionQueue = actionQueue;
  }

  attemptAttack(attacker: Unit, defender: Unit, onComplete: CombatCompleteCallback): void {
    if (this.actionQueue.isRunning) {
      return;
    }

    const attackerSprite = this.unitController.getSprite(attacker.id);
    const defenderSprite = this.unitController.getSprite(defender.id);

    if (!attackerSprite || !defenderSprite) {
      return;
    }

    const steps: ActionStep[] = [];
    let attackResult: ReturnType<typeof CombatResolver.resolveAttack> | null = null;

    steps.push(() => {
      const direction = DirectionUtils.getDirection(attacker.position, defender.position);
      attacker.currentDirection = direction;
      AnimationHelper.playAnimation(attackerSprite, attacker.spriteKey, 'attack', direction);

      return new Promise(resolve => {
        attackerSprite.once('animationcomplete', resolve);
      });
    });

    steps.push(() => {
      attackResult = CombatResolver.resolveAttack(attacker, defender);
      console.log(
        `${attacker.name} attacks ${defender.name}: ${attackResult.hit ? 'HIT' : 'MISS'}` +
          `${attackResult.hit ? ` for ${attackResult.damage} damage` : ''}`
      );
      return Promise.resolve();
    });

    steps.push(() => this.playResultAnimation(attacker, defender, attackerSprite, defenderSprite, attackResult));

    steps.push(() => {
      onComplete(attacker);
      return Promise.resolve();
    });

    this.actionQueue.enqueueAll(steps);
  }

  private playResultAnimation(
    attacker: Unit,
    defender: Unit,
    attackerSprite: Phaser.GameObjects.Sprite,
    defenderSprite: Phaser.GameObjects.Sprite,
    attackResult: ReturnType<typeof CombatResolver.resolveAttack> | null
  ): Promise<void> {
    if (!attackResult) {
      return Promise.resolve();
    }

    const direction = DirectionUtils.getDirection(attacker.position, defender.position);

    if (attackResult.hit) {
      defender.stats.hp = Math.max(0, defender.stats.hp - attackResult.damage);
      this.unitController.updateHealthText(defender);

      const defenderDirection = DirectionUtils.getDirection(defender.position, attacker.position);
      defender.currentDirection = defenderDirection;

      if (attackResult.targetDefeated) {
        AnimationHelper.playAnimation(defenderSprite, defender.spriteKey, 'death', defenderDirection);

        return new Promise(resolve => {
          defenderSprite.once('animationcomplete', () => {
            AnimationHelper.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
            resolve();
          });
        });
      }

      AnimationHelper.playAnimation(defenderSprite, defender.spriteKey, 'damage', defenderDirection);

      return new Promise(resolve => {
        defenderSprite.once('animationcomplete', () => {
          AnimationHelper.playAnimation(defenderSprite, defender.spriteKey, 'idle', defenderDirection);
          AnimationHelper.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
          resolve();
        });
      });
    }

    return this.playDodgeAnimation(attackerSprite, defenderSprite, direction, defender);
  }

  private playDodgeAnimation(
    attackerSprite: Phaser.GameObjects.Sprite,
    defenderSprite: Phaser.GameObjects.Sprite,
    attackDirection: Direction,
    defender: Unit
  ): Promise<void> {
    return new Promise(resolve => {
      const defenderHealthText = this.unitController.getHealthText(defender.id);

      const originalX = defenderSprite.x;
      const originalY = defenderSprite.y;
      const dodgeOffset = this.calculateDodgeOffset(attackDirection);

      this.scene.tweens.add({
        targets: defenderSprite,
        x: originalX + dodgeOffset.x,
        y: originalY + dodgeOffset.y,
        duration: GameConfig.DODGE_DURATION_MS,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: defenderSprite,
            x: originalX,
            y: originalY,
            duration: GameConfig.DODGE_DURATION_MS,
            ease: 'Quad.easeIn',
            onComplete: () => {
              AnimationHelper.playAnimation(attackerSprite, attackerSprite.texture.key, 'idle', attackDirection);
              resolve();
            }
          });

          if (defenderHealthText) {
            this.scene.tweens.add({
              targets: defenderHealthText,
              x: originalX,
              y: originalY - GameConfig.TILE_SIZE * 0.4,
              duration: GameConfig.DODGE_DURATION_MS,
              ease: 'Quad.easeIn'
            });
          }
        }
      });

      if (defenderHealthText) {
        this.scene.tweens.add({
          targets: defenderHealthText,
          x: originalX + dodgeOffset.x,
          y: originalY + dodgeOffset.y - GameConfig.TILE_SIZE * 0.4,
          duration: GameConfig.DODGE_DURATION_MS,
          ease: 'Quad.easeOut'
        });
      }
    });
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
}