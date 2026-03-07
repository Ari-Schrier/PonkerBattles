/**
 * CombatResolver
 * Handles combat resolution using canonical formulas from game config
 */

import { GameConfig } from '@config/gameConfig';
import type { Unit, AttackResult } from './types';

export class CombatResolver {
  /**
   * Roll 2d10 for hit check
   */
  private static rollHit(): number {
    let total = 0;
    for (let i = 0; i < GameConfig.HIT_ROLL_DICE_COUNT; i++) {
      total += Math.floor(Math.random() * GameConfig.HIT_ROLL_DICE_SIDES) + 1;
    }
    return total;
  }

  /**
   * Resolve an attack between attacker and defender
   * Formula: (2d10 - 8) + attackBonus >= evasion
   */
  static resolveAttack(attacker: Unit, defender: Unit): AttackResult {
    const roll = this.rollHit();
    const attackValue = roll - GameConfig.HIT_BASE_SUBTRACT + attacker.stats.attackBonus;
    const hit = attackValue >= defender.stats.evasion;

    let damage = 0;
    let targetDefeated = false;

    if (hit) {
      // Base damage equals attacker's attack bonus
      const baseDamage = attacker.stats.attackBonus;
      damage = Math.max(baseDamage - defender.stats.armor, GameConfig.MIN_DAMAGE);
      targetDefeated = defender.stats.hp - damage <= 0;
    }

    return {
      hit,
      damage,
      targetDefeated
    };
  }

  /**
   * Calculate if defender would be defeated by an attack (for AI/preview)
   */
  static wouldDefeat(attacker: Unit, defender: Unit): boolean {
    const baseDamage = attacker.stats.attackBonus;
    const actualDamage = Math.max(baseDamage - defender.stats.armor, GameConfig.MIN_DAMAGE);
    return defender.stats.hp <= actualDamage;
  }
}