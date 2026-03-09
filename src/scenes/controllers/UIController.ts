import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { GameState } from '@engine/types';
import { ObjectiveController } from '@engine/ObjectiveController';

export class UIController {
  private scene: Phaser.Scene;
  private uiText!: Phaser.GameObjects.Text;
  private objectiveSprites: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createUI(): void {
    this.uiText = this.scene.add.text(10, 10, '', {
      fontSize: `${Math.max(14, Math.round(GameConfig.TILE_SIZE * 0.25))}px`,
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 10 }
    });
  }

  updateUI(
    gameState: GameState,
    selectedUnitName?: string,
    selectedUnitHp?: string,
    movementStatus?: string,
    mainActionStatus?: string
  ): void {
    const round = gameState.currentRound;
    const activeTeam = gameState.activeTeam;
    const scores = ObjectiveController.getObjectiveScores(gameState.objectives);

    const text = [
      `Round: ${round}/${GameConfig.MAX_ROUNDS}`,
      `Active Team: ${activeTeam.toUpperCase()}`,
      `Blue Objectives: ${scores.get(GameConfig.TEAMS.BLUE)}`,
      `Red Objectives: ${scores.get(GameConfig.TEAMS.RED)}`
    ];

    if (selectedUnitName) {
      text.push('', `Selected: ${selectedUnitName}`);
      if (selectedUnitHp) {
        text.push(`HP: ${selectedUnitHp}`);
      }
      if (movementStatus) {
        text.push(`Movement: ${movementStatus}`);
      }
      if (mainActionStatus) {
        text.push(`Main Action: ${mainActionStatus}`);
      }
    }

    this.uiText.setText(text.join('\n'));
  }

  createObjectives(gameState: GameState): void {
    this.objectiveSprites = [];
    gameState.objectives.forEach(objective => {
      const x = objective.position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
      const y = objective.position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;

      const graphics = this.scene.add.graphics();
      const radius = GameConfig.TILE_SIZE * 0.2;
      graphics.lineStyle(2, 0xffff00, 1);
      graphics.strokeCircle(x, y, radius);
      graphics.fillStyle(0xffff00, 0.3);
      graphics.fillCircle(x, y, radius);

      this.objectiveSprites.push(graphics);
    });
  }

  updateObjectiveVisuals(gameState: GameState): void {
    gameState.objectives.forEach((objective, index) => {
      const graphics = this.objectiveSprites[index];
      if (!graphics) {
        return;
      }
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
}