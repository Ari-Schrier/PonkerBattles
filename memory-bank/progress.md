# Progress

## Current status
Core MVC loop is functional with controller refactor complete, abilities/statuses integrated, and BasicMap pipeline working. Phase 1 migration cleanup underway with engine now Phaser-free and deterministic RNG added.

## Recent changes
- BattleScene refactor phases 4–5 completed (InputController + GameFlowController).
- Ability/status animation sequencing via ActionQueue; status indicators and round-start poison triggers.
- BasicMap.tmj pipeline with explicit tileDefs mapping and render scaling.
- Phase 1 migration cleanup: DirectionUtils + AnimationHelper split, RNG added, CombatResolver updated, EnginePurity tests added.
- AoO handling updated with corpse frames and activation-ending behavior.

## Remaining (MVC)
- End-to-end 4-round match testing and AoO edge cases.
- Validate objective scoring (contested/ties) and winner determination.
- Verify corpse frame index consistency across spritesheets.
- Playtest balance (hit rates, damage, status timing).
- Finalize terrain categories in tileDefs and objective marker validation.

## Recent log (latest)
- 2026-03-10: BattleScene refactor phases 4–5 complete.
- 2026-03-09: Ability/status visuals and animation sequencing added.
- 2026-03-08: BasicMap.tmj pipeline and render scaling updates.