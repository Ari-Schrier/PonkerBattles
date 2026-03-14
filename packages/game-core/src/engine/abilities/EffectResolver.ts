/**
 * EffectResolver
 * Handles execution of individual ability effects
 */

import { CombatResolver } from '../CombatResolver';
import type { Unit } from '../types';
import type { EffectDefinition, EffectResult, ResolvedTarget } from './types';
import { StatusManager } from './StatusManager';

export class EffectResolver {
  /**
   * Apply a single effect to all resolved targets
   */
  static applyEffect(
    effect: EffectDefinition,
    caster: Unit,
    targets: ResolvedTarget[],
    allUnits: Unit[],
    statusManager: StatusManager
  ): EffectResult[] {
    const results: EffectResult[] = [];

    for (const target of targets) {
      const result = this.applyEffectToTarget(
        effect,
        caster,
        target,
        allUnits,
        statusManager
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Apply a single effect to a single target
   */
  private static applyEffectToTarget(
    effect: EffectDefinition,
    caster: Unit,
    target: ResolvedTarget,
    allUnits: Unit[],
    statusManager: StatusManager
  ): EffectResult {
    // Check conditional execution
    if (effect.condition && !this.checkCondition(effect.condition, target.unit)) {
      return { success: false, message: 'Condition not met' };
    }

    switch (effect.type) {
      case 'damage':
        return this.applyDamage(effect, caster, target);

      case 'heal':
        return this.applyHeal(effect, caster, target);

      case 'attack':
        return this.applyAttack(effect, caster, target);

      case 'teleport':
        return this.applyTeleport(effect, caster, target, allUnits);

      case 'push':
        return this.applyPush(effect, caster, target, allUnits);

      case 'pull':
        return this.applyPull(effect, caster, target, allUnits);

      case 'dash':
        return this.applyDash(target);

      case 'apply_status':
        return this.applyStatus(effect, caster, target, statusManager);

      case 'remove_status':
        return this.removeStatus(effect, target, statusManager);

      case 'modify_stat':
        return this.modifyStat(effect, target);

      case 'kill':
        return this.applyKill(target);

      case 'swap_positions':
        return this.swapPositions(caster, target);

      default:
        return { success: false, message: `Unknown effect type: ${effect.type}` };
    }
  }

  /**
   * Check if an effect condition is met
   */
  private static checkCondition(
    condition: any,
    target: Unit | undefined
  ): boolean {
    if (!target) return false;

    switch (condition.type) {
      case 'target_hp_below':
        return target.stats.hp < (condition.value as number);

      case 'target_hp_above':
        return target.stats.hp > (condition.value as number);

      case 'target_has_status':
        // Would need to check StatusManager - simplified for now
        return false;

      case 'target_is_type':
        return target.unitClass === condition.value;

      default:
        return false;
    }
  }

  /**
   * Apply damage effect
   */
  private static applyDamage(
    effect: EffectDefinition,
    caster: Unit,
    target: ResolvedTarget
  ): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    let damage = effect.amount || 0;

    // Use stat-based damage
    if (effect.useAttackerStat) {
      damage = caster.stats[effect.useAttackerStat] as number;
    } else if (effect.useTargetStat) {
      damage = target.unit.stats[effect.useTargetStat] as number;
    }

    // Apply damage
    const previousHp = target.unit.stats.hp;
    target.unit.stats.hp = Math.max(0, target.unit.stats.hp - damage);
    const actualDamage = previousHp - target.unit.stats.hp;
    const unitKilled = target.unit.stats.hp === 0;

    return {
      success: true,
      damageDealt: actualDamage,
      unitKilled
    };
  }

  /**
   * Apply heal effect
   */
  private static applyHeal(
    effect: EffectDefinition,
    caster: Unit,
    target: ResolvedTarget
  ): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    let healing = effect.amount || 0;

    // Use stat-based healing
    if (effect.useAttackerStat) {
      healing = caster.stats[effect.useAttackerStat] as number;
    }

    // Apply healing
    const previousHp = target.unit.stats.hp;
    target.unit.stats.hp = Math.min(
      target.unit.stats.maxHp,
      target.unit.stats.hp + healing
    );
    const actualHealing = target.unit.stats.hp - previousHp;

    return {
      success: true,
      healingDone: actualHealing
    };
  }

  /**
   * Apply attack effect (uses unified combat system)
   */
  private static applyAttack(
    effect: EffectDefinition,
    caster: Unit,
    target: ResolvedTarget
  ): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    // Create a modified attacker if stat overrides are specified
    let attacker = caster;
    if (effect.attackStatOverride) {
      attacker = { ...caster };
      if (effect.attackStatOverride.attackBonus !== undefined) {
        attacker.stats = {
          ...attacker.stats,
          attackBonus: effect.attackStatOverride.attackBonus
        };
      }
      if (effect.attackStatOverride.useAlternateStat) {
        const alternateStat = target.unit.stats[
          effect.attackStatOverride.useAlternateStat
        ] as number;
        attacker.stats = {
          ...attacker.stats,
          attackBonus: alternateStat
        };
      }
    }

    // Use unified combat resolver
    const attackResult = CombatResolver.resolveAttack(attacker, target.unit);

    if (attackResult.hit) {
      target.unit.stats.hp = Math.max(0, target.unit.stats.hp - attackResult.damage);
    }

    return {
      success: attackResult.hit,
      damageDealt: attackResult.damage,
      unitKilled: attackResult.targetDefeated
    };
  }

  /**
   * Apply teleport effect
   */
  private static applyTeleport(
    _effect: EffectDefinition,
    _caster: Unit,
    target: ResolvedTarget,
    allUnits: Unit[]
  ): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    // Check if target position is occupied
    const occupied = allUnits.some(
      u => u.id !== target.unit!.id &&
           u.position.x === target.position.x &&
           u.position.y === target.position.y
    );

    if (occupied) {
      return { success: false, message: 'Target position occupied' };
    }

    // Teleport unit
    target.unit.position = { ...target.position };

    return {
      success: true,
      message: `Teleported to (${target.position.x}, ${target.position.y})`
    };
  }

  /**
   * Apply push effect
   */
  private static applyPush(
    effect: EffectDefinition,
    caster: Unit,
    target: ResolvedTarget,
    allUnits: Unit[]
  ): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    const distance = effect.distance || 1;

    // Calculate push direction (away from caster)
    const dx = target.unit.position.x - caster.position.x;
    const dy = target.unit.position.y - caster.position.y;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude === 0) {
      return { success: false, message: 'Cannot push self' };
    }

    // Normalize and apply push
    const pushX = Math.round((dx / magnitude) * distance);
    const pushY = Math.round((dy / magnitude) * distance);

    const newPosition = {
      x: target.unit.position.x + pushX,
      y: target.unit.position.y + pushY
    };

    // Check if new position is valid (simplified - would need map bounds check)
    const occupied = allUnits.some(
      u => u.id !== target.unit!.id &&
           u.position.x === newPosition.x &&
           u.position.y === newPosition.y
    );

    if (occupied) {
      return { success: false, message: 'Push destination occupied' };
    }

    target.unit.position = newPosition;

    return {
      success: true,
      message: `Pushed ${distance} tiles`
    };
  }

  /**
   * Apply pull effect
   */
  private static applyPull(
    effect: EffectDefinition,
    caster: Unit,
    target: ResolvedTarget,
    allUnits: Unit[]
  ): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    const distance = effect.distance || 1;

    // Calculate pull direction (toward caster)
    const dx = caster.position.x - target.unit.position.x;
    const dy = caster.position.y - target.unit.position.y;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude === 0) {
      return { success: false, message: 'Cannot pull self' };
    }

    // Normalize and apply pull
    const pullX = Math.round((dx / magnitude) * distance);
    const pullY = Math.round((dy / magnitude) * distance);

    const newPosition = {
      x: target.unit.position.x + pullX,
      y: target.unit.position.y + pullY
    };

    // Check if new position is valid
    const occupied = allUnits.some(
      u => u.id !== target.unit!.id &&
           u.position.x === newPosition.x &&
           u.position.y === newPosition.y
    );

    if (occupied) {
      return { success: false, message: 'Pull destination occupied' };
    }

    target.unit.position = newPosition;

    return {
      success: true,
      message: `Pulled ${distance} tiles`
    };
  }

  /**
   * Apply dash effect (grants extra movement)
   */
  private static applyDash(target: ResolvedTarget): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    // Reset movement action
    target.unit.hasUsedMovement = false;

    return {
      success: true,
      message: 'Movement action restored'
    };
  }

  /**
   * Apply status effect
   */
  private static applyStatus(
    effect: EffectDefinition,
    caster: Unit,
    target: ResolvedTarget,
    statusManager: StatusManager
  ): EffectResult {
    if (!target.unit || !effect.statusId) {
      return { success: false, message: 'Invalid status application' };
    }

    const duration = effect.statusDuration || 3;
    statusManager.addStatus(target.unit, effect.statusId, duration, caster.id);

    return {
      success: true,
      statusApplied: effect.statusId,
      message: `Applied ${effect.statusId}`
    };
  }

  /**
   * Remove status effect
   */
  private static removeStatus(
    effect: EffectDefinition,
    target: ResolvedTarget,
    statusManager: StatusManager
  ): EffectResult {
    if (!target.unit || !effect.removeStatusId) {
      return { success: false, message: 'Invalid status removal' };
    }

    statusManager.removeStatus(target.unit, effect.removeStatusId);

    return {
      success: true,
      message: `Removed ${effect.removeStatusId}`
    };
  }

  /**
   * Modify stat effect
   */
  private static modifyStat(
    effect: EffectDefinition,
    target: ResolvedTarget
  ): EffectResult {
    if (!target.unit || !effect.stat || effect.amount === undefined) {
      return { success: false, message: 'Invalid stat modification' };
    }

    const currentValue = target.unit.stats[effect.stat] as number;
    let newValue = currentValue;

    switch (effect.modifierType) {
      case 'flat':
        newValue = currentValue + effect.amount;
        break;
      case 'percent':
        newValue = currentValue + (currentValue * effect.amount / 100);
        break;
      case 'multiply':
        newValue = currentValue * effect.amount;
        break;
      default:
        newValue = currentValue + effect.amount; // Default to flat
    }

    // Apply the modification
    (target.unit.stats[effect.stat] as number) = Math.round(newValue);

    return {
      success: true,
      message: `Modified ${effect.stat} by ${effect.amount}`
    };
  }

  /**
   * Apply instant kill effect
   */
  private static applyKill(target: ResolvedTarget): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    target.unit.stats.hp = 0;

    return {
      success: true,
      unitKilled: true,
      message: 'Unit killed'
    };
  }

  /**
   * Swap positions between caster and target
   */
  private static swapPositions(
    caster: Unit,
    target: ResolvedTarget
  ): EffectResult {
    if (!target.unit) {
      return { success: false, message: 'No unit at target' };
    }

    const tempPosition = { ...caster.position };
    caster.position = { ...target.unit.position };
    target.unit.position = tempPosition;

    return {
      success: true,
      message: 'Positions swapped'
    };
  }
}