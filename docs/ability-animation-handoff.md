# Ability Animation Integration Handoff

## Goal
Wire ability animations (defined in `AbilityDefinition.animationSteps`) into the existing `ActionQueue` sequence so abilities play caster/target/projectile/effect visuals using the project's spritesheet animations.

The current ability execution system applies effects but does **not** yet drive animations. This handoff explains where to integrate and what to implement.

---

## Current State

### Ability Execution (Engine)
- **AbilityResolver**: `src/engine/abilities/AbilityResolver.ts`
  - Executes ability effects and returns `AbilityResult` containing `animationSequence`.
- **EffectResolver**: `src/engine/abilities/EffectResolver.ts`
  - Applies damage/heal/status/etc. and updates unit HP.

### Gameplay Integration (Scene)
- **BattleScene**: `src/scenes/BattleScene.ts`
  - Ability selection UI and targeting are implemented.
  - Ability execution happens inside `attemptAbility()`.
  - Currently, `attemptAbility()` applies effects immediately and does **not** enqueue animations.

### Existing Animation Infrastructure
- **ActionQueue**: `src/scenes/controllers/ActionQueue.ts`
  - Queue of `() => Promise<void>` that run sequentially.
- **AnimationManager**: `src/engine/AnimationManager.ts`
  - Builds and plays directional animations (walk, attack, damage, death, idle).
- **CombatController**: `src/scenes/controllers/CombatController.ts`
  - Shows how attack animations are sequenced with `ActionQueue`.

---

## Where to Integrate Animations

### Primary Hook (BattleScene)
`attemptAbility()` in `src/scenes/BattleScene.ts` is the ideal integration point.

It currently:
1. Validates targeting
2. Executes ability (effects applied)
3. Updates HP and ends action

✅ Add a **new animation phase** between (2) and (3):

- Use `AbilityResult.animationSequence`
- Convert each `AnimationStep` into an `ActionQueue` step
- Wait for animation completion before applying effects (or apply effects at a configurable phase)

---

## Proposed Workflow

1. **Extract an `executeAbilityWithAnimations()` helper** in `BattleScene`:
   - Accepts `ability`, `caster`, `targetPos`, `targets`.
   - Builds `ActionQueue` steps based on `animationSequence`.
   - Uses `AnimationManager` for sprite animations.
   - Resolves when all steps complete.

2. **Decide when effects apply:**
   - Option A: Apply effects before animations (current behavior).
   - Option B (preferred): Apply effects *after* the “impact” animation step.
   - You can treat `AnimationStep.type === 'target_anim'` or `'effect_visual'` as the moment to apply effects.

3. **Add support for animation steps:**
   - `caster_anim`: Play animation on caster sprite.
   - `target_anim`: Play animation on target sprites.
   - `projectile`: Play a projectile sprite tween from caster → target.
   - `effect_visual`: Spawn effect sprite at target position for duration.
   - `camera_shake`: Use `this.cameras.main.shake()`.
   - `wait`: `setTimeout` promise.
   - `sound`: `this.sound.play(soundKey)`.

---

## File References

| File | Why it matters |
|------|----------------|
| `src/scenes/BattleScene.ts` | Insert animation execution in `attemptAbility()` |
| `src/scenes/controllers/ActionQueue.ts` | Queue steps sequentially |
| `src/engine/AnimationManager.ts` | Play directional sprite animations |
| `src/engine/abilities/types.ts` | `AnimationStep` definition |
| `src/engine/abilities/AbilityResolver.ts` | Produces `animationSequence` |

---

## Sprite Sheet Integration Notes

The project already uses a character spritesheet with directional animation rows:
- walk / attack / damage / death / idle are already created by `AnimationManager`.

If new animation types are needed (cast/shoot/etc):
1. Add an enum or extend `AnimationManager.createAnimationsForSprite()` to create `cast` / `shoot` animations.
2. Update `AnimationManager.playAnimation()` to handle those types.
3. Update `AbilityDefinition.animationSteps` to reference them.

For **visual-only effects** (projectiles, explosions):
- Add separate sprites to `PreloadScene`.
- Use temporary `Phaser.GameObjects.Sprite` and tween it.

---

## Minimal Animation Example

Example for Fireball (from `abilities.json`):

```json
"animationSteps": [
  { "type": "caster_anim", "animationType": "cast", "duration": 500 },
  { "type": "projectile", "projectileSprite": "fireball", "projectileSpeed": 400 },
  { "type": "effect_visual", "effectSprite": "explosion", "effectDuration": 600 }
]
```

Implementation idea:

```ts
if (step.type === 'caster_anim') {
  AnimationManager.playAnimation(casterSprite, caster.spriteKey, step.animationType, caster.currentDirection);
  return wait(step.duration);
}
```

---

## Suggested Helper Functions

Create helpers inside `BattleScene`:
- `playCasterAnimation(step)`
- `playTargetAnimation(step)`
- `playProjectile(step, from, to)`
- `playEffectVisual(step, position)`
- `wait(duration)`

These can return `Promise<void>` for `ActionQueue` compatibility.

---

## Suggested Implementation Order

1. **Add animation types to AnimationManager** if missing (`cast`, `shoot`).
2. **Add asset loading** for projectile/effects sprites.
3. **Implement `executeAbilityAnimations()` in BattleScene**.
4. **Integrate with ActionQueue** so animations don't overlap movement/attacks.
5. **Test with Fireball + Poison Strike**.

---

## Known Constraints

- The current unit spritesheet supports only base animations (walk/attack/damage/death/idle). Casting/shooting may need new frames or reuse attack animation.
- Ability effects are applied immediately; you may need to split effects vs animation timing.

---

## Next Step for Agent

Start with `attemptAbility()` in `BattleScene` and refactor:

```ts
// current flow
const result = abilityResolver.executeActivatedAbility(...)
applyAbilityResults(targets)
applyAbilityCost(unit, ability)

// new flow
const result = abilityResolver.executeActivatedAbility(...)
queue animation steps from result.animationSequence
applyAbilityResults(targets) at impact
```

Then test Fireball and Poison Strike with a temporary projectile sprite.

---

If you need more clarity on the animation spritesheet or new assets, ask the main user for details.
