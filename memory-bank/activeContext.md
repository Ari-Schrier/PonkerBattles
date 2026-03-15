# Active Context

## Current focus
Phase 3 migration completed: persistence model with canonical Match/TurnEvent schemas, serialization layer, storage adapter interfaces, and server-authoritative turn resolution.

## Recent changes
- Created persistence layer in `packages/game-core/src/persistence/`:
  - `schemas.ts`: Match, TurnEvent, UnitState, ObjectiveState types with ETag/version for optimistic concurrency
  - `serialization.ts`: Bidirectional GameState ↔ Match conversion with round-trip validation
  - `repositories.ts`: IMatchRepository and ITurnHistoryRepository interfaces with in-memory implementations
  - `TurnResolver.ts`: `resolveTurn()` and `createMatch()` for server-authoritative turn processing
- Implemented partial turn submission support (move first, attack later)
- Integrated status effect triggers (round/turn start/end) into turn resolution
- Fixed RNG seed progression for deterministic replay capability
- Added comprehensive test suites (serialization: 8/8 passing, TurnResolver: 12/12 passing)
- Updated `ActionResolver.ts` to advance RNG state between actions
- Exported all persistence types from `@battlegame/game-core` package

## Confirmed decisions
- Phaser 3 + TypeScript, Vite + npm
- MVC scope: hotseat play, one map, 3 units per side, 4 rounds, 3 objectives (radius 2)
- Config-first rules in `gameConfig.ts`
- Movement + main action per activation; attacks of opportunity on leaving adjacency
- Activated units dim; defeated units show corpse frame
- **Persistence decisions (Phase 3)**:
  - Abilities/statuses stored by ID reference (definitions separate from match state)
  - Player identity: simple name strings (for MVP)
  - Partial turn submission fully supported
  - Status triggers fire on round/turn boundaries
  - Optimistic concurrency via version numbers and ETags
  - Turn events stored for replay/history

## Current state
- Core loop functional in client package
- Shared engine builds in Node, tests passing, client builds successfully in workspace
- `resolveAction()` available for server-authoritative action processing (move/attack/ability/wait)
- **Persistence layer complete**:
  - Match state serialization lossless (validated by round-trip tests)
  - Turn resolution handles partial submissions, status triggers, RNG progression
  - Repository interfaces ready for Cosmos DB/Blob Storage implementations
  - Ready for Phase 4 (Azure Functions API)

## Known issues / testing needed
- End-to-end match testing and AoO edge cases
- Validate objective scoring (contested/ties)
- Verify corpse frame index consistency
- Validate round-start poison timing
- Turn resolution, serialization, and combat tests now all passing

## Immediate next steps
1. Begin Phase 4: Azure Functions API (create/get/list/submit turn endpoints)
2. Implement Cosmos DB repository for active matches
3. Implement Blob Storage repository for turn history
4. Continue MVC playtesting and objective scoring validation