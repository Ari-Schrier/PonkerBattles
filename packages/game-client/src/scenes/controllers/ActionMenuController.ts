import Phaser from 'phaser';
import { GameConfig } from '@battlegame/game-core';
import type { Unit } from '@battlegame/game-core';
import type { AbilityDefinition } from '@battlegame/game-core';

export class ActionMenuController {
  private scene: Phaser.Scene;
  private actionMenuContainer: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(
    unit: Unit,
    abilities: AbilityDefinition[],
    isAbilityDisabled: (ability: AbilityDefinition) => boolean,
    onAbilitySelected: (ability: AbilityDefinition) => void
  ): void {
    this.clear();

    if (abilities.length === 0) {
      return;
    }

    const fontSize = Math.max(12, Math.round(GameConfig.TILE_SIZE * 0.3));
    const padding = 6;
    const spacing = 4;
    const menuItems: Phaser.GameObjects.Text[] = [];
    let maxWidth = 0;
    let totalHeight = 0;

    abilities.forEach(ability => {
      const isDisabled = isAbilityDisabled(ability);
      const text = this.scene.add.text(0, totalHeight, ability.name, {
        fontSize: `${fontSize}px`,
        color: '#ffffff'
      });
      text.setOrigin(0.5, 0);
      text.setAlpha(isDisabled ? 0.4 : 1);
      text.setInteractive({ useHandCursor: !isDisabled });
      text.on('pointerdown', () => {
        if (isDisabled) {
          return;
        }
        onAbilitySelected(ability);
      });
      text.on('pointerover', () => {
        if (!isDisabled) {
          text.setColor('#ffff66');
        }
      });
      text.on('pointerout', () => {
        text.setColor('#ffffff');
      });

      menuItems.push(text);
      maxWidth = Math.max(maxWidth, text.width);
      totalHeight += text.height + spacing;
    });

    totalHeight = Math.max(totalHeight - spacing, fontSize);

    const x = unit.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
    const y = unit.position.y * GameConfig.TILE_SIZE - GameConfig.TILE_SIZE * 0.6 - totalHeight;
    const container = this.scene.add.container(x, y);
    container.setDepth(900);

    const background = this.scene.add.rectangle(
      0,
      totalHeight / 2,
      maxWidth + padding * 2,
      totalHeight + padding * 2,
      0x000000,
      0.7
    );
    background.setOrigin(0.5, 0.5);
    container.add(background);

    menuItems.forEach(item => container.add(item));

    this.actionMenuContainer = container;
  }

  clear(): void {
    if (this.actionMenuContainer) {
      this.actionMenuContainer.destroy(true);
      this.actionMenuContainer = null;
    }
  }

  isClickInMenu(worldX: number, worldY: number): boolean {
    if (!this.actionMenuContainer) {
      return false;
    }
    return this.actionMenuContainer.getBounds().contains(worldX, worldY);
  }
}