# System Patterns

## Architectural approach (MVC)
Data-driven Phaser architecture: balance values live in config, gameplay logic is pure, and scenes/controllers focus on rendering/input. Phase 2 introduces a monorepo split with a shared `game-core` package for deterministic rules.

## Core principles
1. **Config-first rules**: All tunable values in `gameConfig.ts`.
2. **Engine is pure**: No Phaser dependencies in `src/engine/*`.
3. **Scenes are thin**: Rendering + input only; delegate logic to controllers/engine.
4. **Data externalized**: JSON for units, maps, abilities, statuses.
5. **Strict types**: Shared interfaces in `src/engine/types.ts`.

## High-level modules

### Configuration
- `packages/game-core/src/config/gameConfig.ts`

### Data
- `packages/game-client/src/data/units/*.json`
- `packages/game-client/src/data/maps/*.json`
- `packages/game-client/src/data/abilities.json`, `packages/game-client/src/data/statuses.json`

### Engine
- `packages/game-core/src/engine/*` (CombatResolver, MovementEngine, ObjectiveController, TurnManager, TerrainRules)
- `packages/game-core/src/engine/types.ts`
- `packages/game-core/src/ActionResolver.ts` for `resolveAction()` API

### Scenes + Controllers
- `packages/game-client/src/scenes/*` (PreloadScene, BattleScene, ResultsScene)
- Controllers: AbilityController, StatusEffectController, ActionMenuController, InputController, GameFlowController
- Supporting: MovementController, CombatController, UnitController, UIController, ActionQueue

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

## Persistence Layer Architecture (Phase 3)

### Overview
Server-authoritative persistence model for asynchronous multiplayer, supporting partial turn submission, optimistic concurrency, and deterministic replay.

### Components
- **Schemas** (`src/persistence/schemas.ts`)
- **Serialization** (`src/persistence/serialization.ts`)
- **Repositories** (`src/persistence/repositories.ts`)
- **TurnResolver** (`src/persistence/TurnResolver.ts`)

### Key Features
1. Canonical Match and TurnEvent schemas for Azure Cosmos DB
2. Lossless GameState ↔ Match serialization
3. Optimistic concurrency via version numbers and ETags
4. Partial turn submission (move now, attack later)
5. Turn event logging for replay/history
6. Status effect triggers integrated into turn resolution
7. Deterministic RNG seed progression

### Persistence Patterns

#### Match State Schema
```typescript
Match {
  id, version, _etag,           // Identity + concurrency
  status, createdAt, updatedAt,  // Lifecycle
  mapId, mapWidth, mapHeight,    // Configuration
  players[], activePlayerId,      // Participants
  currentRound, currentPhase, activeTeam, turnNumber,  // Game progress
  units[], objectives[], winner,  // State
  rngSeed,                        // Determinism
  lastProcessedTurnId             // Idempotency
}
```

#### Turn Resolution Flow
```
Client submits commands → resolveTurn() validates player/turn
→ Converts Match to GameState → Executes each command via resolveAction()
→ Fires status triggers (turn/round start/end) → Converts back to Match
→ Creates TurnEvent for history → Returns updated Match + TurnEvent
```

#### Serialization Strategy
- **Units**: Abilities stored by ID reference (not full definitions)
- **Objectives**: Position + control state
- **RNG**: Seed advances deterministically between actions
- **Round-trip validation**: Ensures no data loss in conversion

#### Partial Turn Support
- Commands don't auto-complete turn unless both movement and main action used
- Client can submit move command, then later submit attack command
- Each submission updates match version and creates turn event
- `endTurn` flag forces completion even with unused actions

#### Optimistic Concurrency
- Match version increments on each update
- Cosmos DB ETag prevents conflicting writes
- Client must provide expected version
- On conflict, server returns current version for retry

#### Repository Interfaces
```typescript
IMatchRepository {
  create(match)
  getById(matchId)
  update(match, expectedVersion)  // throws ConcurrencyError on mismatch
  listByPlayer(playerId, status?, limit?)
  delete(matchId)
}

ITurnHistoryRepository {
  append(turnEvent)
  getByMatch(matchId)
  getById(eventId)
  getByMatchRange(matchId, fromTurn, toTurn)
}
```

#### RNG Determinism
- Each match has a seed
- Seed advances via `rng.nextInt()` after each action
- Server and client can replay exact sequence
- Turn events store `rngSeedBefore` and `rngSeedAfter` for verification

#### Status Trigger Integration
- Round start: fires for all units at SETUP phase
- Turn start: fires when unit begins first action
- Turn end: fires after unit completes activation
- Round end: fires for all units after round completes

### Usage Pattern
```typescript
// Create match
const match = createMatch(matchId, mapId, width, height, players, initialState, seed);

// Submit turn (partial)
const result = await resolveTurn(
  match,
  playerId,
  turnId,
  [{ type: 'move', unitId: 'u1', path: [{ x: 5, y: 6 }] }],
  { abilities, statuses, mapWidth, mapHeight }
);

// Submit follow-up action
const result2 = await resolveTurn(
  result.match,
  playerId,
  turnId2,
  [{ type: 'attack', unitId: 'u1', targetId: 'u2' }]
);

// Force end turn
const result3 = await resolveTurn(
  match,
  playerId,
  turnId3,
  [],
  {},
  true  // endTurn
);
```

### Storage Strategy
- **Active matches**: Cosmos DB (SQL API) for queryability and concurrency
- **Turn history**: Blob Storage (append blobs) for cost-effective archival
- **In-memory implementations**: Provided for testing without infrastructure

### Testing
- Serialization round-trip validation (8/8 tests passing)
- Partial turn submission scenarios (TurnResolver 12/12 passing)
- Idempotency enforcement
- RNG seed progression
- Status trigger timing
- Concurrency conflict handling
