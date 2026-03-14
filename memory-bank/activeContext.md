# Active Context

## Current focus
Phase 2 migration completed: extracted shared `game-core` package with `resolveAction()` and moved client into `game-client` workspace for server/client reuse.

## Recent changes
- Created npm workspaces with `packages/game-core` and `packages/game-client`.
- Moved deterministic engine + config into `game-core`, added `ActionResolver.resolveAction()` API.
- Updated client imports to consume `@battlegame/game-core` and cleaned TS/Vite aliases.
- Added composite TypeScript build for `game-core` and updated test imports to relative paths.
- Adjusted `game-client` test script to allow no tests.

## Confirmed decisions
- Phaser 3 + TypeScript, Vite + npm.
- MVC scope: hotseat play, one map, 3 units per side, 4 rounds, 3 objectives (radius 2).
- Config-first rules in `gameConfig.ts`.
- Movement + main action per activation; attacks of opportunity on leaving adjacency.
- Activated units dim; defeated units show corpse frame.

## Current state
- Core loop functional in client package.
- Shared engine builds in Node, tests passing, client builds successfully in workspace.
- `resolveAction()` available for server-authoritative action processing (move/attack/ability/wait).

## Known issues / testing needed
- End-to-end match testing and AoO edge cases.
- Validate objective scoring (contested/ties).
- Verify corpse frame index consistency.
- Validate round-start poison timing.

## Immediate next steps
1. Decide if `resolveAction()` needs map dimensions/terrain adapter parameters for server use.
2. Begin Phase 3: persistence model (Match/Turn schemas + storage adapters).
3. Continue MVC playtesting and objective scoring validation.