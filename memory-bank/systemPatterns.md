# System Patterns

## Architectural approach (MVC)
Data-driven Phaser architecture: balance values live in config, gameplay logic is pure, and scenes/controllers focus on rendering/input.

## Core principles
1. **Config-first rules**: All tunable values in `gameConfig.ts`.
2. **Engine is pure**: No Phaser dependencies in `src/engine/*`.
3. **Scenes are thin**: Rendering + input only; delegate logic to controllers/engine.
4. **Data externalized**: JSON for units, maps, abilities, statuses.
5. **Strict types**: Shared interfaces in `src/engine/types.ts`.

## High-level modules

### Configuration
- `src/config/gameConfig.ts`

### Data
- `src/data/units/*.json`
- `src/data/maps/*.json`
- `src/data/abilities.json`, `src/data/statuses.json`

### Engine
- `CombatResolver`, `MovementEngine`, `ObjectiveController`, `TurnManager`, `TerrainRules`
- `engine/types.ts`

### Scenes + Controllers
- Scenes: `PreloadScene`, `BattleScene`, `ResultsScene`
- Controllers: `AbilityController`, `StatusEffectController`, `ActionMenuController`, `InputController`, `GameFlowController`
- Supporting: `MovementController`, `CombatController`, `UnitController`, `UIController`, `ActionQueue`

## Key patterns

### Turn flow state machine
```
SETUP → PLAYER_ACTIVATION (alternate Blue/Red) → ROUND_END → [repeat or GAME_END]
```
TurnManager enforces alternation, round progression, and end conditions.

### Action sequencing
`ActionQueue` serializes movement/attack/ability animations to avoid nested callbacks.

### Movement + combat
Engine validates legality; controllers manage pathfinding/animations and call engine resolvers.

### Deterministic RNG
- `src/engine/RNG.ts` provides a seeded RNG for server-authoritative resolution.
- `CombatResolver.resolveAttack` accepts an optional RNG (defaults to `globalRNG`).
- Server uses seeded RNG; client may use `globalRNG` for previews.

### Data loader abstraction
- `IAbilityDataSource` interface decouples ability/status loading from `fetch()`.
- Browser loader remains in `AbilityDataLoader`, server will provide its own adapter later.

## Ability System Architecture (keep detailed)

### Overview
A data-driven ability system supporting activated/triggered abilities, composable effects, targeting patterns, and status effects.

### Components
- **TargetingSystem** (`src/engine/abilities/TargetingSystem.ts`)
- **EffectResolver** (`src/engine/abilities/EffectResolver.ts`)
- **StatusManager** (`src/engine/abilities/StatusManager.ts`)
- **AbilityResolver** (`src/engine/abilities/AbilityResolver.ts`)
- **TriggerManager** (`src/engine/abilities/TriggerManager.ts`)
- **AbilityDataLoader** (`src/engine/abilities/AbilityDataLoader.ts`)

### Data Files
- `src/data/abilities.json`
- `src/data/statuses.json`

### Key Features
1. JSON-driven abilities and statuses
2. Composable effects (damage, heal, push, pull, status, etc.)
3. Flexible targeting patterns (single, radius, line, cone, adjacent, etc.)
4. Trigger system (on_damage, on_death, on_turn_start, etc.)
5. Status effects share trigger/effect system
6. Animation sequencing via data-defined steps
7. Integrates with CombatResolver for attack effects
8. Supports cooldowns/charges/AI hints in schema

### Usage Pattern
```typescript
const statusManager = new StatusManager();
const abilityResolver = new AbilityResolver(statusManager);
const triggerManager = new TriggerManager(abilityResolver, statusManager);

const { abilities, statuses } = await AbilityDataLoader.loadAll();
triggerManager.registerAbilities(abilities);
statusManager.registerStatuses(statuses);

const result = abilityResolver.executeActivatedAbility(
  ability, caster, targetPos, units, mapWidth, mapHeight
);

triggerManager.onTurnStart(unit, units, mapWidth, mapHeight);
triggerManager.onDamageTaken(unit, damage, attacker, units, mapWidth, mapHeight);
```

### Integration points
- Units include `abilities?: ActiveAbility[]`.
- Ability animations enqueue steps on ActionQueue.
- Status visuals (tints/overlays/indicators) handled in StatusEffectController.

### Reference
See `src/engine/abilities/README.md` for full schema and examples.