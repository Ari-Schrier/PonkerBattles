import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Unit } from '@engine/types';
import { CombatResolver } from '@engine/CombatResolver';
import { AnimationManager } from '@engine/AnimationManager';
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
      const direction = AnimationManager.getDirection(attacker.position, defender.position);
      attacker.currentDirection = direction;
      AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'attack', direction);

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

    const direction = AnimationManager.getDirection(attacker.position, defender.position);

    if (attackResult.hit) {
      defender.stats.hp = Math.max(0, defender.stats.hp - attackResult.damage);
      this.unitController.updateHealthText(defender);

      const defenderDirection = AnimationManager.getDirection(defender.position, attacker.position);
      defender.currentDirection = defenderDirection;

      if (attackResult.targetDefeated) {
        AnimationManager.playAnimation(defenderSprite, defender.spriteKey, 'death', defenderDirection);

        return new Promise(resolve => {
          defenderSprite.once('animationcomplete', () => {
            AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
            resolve();
          });
        });
      }

      AnimationManager.playAnimation(defenderSprite, defender.spriteKey, 'damage', defenderDirection);

      return new Promise(resolve => {
        defenderSprite.once('animationcomplete', () => {
          AnimationManager.playAnimation(defenderSprite, defender.spriteKey, 'idle', defenderDirection);
          AnimationManager.playAnimation(attackerSprite, attacker.spriteKey, 'idle', direction);
          resolve();
        });
      });
    }

    return this.playDodgeAnimation(attackerSprite, defenderSprite, direction, defender);
  }

  private playDodgeAnimation(
    attackerSprite: Phaser.GameObjects.Sprite,
    defenderSprite: Phaser.GameObjects.Sprite,
    attackDirection: number,
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
              AnimationManager.playAnimation(attackerSprite, attackerSprite.texture.key, 'idle', attackDirection);
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

  private calculateDodgeOffset(attackDirection: number): { x: number; y: number } {
    const offset = GameConfig.DODGE_OFFSET_PIXELS;

    switch (attackDirection) {
      case 0:
      case 4:
        return { x: offset, y: 0 };
      case 1:
        return { x: offset, y: -offset };
      case 2:
      case 6:
        return { x: 0, y: -offset };
      case 3:
        return { x: offset, y: offset };
      case 5:
        return { x: -offset, y: offset };
      case 7:
        return { x: -offset, y: -offset };
      default:
        return { x: offset, y: 0 };
    }
  }
}