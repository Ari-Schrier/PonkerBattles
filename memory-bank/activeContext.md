# Active Context

## Current focus
BattleScene refactor complete; stabilize the gameplay loop, test edge cases, and polish ability/status visuals.

## Recent changes
- Completed BattleScene refactor phases 4–5: InputController + GameFlowController extracted.
- Ability system integrated with ActionQueue, including status indicators/animations.
- BasicMap.tmj load pipeline with explicit tileDefs mapping.

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