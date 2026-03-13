# Active Context

## Current focus
Phase 1 migration cleanup in progress: keep engine deterministic and Phaser-free to support server execution.

## Recent changes
- Extracted direction math into `DirectionUtils`; moved Phaser animations to `AnimationHelper`.
- Removed Phaser dependency from engine (deleted `AnimationManager`).
- Added deterministic RNG (`RNG.ts`) and updated `CombatResolver` to accept an RNG.
- Added `EnginePurity.test.ts` and `IAbilityDataSource` interface.

## Confirmed decisions
- Phaser 3 + TypeScript, Vite + npm.
- MVC scope: hotseat play, one map, 3 units per side, 4 rounds, 3 objectives (radius 2).
- Config-first rules in `gameConfig.ts`.
- Movement + main action per activation; attacks of opportunity on leaving adjacency.
- Activated units dim; defeated units show corpse frame.

## Current state
- Core loop functional: select unit → move/attack/ability → alternating activations → round end → winner.
- Ability targeting/execution working with animation sequencing and status ticks.
- UI shows round/team/objective scores and selected unit info.
- Map loads from BasicMap.tmj with movement highlights + A* pathing.

## Known issues / testing needed
- End-to-end match testing and AoO edge cases.
- Validate objective scoring (contested/ties).
- Verify corpse frame index consistency.
- Validate round-start poison timing.

## Immediate next steps
1. Add coordinate/animation helper utilities.
2. Polish ability animations + UI indicators.
3. Add status visuals (tints/overlays) and complete playtesting.