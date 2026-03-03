/**
 * ResultsScene
 * Displays the winner and allows restart
 */

import Phaser from 'phaser';
import type { Team } from '@config/gameConfig';

export class ResultsScene extends Phaser.Scene {
  private winner: Team | null = null;

  constructor() {
    super({ key: 'ResultsScene' });
  }

  init(data: { winner: Team | null }): void {
    this.winner = data.winner;
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background
    this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);

    // Winner text
    let resultText = 'DRAW!';
    let color = '#ffff00';

    if (this.winner === 'blue') {
      resultText = 'BLUE TEAM WINS!';
      color = '#0000ff';
    } else if (this.winner === 'red') {
      resultText = 'RED TEAM WINS!';
      color = '#ff0000';
    }

    this.add.text(width / 2, height / 2 - 50, resultText, {
      fontSize: '48px',
      color: color,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Restart instructions
    const restartText = this.add.text(width / 2, height / 2 + 50, 'Click to restart', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Make restart text blink
    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Click to restart
    this.input.on('pointerdown', () => {
      this.scene.start('BattleScene');
    });
  }
}