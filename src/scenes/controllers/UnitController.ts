import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Position, Unit } from '@engine/types';
import { AnimationManager } from '@engine/AnimationManager';

export class UnitController {
  private scene: Phaser.Scene;
  private unitSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private healthTexts: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createUnits(units: Unit[]): void {
    units.forEach(unit => {
      const x = unit.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const y = unit.position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;

      const sprite = this.scene.add.sprite(x, y, unit.spriteKey);
      sprite.setDisplaySize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      sprite.setData('unit', unit);
      sprite.disableInteractive();

      // Show idle animation for initial direction
      AnimationManager.playAnimation(sprite, unit.spriteKey, 'idle', unit.currentDirection);

      this.unitSprites.set(unit.id, sprite);

      // Create health text above unit
      const healthText = this.scene.add.text(
        x,
        y - GameConfig.TILE_SIZE * 0.4,
        `${unit.stats.hp}/${unit.stats.maxHp}`,
        {
          fontSize: `${Math.max(12, Math.round(GameConfig.TILE_SIZE * 0.25))}px`,
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { x: 2, y: 2 }
        }
      );
      healthText.setOrigin(0.5, 0.5);

      this.healthTexts.set(unit.id, healthText);
    });
  }

  getSprite(unitId: string): Phaser.GameObjects.Sprite | undefined {
    return this.unitSprites.get(unitId);
  }

  getHealthText(unitId: string): Phaser.GameObjects.Text | undefined {
    return this.healthTexts.get(unitId);
  }

  updateHealthText(unit: Unit): void {
    const healthText = this.healthTexts.get(unit.id);
    if (healthText) {
      healthText.setText(`${unit.stats.hp}/${unit.stats.maxHp}`);
    }
  }

  getUnitAtPosition(units: Unit[], position: Position): Unit | null {
    return (
      units.find(
        unit => unit.position.x === position.x && unit.position.y === position.y && unit.stats.hp > 0
      ) || null
    );
  }

  setUnitDimmed(unit: Unit, dimmed: boolean): void {
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

  resetActivationVisuals(units: Unit[]): void {
    units.forEach(unit => {
      this.setUnitDimmed(unit, false);
    });
  }
}