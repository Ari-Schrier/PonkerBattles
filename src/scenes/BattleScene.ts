/**
 * BattleScene
 * Main gameplay scene with map, units, and turn-based interaction
 */

import Phaser from 'phaser';
import { GameConfig } from '@config/gameConfig';
import type { Unit, GameState, Objective, Position, MapData, MapDefinition, TileDefinition } from '@engine/types';
import { Direction } from '@engine/types';
import { TurnManager } from '@engine/TurnManager';
import { ObjectiveController } from '@engine/ObjectiveController';
import { MapLoader } from '@data/maps/MapLoader';
import { MovementEngine } from '@engine/MovementEngine';
import { TerrainRules } from '@engine/TerrainRules';
import { UnitController } from './controllers/UnitController';
import { UIController } from './controllers/UIController';
import { MovementController } from './controllers/MovementController';
import { CombatController } from './controllers/CombatController';
import { ActionQueue } from './controllers/ActionQueue';
import type { AbilityDefinition, AnimationStep, ResolvedTarget, StatusDefinition, TriggerType } from '@engine/abilities';
import { AbilityResolver, EffectResolver, StatusManager, TriggerManager, TargetingSystem } from '@engine/abilities';
import { AnimationManager } from '@engine/AnimationManager';

export class BattleScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private mapDefinition!: MapDefinition;
  private tileDefLookup: Map<number, TileDefinition> = new Map();
  private gameState!: GameState;
  private turnManager!: TurnManager;
  private selectedUnit: Unit | null = null;
  private unitController!: UnitController;
  private uiController!: UIController;
  private movementController!: MovementController;
  private combatController!: CombatController;
  private actionQueue!: ActionQueue;
  private terrainRules!: TerrainRules;
  private statusManager!: StatusManager;
  private abilityResolver!: AbilityResolver;
  private triggerManager!: TriggerManager;
  private abilityDefinitions: Map<string, AbilityDefinition> = new Map();
  private selectedAbility: AbilityDefinition | null = null;
  private abilityHighlightGraphics!: Phaser.GameObjects.Graphics;
  private actionMenuContainer: Phaser.GameObjects.Container | null = null;
  private readonly abilitySpriteDepth = 850;
  private readonly statusIndicatorKey = 'poisoned-indicator';
  private lastProcessedRound = 0;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);

    // Create tilemap
    this.map = this.make.tilemap({ key: 'basicMap' });
    const tileset = this.map.addTilesetImage('punyworld-overworld-tileset', 'world-tileset');

    if (tileset) {
      const groundLayer = this.map.createLayer('Tile Layer 1', tileset, 0, 0);
      const overlayLayer = this.map.createLayer('Tile Layer 2', tileset, 0, 0);
      const scale = GameConfig.TILE_SIZE / this.map.tileWidth;
      groundLayer?.setScale(scale);
      overlayLayer?.setScale(scale);
    }

    this.mapDefinition = this.loadMapDefinition();

    // Initialize game state
    this.initializeGameState();
    this.initializeAbilitySystem();

    // Create controllers
    this.actionQueue = new ActionQueue();
    this.terrainRules = new TerrainRules(this.mapDefinition, this.mapDefinition.tileDefs);
    this.unitController = new UnitController(this);
    this.uiController = new UIController(this);
    this.movementController = new MovementController(
      this,
      this.unitController,
      this.mapDefinition,
      this.terrainRules,
      this.actionQueue
    );
    this.combatController = new CombatController(this, this.unitController, this.actionQueue);
    this.abilityHighlightGraphics = this.add.graphics();
    this.abilityHighlightGraphics.setDepth(800);

    // Create turn manager
    this.turnManager = new TurnManager(this.gameState, () => {
      ObjectiveController.updateObjectiveControl(this.gameState.objectives, this.gameState.units);
      this.uiController.updateObjectiveVisuals(this.gameState);
    });
    this.turnManager.startGame();

    // Place objectives
    this.uiController.createObjectives(this.gameState);

    // Place units
    this.unitController.createUnits(this.gameState.units);

    // Create UI
    this.uiController.createUI();

    // Enable input
    this.input.on('pointerdown', this.handleClick, this);

    this.updateUI();
  }

  private initializeGameState(): void {
    const blueTeamData = this.cache.json.get('blueTeam');
    const redTeamData = this.cache.json.get('redTeam');

    // Create units
    const units: Unit[] = [];

    [...blueTeamData, ...redTeamData].forEach((unitData: any) => {
      units.push({
        id: unitData.id,
        name: unitData.name,
        team: unitData.team,
        unitClass: unitData.unitClass,
        spriteKey: unitData.spriteKey,
        stats: { ...unitData.stats },
        position: { ...unitData.startPosition },
        currentDirection: Direction.Down,
        hasActivated: false,
        hasUsedMovement: false,
        hasUsedMainAction: false,
        abilities: Array.isArray(unitData.abilities)
          ? unitData.abilities.map((definitionId: string) => ({
              definitionId,
              triggerCount: 0
            }))
          : undefined
      });
    });

    // Create objectives
    const objectives: Objective[] = this.mapDefinition.objectives.map(obj => ({
      id: obj.id,
      position: { ...obj.position },
      controlledBy: null
    }));

    this.gameState = {
      currentRound: 1,
      currentPhase: GameConfig.PHASES.SETUP,
      activeTeam: GameConfig.TEAMS.BLUE,
      units,
      objectives,
      winner: null
    };
  }

  private initializeAbilitySystem(): void {
    this.statusManager = new StatusManager();
    this.abilityResolver = new AbilityResolver(this.statusManager);
    this.triggerManager = new TriggerManager(this.abilityResolver, this.statusManager);

    const abilities = this.cache.json.get('abilities') as AbilityDefinition[] | undefined;
    const statuses = this.cache.json.get('statuses') as StatusDefinition[] | undefined;

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
  }

  update(): void {
    this.processRoundStatusEffects();
  }

  private updateUI(): void {
    if (this.selectedUnit) {
      const movementStatus = this.selectedUnit.hasUsedMovement ? '✓' : 'Available';
      const mainActionStatus = this.selectedUnit.hasUsedMainAction ? '✓' : 'Available';

      this.uiController.updateUI(
        this.gameState,
        this.selectedUnit.name,
        `${this.selectedUnit.stats.hp}/${this.selectedUnit.stats.maxHp}`,
        movementStatus,
        mainActionStatus
      );
    } else {
      this.uiController.updateUI(this.gameState);
    }
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    const tileX = Math.floor(pointer.worldX / GameConfig.TILE_SIZE);
    const tileY = Math.floor(pointer.worldY / GameConfig.TILE_SIZE);

    if (this.actionMenuContainer && this.actionMenuContainer.getBounds().contains(pointer.worldX, pointer.worldY)) {
      return;
    }

    // Check if clicking on a unit
    const clickedUnit = this.unitController.getUnitAtPosition(this.gameState.units, { x: tileX, y: tileY });

    if (this.selectedUnit && this.selectedAbility) {
      if (clickedUnit && clickedUnit === this.selectedUnit) {
        this.clearAbilitySelection();
        this.movementController.showMovementRange(this.selectedUnit, this.gameState.units);
        this.showActionMenu(this.selectedUnit);
        this.updateUI();
        return;
      }

      this.attemptAbility(this.selectedUnit, this.selectedAbility, { x: tileX, y: tileY });
      return;
    }

    if (this.selectedUnit) {
      // Unit is already selected
      if (clickedUnit && clickedUnit === this.selectedUnit) {
        // If unit has used any actions, end their turn
        if (this.selectedUnit.hasUsedMovement || this.selectedUnit.hasUsedMainAction) {
          this.endUnitActivation(this.selectedUnit);
        } else {
          // Otherwise just deselect
          this.deselectUnit();
        }
      } else if (clickedUnit && clickedUnit.team !== this.selectedUnit.team) {
        if (this.movementController.canUnitAttack(this.selectedUnit)) {
          // Attack enemy
          this.attemptAttack(this.selectedUnit, clickedUnit);
        }
      } else {
        // Try to move
        if (this.movementController.canUnitMove(this.selectedUnit)) {
          this.attemptMove(this.selectedUnit, { x: tileX, y: tileY });
        }
      }
    } else {
      // No unit selected
      if (clickedUnit && this.canUnitSelect(clickedUnit)) {
        this.selectUnit(clickedUnit);
      }
    }
  }

  private canUnitSelect(unit: Unit): boolean {
    return unit.team === this.gameState.activeTeam && !unit.hasActivated && unit.stats.hp > 0;
  }

  private selectUnit(unit: Unit): void {
    this.selectedUnit = unit;
    this.movementController.showMovementRange(unit, this.gameState.units);
    this.showActionMenu(unit);
    this.updateUI();
  }

  private deselectUnit(): void {
    this.selectedUnit = null;
    this.movementController.clearHighlights();
    this.clearAbilitySelection();
    this.clearActionMenu();
    this.updateUI();
  }

  private attemptMove(unit: Unit, targetPos: Position): void {
    this.movementController.attemptMove(
      unit,
      targetPos,
      this.gameState.units,
      (movedUnit, wasDash) => {
        if (wasDash) {
          movedUnit.hasUsedMainAction = true;
        } else {
          movedUnit.hasUsedMovement = true;
        }

        if (this.isUnitTurnComplete(movedUnit)) {
          this.endUnitActivation(movedUnit);
        } else {
          this.movementController.showMovementRange(movedUnit, this.gameState.units);
          this.showActionMenu(movedUnit);
          this.updateUI();
        }
      },
      interruptedUnit => {
        this.endUnitActivation(interruptedUnit);
      }
    );
  }

  private attemptAttack(attacker: Unit, defender: Unit): void {
    if (!this.movementController.canUnitAttack(attacker)) {
      return;
    }

    if (MovementEngine.isAdjacent(attacker.position, defender.position)) {
      this.movementController.clearHighlights();
      this.combatController.attemptAttack(attacker, defender, completedAttacker => {
        completedAttacker.hasUsedMainAction = true;

        if (this.isUnitTurnComplete(completedAttacker)) {
          this.endUnitActivation(completedAttacker);
        } else {
          this.movementController.showMovementRange(completedAttacker, this.gameState.units);
          this.showActionMenu(completedAttacker);
          this.updateUI();
        }
      });
    }
  }

  private isUnitTurnComplete(unit: Unit): boolean {
    return unit.hasUsedMovement && unit.hasUsedMainAction;
  }

  private endUnitActivation(unit: Unit): void {
    this.processTurnEndStatuses(unit);
    this.unitController.setUnitDimmed(unit, true);
    this.deselectUnit();

    const { roundEnded, gameEnded } = this.turnManager.completeUnitActivation(unit);

    if (roundEnded) {
      this.unitController.resetActivationVisuals(this.gameState.units);
    }

    if (gameEnded) {
      this.endGame();
    }

    this.updateUI();
  }

  private endGame(): void {
    this.gameState.winner = ObjectiveController.determineWinner(this.gameState.objectives);
    this.scene.start('ResultsScene', { winner: this.gameState.winner });
  }

  private showActionMenu(unit: Unit): void {
    this.clearActionMenu();

    const abilities = (unit.abilities || [])
      .map(active => this.abilityDefinitions.get(active.definitionId))
      .filter((ability): ability is AbilityDefinition => Boolean(ability))
      .filter(ability => ability.trigger.type === 'activated');

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
      const isDisabled = this.isAbilityDisabled(unit, ability);
      const text = this.add.text(0, totalHeight, ability.name, {
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
        this.selectAbility(unit, ability);
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
    const container = this.add.container(x, y);
    container.setDepth(900);

    const background = this.add.rectangle(
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

  private clearActionMenu(): void {
    if (this.actionMenuContainer) {
      this.actionMenuContainer.destroy(true);
      this.actionMenuContainer = null;
    }
  }

  private selectAbility(unit: Unit, ability: AbilityDefinition): void {
    this.selectedAbility = ability;
    this.clearActionMenu();
    this.movementController.clearHighlights();
    this.showAbilityTargets(unit, ability);
    this.updateUI();
  }

  private clearAbilitySelection(): void {
    this.selectedAbility = null;
    this.abilityHighlightGraphics.clear();
  }

  private showAbilityTargets(unit: Unit, ability: AbilityDefinition): void {
    this.abilityHighlightGraphics.clear();
    const targetPositions = this.abilityResolver.getValidTargets(
      ability,
      unit,
      this.gameState.units,
      this.mapDefinition.width,
      this.mapDefinition.height
    );

    this.abilityHighlightGraphics.fillStyle(0xff66ff, 0.35);
    targetPositions.forEach(pos => this.fillAbilityTile(pos));
  }

  private attemptAbility(unit: Unit, ability: AbilityDefinition, targetPos: Position): void {
    if (this.actionQueue.isRunning) {
      return;
    }

    const canUse = this.abilityResolver.canUseAbility(
      ability,
      unit,
      targetPos,
      this.gameState.units,
      this.mapDefinition.width,
      this.mapDefinition.height
    );

    if (!canUse) {
      return;
    }

    this.clearAbilitySelection();
    const animationSteps = ability.animationSteps ?? [];
    this.queueAbilityExecution(unit, ability, animationSteps, targetPos);
  }

  private queueAbilityExecution(
    unit: Unit,
    ability: AbilityDefinition,
    animationSteps: AnimationStep[],
    targetPos: Position
  ): void {
    const steps = this.buildAbilityAnimationSteps(unit, ability, animationSteps, targetPos, () => {
      this.applyAbilityResults(ability, unit, targetPos);
    });

    steps.push(() => {
      this.applyAbilityCost(unit, ability);

      if (this.isUnitTurnComplete(unit)) {
        this.endUnitActivation(unit);
      } else {
        this.movementController.showMovementRange(unit, this.gameState.units);
        this.showActionMenu(unit);
        this.updateUI();
      }

      return Promise.resolve();
    });

    this.actionQueue.enqueueAll(steps);
  }

  private buildAbilityAnimationSteps(
    caster: Unit,
    ability: AbilityDefinition,
    animationSteps: AnimationStep[],
    targetPos: Position,
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
            return this.playTargetAnimation(caster, ability, targetPos, step, true);
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
            this.cameras.main.shake(step.duration ?? 200, step.intensity ?? 0.02);
            return this.wait(step.duration ?? 200);
          case 'wait':
            return this.wait(step.duration ?? 0);
          case 'sound':
            if (step.soundKey) {
              this.sound.play(step.soundKey);
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
    step: AnimationStep,
    resetToIdle: boolean
  ): Promise<void> {
    const animationType = step.animationType;
    if (!animationType) {
      return this.wait(step.duration ?? 0);
    }

    const spriteTargets = this.resolveAbilityTargets(ability, caster, targetPos)
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
        this.time.delayedCall(step.duration, () => {
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
    const sprite = this.add.sprite(fromWorld.x, fromWorld.y, projectileSprite, 0);
    sprite.setDepth(this.abilitySpriteDepth);
    sprite.setDisplaySize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);

    const frameTotal = this.textures.get(projectileSprite).frameTotal;
    if (frameTotal > 1) {
      const animKey = `${projectileSprite}-loop`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(projectileSprite, {
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
      this.tweens.add({
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
      const sprite = this.add.sprite(world.x, world.y, effectSprite, 0);
      sprite.setDepth(this.abilitySpriteDepth);
      sprite.setDisplaySize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
      return sprite;
    });

    const frameTotal = this.textures.get(effectSprite).frameTotal;
    const duration = step.effectDuration ?? (frameTotal > 0 ? (frameTotal / 12) * 1000 : 400);
    const animKey = `${effectSprite}-play`;
    if (frameTotal > 1 && !this.anims.exists(animKey)) {
      const frameRate = duration > 0 ? frameTotal / (duration / 1000) : 12;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(effectSprite, {
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
      this.time.delayedCall(duration, () => {
        sprites.forEach(sprite => sprite.destroy());
        resolve();
      });
    });
  }

  private resolveEffectPositions(ability: AbilityDefinition, targetPos: Position): Position[] {
    const radius = ability.targeting.radius;
    if (ability.targeting.pattern.startsWith('radius') && radius && radius > 0) {
      return this.getPositionsInRadius(targetPos, radius);
    }

    return [targetPos];
  }

  private resolveAbilityTargets(
    ability: AbilityDefinition,
    caster: Unit,
    targetPos: Position
  ): ResolvedTarget[] {
    return TargetingSystem.resolveTargets(
      caster,
      targetPos,
      ability.targeting,
      this.gameState.units,
      this.mapDefinition.width,
      this.mapDefinition.height
    );
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
        this.time.delayedCall(step.duration, () => {
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
      this.time.delayedCall(duration, resolve);
    });
  }

  private getTileCenter(position: Position): { x: number; y: number } {
    return {
      x: position.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2,
      y: position.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2
    };
  }

  private applyAbilityResults(ability: AbilityDefinition, caster: Unit, targetPos: Position): void {
    const targets = this.resolveAbilityTargets(ability, caster, targetPos);

    ability.effects.forEach(effect => {
      EffectResolver.applyEffect(effect, caster, targets, this.gameState.units, this.statusManager);
    });

    this.refreshStatusIndicators(targets);

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

  private processRoundStatusEffects(): void {
    if (this.gameState.currentPhase !== GameConfig.PHASES.PLAYER_ACTIVATION) {
      return;
    }

    if (this.actionQueue.isRunning) {
      return;
    }

    if (this.gameState.currentRound === this.lastProcessedRound) {
      return;
    }

    this.lastProcessedRound = this.gameState.currentRound;

    const activeUnits = this.gameState.units.filter(unit => unit.stats.hp > 0);
    if (activeUnits.length === 0) {
      return;
    }

    activeUnits.forEach(unit => {
      this.applyTriggeredStatusEffects(unit, 'on_round_start');
    });

    this.refreshStatusIndicators(
      this.gameState.units.map(unit => ({ position: unit.position, unit }))
    );
  }

  private applyTriggeredStatusEffects(unit: Unit, triggerType: TriggerType): void {
    const triggered = this.statusManager.getTriggeredEffects(unit, triggerType);
    if (triggered.length === 0) {
      return;
    }

    const targets: ResolvedTarget[] = [{ position: unit.position, unit }];

    triggered.forEach(triggeredStatus => {
      for (let i = 0; i < triggeredStatus.stacks; i++) {
        triggeredStatus.effects.forEach(effect => {
          EffectResolver.applyEffect(effect, unit, targets, this.gameState.units, this.statusManager);
        });
      }

      const definition = this.statusManager.getDefinition(triggeredStatus.statusId);
      definition?.animationSteps?.forEach(step => {
        if (step.type === 'effect_visual') {
          this.actionQueue.enqueue(() => this.playEffectVisual(step, {
            id: 'status',
            name: 'status',
            description: '',
            trigger: { type: triggerType },
            cost: { type: 'free' },
            targeting: { pattern: 'self', range: 0 },
            effects: []
          } as AbilityDefinition, unit.position));
        }
      });
    });

    this.unitController.updateHealthText(unit);
    if (unit.stats.hp <= 0) {
      this.playDeathAnimation(unit);
    }

    this.refreshStatusIndicators(targets);
  }

  private processTurnEndStatuses(unit: Unit): void {
    this.applyTriggeredStatusEffects(unit, 'on_turn_end');
    this.statusManager.tickStatuses(unit);
    this.refreshStatusIndicators([{ position: unit.position, unit }]);
  }

  private refreshStatusIndicators(targets: ResolvedTarget[]): void {
    targets
      .map(target => target.unit)
      .filter((unit): unit is Unit => Boolean(unit))
      .forEach(unit => {
        const hasPoison = this.statusManager.hasStatus(unit, 'poison') && unit.stats.hp > 0;
        this.unitController.setStatusIndicator(unit.id, hasPoison ? this.statusIndicatorKey : null);
      });
  }

  private playDeathAnimation(unit: Unit, direction?: Direction): void {
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

  private applyAbilityCost(unit: Unit, ability: AbilityDefinition): void {
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

  private isAbilityDisabled(unit: Unit, ability: AbilityDefinition): boolean {
    if (ability.cost.type === 'main_action') {
      return unit.hasUsedMainAction;
    }

    if (ability.cost.type === 'movement') {
      return unit.hasUsedMovement;
    }

    return false;
  }

  private fillAbilityTile(pos: Position): void {
    const x = pos.x * GameConfig.TILE_SIZE;
    const y = pos.y * GameConfig.TILE_SIZE;
    this.abilityHighlightGraphics.fillRect(x, y, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
  }

  private loadMapDefinition(): MapDefinition {
    const cachedMap = this.cache.tilemap.get('basicMap') as unknown;
    const mapData = this.extractMapData(cachedMap);
    const tileDefs = this.cache.json.get('tileDefs') as TileDefinition[] | undefined;

    if (!tileDefs) {
      throw new Error('Tile definitions failed to load.');
    }

    const mapDefinition = MapLoader.fromTiledJson(mapData, tileDefs);

    this.tileDefLookup.clear();
    tileDefs.forEach(def => this.tileDefLookup.set(def.gid, def));

    return mapDefinition;
  }

  private extractMapData(cachedMap: unknown): MapData {
    if (cachedMap && typeof cachedMap === 'object') {
      if ('layers' in cachedMap) {
        return cachedMap as MapData;
      }
      if ('data' in cachedMap && cachedMap.data && typeof cachedMap.data === 'object' && 'layers' in cachedMap.data) {
        return cachedMap.data as MapData;
      }
    }

    throw new Error('Map data is missing or invalid.');
  }
}