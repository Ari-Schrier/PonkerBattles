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
- **Type definitions** (`src/engine/types.ts`): Shared interfaces for Unit, GameState, Objective, Position, etc.

### Presentation Layer (Phaser Scenes)
- **PreloadScene** (`src/scenes/PreloadScene.ts`): Asset loading with spritesheets
- **BattleScene** (`src/scenes/BattleScene.ts`): Map rendering, unit display, input handling, visual feedback
- **ResultsScene** (`src/scenes/ResultsScene.ts`): Winner announcement and restart

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

### 5. Spritesheet management
- Load with `load.spritesheet()` specifying 32×32 frames
- Display single frame with `setFrame(0)` for static MVC
- Architecture supports future animation by changing frame index

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

## Future-ready considerations (post-MVC)
- **Ability system**: Add `abilities` array to Unit, define in JSON
- **Multiple maps**: Load different Tiled JSONs, keep same engine
- **Networked play**: GameState serialization ready, engine is deterministic
- **AI opponent**: Engine functions are pure, can be called by AI agent
- **Animation**: Spritesheets already configured, just add frame sequences

## Design principles enforced
1. **Config is king**: No magic numbers in logic code
2. **Engine is pure**: No Phaser imports in engine/
3. **Scenes are thin**: Render + input only, delegate logic to engine
4. **Data is external**: JSON files for all content, no hardcoded units/maps
5. **Types are strict**: TypeScript strict mode, interfaces for all game entities