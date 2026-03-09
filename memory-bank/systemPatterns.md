# System Patterns

## Architectural approach (MVC)
Use a **data-driven Phaser architecture** so game balance values live in config, not embedded in gameplay logic. Achieved through strict separation of concerns and externalized configuration.

## Implemented high-level modules

### Configuration Layer
- **GameConfig** (`src/config/gameConfig.ts`): Single source of truth for all balance constants
  - Match structure: rounds, units per side, objective count
  - Combat formulas: dice counts, hit thresholds, damage minimums
  - Map dimensions and tile size
  - Phase and team enums

### Data Layer
- **Unit definitions** (`src/data/units/*.json`): Stats, classes, starting positions
- **Map data** (`src/data/maps/*.json`): Tiled JSON with layers, objects, terrain
- **Objective data** (`src/data/objectives.json`): Positions and IDs

### Engine Layer (Game Logic)
- **TurnManager** (`src/engine/TurnManager.ts`): Phase transitions, active team tracking, round progression
- **CombatResolver** (`src/engine/CombatResolver.ts`): Hit resolution, damage calculation using config formulas
- **MovementEngine** (`src/engine/MovementEngine.ts`): Legal move calculation with flood-fill pathfinding
- **ObjectiveController** (`src/engine/ObjectiveController.ts`): Control radius checks, majority determination, scoring
- **TerrainRules** (`src/engine/TerrainRules.ts`): Walkability and movement cost rules derived from map + tile definitions
- **Type definitions** (`src/engine/types.ts`): Shared interfaces for Unit, GameState, Objective, Position, etc.

### Presentation Layer (Phaser Scenes)
- **PreloadScene** (`src/scenes/PreloadScene.ts`): Asset loading with spritesheets
- **BattleScene** (`src/scenes/BattleScene.ts`): Map rendering, unit display, input handling, visual feedback
- **ResultsScene** (`src/scenes/ResultsScene.ts`): Winner announcement and restart

### Scene Controllers (Presentation Helpers)
- **ActionQueue** (`src/scenes/controllers/ActionQueue.ts`): Sequential action execution for movement/combat
- **UnitController**: Unit sprites + health label management
- **UIController**: HUD and objective visuals
- **MovementController**: Movement + AoO sequencing, range highlights, movement rules delegation
- **CombatController**: Attack sequencing, hit/miss animations

## Key implementation patterns

### 1. Config-first rules
All tunable values externalized in `gameConfig.ts`:
```typescript
MAX_ROUNDS = 4
OBJECTIVE_CONTROL_RADIUS = 2
HIT_ROLL_DICE_COUNT = 2
HIT_ROLL_DICE_SIDES = 10
HIT_BASE_SUBTRACT = 8
MIN_DAMAGE = 1
```
Changing these values requires no code changes, only config edits.

### 2. Pure resolution functions
Combat and control checks are deterministic given inputs:
```typescript
CombatResolver.resolveAttack(attacker, defender) → AttackResult
ObjectiveController.determineControl(objective, units) → Team | null
MovementEngine.getLegalMoves(unit, occupied, mapSize) → Position[]
TerrainRules.isWalkable(pos) → boolean
TerrainRules.getMoveCost(pos) → number
```

### 3. State machine for turn flow
```
SETUP → PLAYER_ACTIVATION (alternate Blue/Red) → ROUND_END → [repeat or GAME_END]
```
- Teams alternate activations; if a team has no remaining units, the other team continues activating.
- Round ends only when both teams have exhausted activations.
Implemented in `TurnManager` with clear phase transitions.

### 4. Separation of rendering vs rules
- **Engine modules**: Pure TypeScript, no Phaser dependencies
- **Scenes**: Handle rendering, input, visual feedback
- **Data flow**: Scene → Engine (for validation) → Scene updates
Example: `BattleScene` calls `MovementEngine.getLegalMoves()` then renders highlights

### 5. Action sequencing via queue
- `ActionQueue` ensures movement/attack/AoO steps execute sequentially without nested callbacks.
- Controllers enqueue animation steps as Promises.

### 5. Spritesheet management
- Load with `load.spritesheet()` specifying 32×32 frames
- AnimationManager builds directional animations using spritesheet grid
- Idle animations use the first frame of each direction row
- Death animations end on corpse frame (index 24 per row)

## Canonical gameplay constants (externalized)
All values in `src/config/gameConfig.ts`:
- `MAX_ROUNDS = 4`
- `OBJECTIVE_COUNT = 3`
- `OBJECTIVE_CONTROL_RADIUS = 2` (tiles)
- `HIT_ROLL_DICE = '2d10'` (implemented as count + sides)
- `HIT_BASE_SUBTRACT = 8`
- `MIN_DAMAGE = 1`
- `TILE_SIZE = 32` (pixels)
- `MAP_WIDTH = 22`, `MAP_HEIGHT = 22` (tiles)

## Data structures

### GameState
Central state object passed to TurnManager:
```typescript
{
  currentRound: number,
  currentPhase: Phase,
  activeTeam: Team,
  units: Unit[],
  objectives: Objective[],
  winner: Team | null
}
```

### Unit
```typescript
{
  id, name, team, unitClass,
  spriteKey, stats, position,
  hasActivated: boolean,
  hasUsedMovement: boolean,
  hasUsedMainAction: boolean
}
```

### Combat Flow
1. User clicks adjacent enemy
2. BattleScene validates adjacency via MovementEngine
3. BattleScene calls CombatResolver.resolveAttack()
4. CombatResolver rolls 2d10, calculates hit, applies damage
5. BattleScene updates sprite (corpse frame on defeat) and HP labels
6. TurnManager.activateUnit() marks unit as activated and scene dims unit visuals
7. ObjectiveController updates control status (round end; retains previous owner if uncontested, neutral on tie)
8. BattleScene refreshes UI

## Movement + combat animation pattern
- `AnimationManager` centralizes animation creation and direction logic
- `ActionQueue` sequences movement and combat steps
- `MovementController` uses A* pathfinding + queued tweening for movement
- `CombatController` plays attack animation then resolves combat and reactions
- Attacks of opportunity enqueue before movement segments
- AoO deaths end activation immediately and keep corpse frame

## Ability System Architecture (Implemented)

### Overview
A comprehensive, data-driven ability system that supports activated and triggered abilities, status effects, flexible targeting, and composable effects.

### Components
- **TargetingSystem** (`src/engine/abilities/TargetingSystem.ts`): Validates and resolves targeting patterns
- **EffectResolver** (`src/engine/abilities/EffectResolver.ts`): Executes individual ability effects
- **StatusManager** (`src/engine/abilities/StatusManager.ts`): Manages active status effects on units
- **AbilityResolver** (`src/engine/abilities/AbilityResolver.ts`): Orchestrates ability execution
- **TriggerManager** (`src/engine/abilities/TriggerManager.ts`): Handles automatic ability triggering
- **AbilityDataLoader** (`src/engine/abilities/AbilityDataLoader.ts`): Loads definitions from JSON

### Data Files
- **abilities.json** (`src/data/abilities.json`): 10+ example ability definitions
- **statuses.json** (`src/data/statuses.json`): 12+ example status effect definitions

### Key Features
1. **JSON-driven content**: Abilities and statuses defined entirely in JSON
2. **Composable effects**: 15+ reusable effect types (damage, heal, teleport, push, pull, status, etc.)
3. **Flexible targeting**: 17+ targeting patterns (single, radius, line, cone, adjacent, etc.)
4. **Trigger system**: 17+ trigger types (on_damage, on_death, on_turn_start, etc.)
5. **Status effects**: Share same trigger/effect system as abilities
6. **Animation sequencing**: Multi-step animation definitions in data
7. **Unified combat**: Integrates with existing CombatResolver for attack effects
8. **Future-ready**: Supports cooldowns, charges, AI hints in schema

### Usage Pattern
```typescript
// Initialize system
const statusManager = new StatusManager();
const abilityResolver = new AbilityResolver(statusManager);
const triggerManager = new TriggerManager(abilityResolver, statusManager);

// Load and register definitions
const { abilities, statuses } = await AbilityDataLoader.loadAll();
triggerManager.registerAbilities(abilities);
statusManager.registerStatuses(statuses);

// Execute activated ability
const result = abilityResolver.executeActivatedAbility(
  ability, caster, targetPos, units, mapWidth, mapHeight
);

// Trigger automatic abilities
triggerManager.onTurnStart(unit, units, mapWidth, mapHeight);
triggerManager.onDamageTaken(unit, damage, attacker, units, mapWidth, mapHeight);
```

### Integration Points
- Units have optional `abilities?: ActiveAbility[]` array
- Abilities use existing CombatResolver for attack effects
- Animation steps integrate with ActionQueue
- Status tints can be applied to unit sprites

### Documentation
See `src/engine/abilities/README.md` for comprehensive documentation including:
- Quick start guide
- JSON schema reference
- Complete list of trigger types, targeting patterns, and effect types
- Integration examples
- Best practices
- Example abilities and statuses

## Future-ready considerations (post-MVC)
- **Multiple maps**: Load different Tiled JSONs, keep same engine
- **Networked play**: GameState serialization ready, engine is deterministic
- **AI opponent**: Engine functions are pure, can be called by AI agent; ability AI hints ready

## Design principles enforced
1. **Config is king**: No magic numbers in logic code
2. **Engine is pure**: No Phaser imports in engine/
3. **Scenes are thin**: Render + input only, delegate logic to engine
4. **Data is external**: JSON files for all content, no hardcoded units/maps
5. **Types are strict**: TypeScript strict mode, interfaces for all game entities