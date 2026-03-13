/**
 * CombatResolver
 * Handles combat resolution using canonical formulas from game config
 */

import { GameConfig } from '@config/gameConfig';
import type { Unit, AttackResult } from './types';
import { RNG, globalRNG } from './RNG';

export class CombatResolver {
  /**
   * Roll 2d10 for hit check
   */
  private static rollHit(rng: RNG = globalRNG): number {
    return rng.rollDice(GameConfig.HIT_ROLL_DICE_COUNT, GameConfig.HIT_ROLL_DICE_SIDES);
  }

  /**
   * Resolve an attack between attacker and defender
   * Formula: (2d10 - 8) + attackBonus >= evasion
   * @param rng - Optional RNG instance for deterministic behavior. Uses globalRNG if not provided.
   */
  static resolveAttack(attacker: Unit, defender: Unit, rng: RNG = globalRNG): AttackResult {
    const roll = this.rollHit(rng);
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