import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Unit, Position, MapDefinition } from '@engine/types';
import { Direction } from '@engine/types';
import type { 
  AbilityDefinition, 
  AnimationStep, 
  ResolvedTarget, 
  StatusDefinition,
  TriggerType 
} from '@engine/abilities';
import { 
  AbilityResolver, 
  EffectResolver, 
  StatusManager, 
  TriggerManager, 
  TargetingSystem 
} from '@engine/abilities';
import { AnimationManager } from '@engine/AnimationManager';
import type { UnitController } from './UnitController';
import type { ActionQueue } from './ActionQueue';

export class AbilityController {
  private scene: Phaser.Scene;
  private unitController: UnitController;
  private actionQueue: ActionQueue;
  private mapDefinition: MapDefinition;
  private statusManager!: StatusManager;
  private abilityResolver!: AbilityResolver;
  private triggerManager!: TriggerManager;
  private abilityDefinitions: Map<string, AbilityDefinition> = new Map();
  private selectedAbility: AbilityDefinition | null = null;
  private abilityHighlightGraphics!: Phaser.GameObjects.Graphics;
  private readonly abilitySpriteDepth = 850;

  constructor(
    scene: Phaser.Scene,
    unitController: UnitController,
    actionQueue: ActionQueue,
    mapDefinition: MapDefinition
  ) {
    this.scene = scene;
    this.unitController = unitController;
    this.actionQueue = actionQueue;
    this.mapDefinition = mapDefinition;
  }

  initialize(): void {
    this.statusManager = new StatusManager();
    this.abilityResolver = new AbilityResolver(this.statusManager);
    this.triggerManager = new TriggerManager(this.abilityResolver, this.statusManager);

    const abilities = this.scene.cache.json.get('abilities') as AbilityDefinition[] | undefined;
    const statuses = this.scene.cache.json.get('statuses') as StatusDefinition[] | undefined;

    if (abilities) {
      this.triggerManager.registerAbilities(abilities);
      this.abilityDefinitions = new Map(abilities.map(ability => [ability.id, ability]));
    } else {
      console.warn('Ability definitions were not loaded.');
    }

    if (statuses) {
      this.statusManager.registerStatuses(statuses);
    } else {
      console.warn('Status definitions were not loaded.');
    }

    this.abilityHighlightGraphics = this.scene.add.graphics();
    this.abilityHighlightGraphics.setDepth(800);
  }

  getStatusManager(): StatusManager {
    return this.statusManager;
  }

  getTriggerManager(): TriggerManager {
    return this.triggerManager;
  }

  getSelectedAbility(): AbilityDefinition | null {
    return this.selectedAbility;
  }

  getAbilityDefinitions(): Map<string, AbilityDefinition> {
    return this.abilityDefinitions;
  }

  selectAbility(unit: Unit, ability: AbilityDefinition): void {
    this.selectedAbility = ability;
    this.showAbilityTargets(unit, ability);
  }

  clearAbilitySelection(): void {
    this.selectedAbility = null;
    this.abilityHighlightGraphics.clear();
  }

  showAbilityTargets(unit: Unit, ability: AbilityDefinition): void {
    this.abilityHighlightGraphics.clear();
    const targetPositions = this.abilityResolver.getValidTargets(
      ability,
      unit,
      [] as Unit[], // Will be passed from caller
      this.mapDefinition.width,
      this.mapDefinition.height
    );

    this.abilityHighlightGraphics.fillStyle(0xff66ff, 0.35);
    targetPositions.forEach(pos => this.fillAbilityTile(pos));
  }

  updateTargetHighlights(unit: Unit, ability: AbilityDefinition, units: Unit[]): void {
    this.abilityHighlightGraphics.clear();
    const targetPositions = this.abilityResolver.getValidTargets(
      ability,
      unit,
      units,
      this.mapDefinition.width,
      this.mapDefinition.height
    );

    this.abilityHighlightGraphics.fillStyle(0xff66ff, 0.35);
    targetPositions.forEach(pos => this.fillAbilityTile(pos));
  }

  attemptAbility(
    unit: Unit, 
    ability: AbilityDefinition, 
    targetPos: Position, 
    units: Unit[],
    onComplete: () => void
  ): boolean {
    if (this.actionQueue.isRunning) {
      return false;
    }

    const canUse = this.abilityResolver.canUseAbility(
      ability,
      unit,
      targetPos,
      units,
      this.mapDefinition.width,
      this.mapDefinition.height
    );

    if (!canUse) {
      return false;
    }

    this.clearAbilitySelection();
    const animationSteps = ability.animationSteps ?? [];
    this.queueAbilityExecution(unit, ability, animationSteps, targetPos, units, onComplete);
    return true;
  }

  isAbilityDisabled(unit: Unit, ability: AbilityDefinition): boolean {
    if (ability.cost.type === 'main_action') {
      return unit.hasUsedMainAction;
    }

    if (ability.cost.type === 'movement') {
      return unit.hasUsedMovement;
    }

    return false;
  }

  applyAbilityCost(unit: Unit, ability: AbilityDefinition): void {
    switch (ability.cost.type) {
      case 'movement':
        unit.hasUsedMovement = true;
        break;
      case 'main_action':
        unit.hasUsedMainAction = true;
        break;
      default:
        break;
    }
  }

  private queueAbilityExecution(
    unit: Unit,
    ability: AbilityDefinition,
    animationSteps: AnimationStep[],
    targetPos: Position,
    units: Unit[],
    onComplete: () => void
  ): void {
    const steps = this.buildAbilityAnimationSteps(unit, ability, animationSteps, targetPos, units, () => {
      this.applyAbilityResults(ability, unit, targetPos, units);
    });

    steps.push(() => {
      this.applyAbilityCost(unit, ability);
      onComplete();
      return Promise.resolve();
    });

    this.actionQueue.enqueueAll(steps);
  }

  private buildAbilityAnimationSteps(
    caster: Unit,
    ability: AbilityDefinition,
    animationSteps: AnimationStep[],
    targetPos: Position,
    units: Unit[],
    onImpact: () => void
  ): Array<() => Promise<void>> {
    if (animationSteps.length === 0) {
      return [() => {
        onImpact();
        return Promise.resolve();
      }];
    }

    const steps: Array<() => Promise<void>> = [];
    let impactQueued = false;

    const queueImpactIfNeeded = () => {
      if (!impactQueued) {
        impactQueued = true;
        onImpact();
      }
    };

    animationSteps.forEach(step => {
      steps.push(() => {
        switch (step.type) {
          case 'caster_anim':
            return this.playCasterAnimation(caster, step, targetPos);
          case 'target_anim':
            return this.playTargetAnimation(caster, ability, targetPos, units, step, true);
          case 'projectile':
            return this.playProjectile(step, caster.position, targetPos);
          case 'effect_visual':
            if (step.waitForCompletion === false) {
              queueImpactIfNeeded();
              return this.playEffectVisual(step, ability, targetPos);
            }

            return this.playEffectVisual(step, ability, targetPos).then(() => {
              queueImpactIfNeeded();
            });
          case 'camera_shake':
            this.scene.cameras.main.shake(step.duration ?? 200, step.intensity ?? 0.02);
            return this.wait(step.duration ?? 200);
          case 'wait':
            return this.wait(step.duration ?? 0);
          case 'sound':
            if (step.soundKey) {
              this.scene.sound.play(step.soundKey);
            }
            return Promise.resolve();
          default:
            return Promise.resolve();
        }
      });
    });

    steps.push(() => {
      queueImpactIfNeeded();
      return Promise.resolve();
    });

    return steps;
  }

  private playCasterAnimation(caster: Unit, step: AnimationStep, targetPos: Position): Promise<void> {
    const sprite = this.unitController.getSprite(caster.id);
    const animationType = step.animationType;
    if (!sprite || !animationType) {
      return this.wait(step.duration ?? 0);
    }

    const direction = AnimationManager.getDirection(caster.position, targetPos);
    caster.currentDirection = direction;
    AnimationManager.playAnimation(sprite, caster.spriteKey, animationType, direction);
    sprite.once('animationcomplete', () => {
      if (caster.stats.hp > 0) {
        AnimationManager.playAnimation(sprite, caster.spriteKey, 'idle', direction);
      }
    });

    return this.waitForAnimation(sprite, step);
  }

  private playTargetAnimation(
    caster: Unit,
    ability: AbilityDefinition,
    targetPos: Position,
    units: Unit[],
    step: AnimationStep,
    resetToIdle: boolean
  ): Promise<void> {
    const animationType = step.animationType;
    if (!animationType) {
      return this.wait(step.duration ?? 0);
    }

    const spriteTargets = this.resolveAbilityTargets(ability, caster, targetPos, units)
      .map(target => target.unit)
      .filter((unit): unit is Unit => Boolean(unit))
      .map(unit => {
        const sprite = this.unitController.getSprite(unit.id);
        if (!sprite) {
          return null;
        }
        const direction = AnimationManager.getDirection(unit.position, caster.position);
        unit.currentDirection = direction;
        AnimationManager.playAnimation(sprite, unit.spriteKey, animationType, direction);
        return { unit, sprite, direction };
      })
      .filter(
        (entry): entry is { unit: Unit; sprite: Phaser.GameObjects.Sprite; direction: Direction } =>
          Boolean(entry)
      );

    if (spriteTargets.length === 0) {
      return this.wait(step.duration ?? 0);
    }

    if (step.waitForCompletion === false) {
      spriteTargets.forEach(({ unit, sprite, direction }) => {
        sprite.once('animationcomplete', () => {
          if (resetToIdle && unit.stats.hp > 0) {
            AnimationManager.playAnimation(sprite, unit.spriteKey, 'idle', direction);
          } else if (unit.stats.hp <= 0) {
            this.playDeathAnimation(unit, direction);
          }
        });
      });

      return this.wait(step.duration ?? 0);
    }

    return new Promise(resolve => {
      let remaining = spriteTargets.length;

      spriteTargets.forEach(({ unit, sprite, direction }) => {
        sprite.once('animationcomplete', () => {
          if (resetToIdle && unit.stats.hp > 0) {
            AnimationManager.playAnimation(sprite, unit.spriteKey, 'idle', direction);
          } else if (unit.stats.hp <= 0) {
            this.playDeathAnimation(unit, direction);
          }
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
          }
        });
      });

      if (step.duration && step.duration > 0) {
        this.scene.time.delayedCall(step.duration, () => {
          if (remaining > 0) {
            remaining = 0;
            resolve();
          }
        });
      }
    });
  }

  private playProjectile(step: AnimationStep, from: Position, to: Position): Promise<void> {
    if (!step.projectileSprite) {
      return Promise.resolve();
    }

    const projectileSprite = step.projectileSprite;
    const fromWorld = this.getTileCenter(from);
    const toWorld = this.getTileCenter(to);
    const sprite = this.scene.add.sprite(fromWorld.x, fromWorld.y, projectileSprite, 0);
    sprite.setDepth(this.abilitySpriteDepth);
    sprite.setDisplaySize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);

    const frameTotal = this.scene.textures.get(projectileSprite).frameTotal;
    if (frameTotal > 1) {
      const animKey = `${projectileSprite}-loop`;
      if (!this.scene.anims.exists(animKey)) {
        this.scene.anims.create({
          key: animKey,
          frames: this.scene.anims.generateFrameNumbers(projectileSprite, {
            start: 0,
            end: frameTotal - 1
          }),
          frameRate: 12,
          repeat: -1
        });
      }
      sprite.play(animKey);
    }

    const distance = Phaser.Math.Distance.Between(fromWorld.x, fromWorld.y, toWorld.x, toWorld.y);
    const speed = step.projectileSpeed ?? 260;
    const duration = Math.max(120, (distance / speed) * 1000);

    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: sprite,
        x: toWorld.x,
        y: toWorld.y,
        duration,
        ease: 'Linear',
        onComplete: () => {
          sprite.destroy();
          resolve();
        }
      });
    });
  }

  private playEffectVisual(
    step: AnimationStep,
    ability: AbilityDefinition,
    targetPos: Position
  ): Promise<void> {
    if (!step.effectSprite) {
      return Promise.resolve();
    }

    const effectSprite = step.effectSprite;
    const effectPositions = this.resolveEffectPositions(ability, targetPos);

    const sprites = effectPositions.map(pos => {
      const world = this.getTileCenter(pos);
      const sprite = this.scene.add.sprite(world.x, world.y, effectSprite, 0);
      sprite.setDepth(this.abilitySpriteDepth);
      sprite.setDisplaySize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      return sprite;
    });

    const frameTotal = this.scene.textures.get(effectSprite).frameTotal;
    const duration = step.effectDuration ?? (frameTotal > 0 ? (frameTotal / 12) * 1000 : 400);
    const animKey = `${effectSprite}-play`;
    if (frameTotal > 1 && !this.scene.anims.exists(animKey)) {
      const frameRate = duration > 0 ? frameTotal / (duration / 1000) : 12;
      this.scene.anims.create({
        key: animKey,
        frames: this.scene.anims.generateFrameNumbers(effectSprite, {
          start: 0,
          end: frameTotal - 1
        }),
        frameRate,
        repeat: 0
      });
    }

    if (frameTotal > 1) {
      sprites.forEach(sprite => sprite.play(animKey));
    }

    return new Promise(resolve => {
      this.scene.time.delayedCall(duration, () => {
        sprites.forEach(sprite => sprite.destroy());
        resolve();
      });
    });
  }

  playDeathAnimation(unit: Unit, direction?: Direction): void {
    const sprite = this.unitController.getSprite(unit.id);
    if (!sprite) {
      return;
    }

    const currentAnim = sprite.anims.currentAnim?.key;
    if (currentAnim && currentAnim.includes('-death-')) {
      return;
    }

    const resolvedDirection = direction ?? unit.currentDirection;
    AnimationManager.playAnimation(sprite, unit.spriteKey, 'death', resolvedDirection);
    sprite.once('animationcomplete', () => {
      sprite.setFrame(resolvedDirection * 29 + 24);
    });
  }

  private applyAbilityResults(ability: AbilityDefinition, caster: Unit, targetPos: Position, units: Unit[]): void {
    const targets = this.resolveAbilityTargets(ability, caster, targetPos, units);

    ability.effects.forEach(effect => {
      EffectResolver.applyEffect(effect, caster, targets, units, this.statusManager);
    });

    const affectedUnits = new Set(targets.map(target => target.unit).filter((unit): unit is Unit => Boolean(unit)));

    const hasTargetAnim = (ability.animationSteps ?? []).some(step => step.type === 'target_anim');

    affectedUnits.forEach(unit => {
      this.unitController.updateHealthText(unit);

      if (unit.stats.hp <= 0 && !hasTargetAnim) {
        const direction = AnimationManager.getDirection(unit.position, caster.position);
        unit.currentDirection = direction;
        this.playDeathAnimation(unit, direction);
      }
    });
  }

  private resolveAbilityTargets(
    ability: AbilityDefinition,
    caster: Unit,
    targetPos: Position,
    units: Unit[]
  ): ResolvedTarget[] {
    return TargetingSystem.resolveTargets(
      caster,
      targetPos,
      ability.targeting,
      units,
      this.mapDefinition.width,
      this.mapDefinition.height
    );
  }

  private resolveEffectPositions(ability: AbilityDefinition, targetPos: Position): Position[] {
    const radius = ability.targeting.radius;
    if (ability.targeting.pattern.startsWith('radius') && radius && radius > 0) {
      return this.getPositionsInRadius(targetPos, radius);
    }

    return [targetPos];
  }

  private getPositionsInRadius(center: Position, radius: number): Position[] {
    const positions: Position[] = [];

    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let y = center.y - radius; y <= center.y + radius; y++) {
        if (
          x >= 0 && x < this.mapDefinition.width &&
          y >= 0 && y < this.mapDefinition.height &&
          Math.abs(center.x - x) + Math.abs(center.y - y) <= radius
        ) {
          positions.push({ x, y });
        }
      }
    }

    return positions;
  }

  private waitForAnimation(sprite: Phaser.GameObjects.Sprite, step: AnimationStep): Promise<void> {
    if (step.waitForCompletion === false) {
      return this.wait(step.duration ?? 0);
    }

    return new Promise(resolve => {
      let resolved = false;
      sprite.once('animationcomplete', () => {
        resolved = true;
        resolve();
      });
      if (step.duration) {
        this.scene.time.delayedCall(step.duration, () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        });
      }
    });
  }

  private wait(duration: number): Promise<void> {
    return new Promise(resolve => {
      this.scene.time.delayedCall(duration, resolve);
    });
  }

  private getTileCenter(position: Position): { x: number; y: number } {
    return {
      x: position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2,
      y: position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2
    };
  }

  private fillAbilityTile(pos: Position): void {
    const x = pos.x * GameConfig.TILE_SIZE;
    const y = pos.y * GameConfig.TILE_SIZE;
    this.abilityHighlightGraphics.fillRect(x, y, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
  }
}