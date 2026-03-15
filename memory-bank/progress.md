# Progress

## Current status
Phase 3 migration completed: persistence model with Match/TurnEvent schemas, serialization layer, storage adapters, and server-authoritative turn resolution. Ready for Phase 4 (Azure Functions API).

## Recent changes
- **Phase 3 Persistence Layer**:
  - Created `packages/game-core/src/persistence/` with schemas, serialization, repositories, and TurnResolver
  - Implemented Match and TurnEvent canonical schemas with optimistic concurrency support
  - Built bidirectional GameState ↔ Match serialization with lossless round-trip validation
  - Created IMatchRepository and ITurnHistoryRepository interfaces with in-memory test implementations
  - Implemented `resolveTurn()` for server-authoritative turn processing with partial turn support
  - Integrated status effect triggers (round/turn start/end) into turn resolution
  - Fixed RNG seed progression for deterministic replay capability
-  - Added comprehensive test coverage (serialization: 8/8 passing, TurnResolver: 12/12 passing)
  - Exported all persistence types from `@battlegame/game-core` package
  
- **Phase 2 (completed 2026-03-14)**:
  - Created npm workspaces and moved engine/config into `packages/game-core`
  - Added `ActionResolver.resolveAction()` API for server-authoritative action processing
  - Migrated client to `packages/game-client` and updated all imports to `@battlegame/game-core`
  - Fixed TS/Vite configs, enabled composite build, and updated test imports
  - Workspace builds/tests run cleanly

## Remaining (MVC)
- End-to-end 4-round match testing and AoO edge cases
- Validate objective scoring (contested/ties) and winner determination
- Verify corpse frame index consistency across spritesheets
- Playtest balance (hit rates, damage, status timing)
- Finalize terrain categories in tileDefs and objective marker validation

## Remaining (Migration to Azure)
- **Phase 4**: Azure Functions API (create/get/list/submit turn endpoints)
- **Phase 5**: Auth and identity (JWT validation + match authorization)
- **Phase 6**: Production hardening (observability, cost guardrails)

## Recent log (latest)
- 2026-03-15: Phase 3 migration completed (persistence schemas, serialization, repositories, turn resolution with partial turn support and status triggers)
- 2026-03-14: Phase 2 migration completed (game-core/game-client split, resolveAction API, workspace builds/tests)
- 2026-03-10: BattleScene refactor phases 4–5 complete
- 2026-03-09: Ability/status visuals and animation sequencing added