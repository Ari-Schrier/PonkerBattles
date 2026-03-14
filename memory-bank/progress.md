# Progress

## Current status
Phase 2 migration completed: monorepo split with shared `game-core` and `game-client` packages. Engine builds and tests pass in Node; client builds in workspace.

## Recent changes
- Created npm workspaces and moved engine/config into `packages/game-core`.
- Added `ActionResolver.resolveAction()` API for server-authoritative action processing.
- Migrated client to `packages/game-client` and updated all imports to `@battlegame/game-core`.
- Fixed TS/Vite configs, enabled composite build, and updated test imports.
- Workspace builds/tests run cleanly (`npm run build:core`, `npm run build:client`, `npm run test`).

## Remaining (MVC)
- End-to-end 4-round match testing and AoO edge cases.
- Validate objective scoring (contested/ties) and winner determination.
- Verify corpse frame index consistency across spritesheets.
- Playtest balance (hit rates, damage, status timing).
- Finalize terrain categories in tileDefs and objective marker validation.

## Recent log (latest)
- 2026-03-14: Phase 2 migration completed (game-core/game-client split, resolveAction API, workspace builds/tests).
- 2026-03-10: BattleScene refactor phases 4–5 complete.
- 2026-03-09: Ability/status visuals and animation sequencing added.