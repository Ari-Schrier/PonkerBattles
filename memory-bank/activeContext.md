# Active Context

## Current focus
Map authoring pipeline improvements: supporting BasicMap.tmj from Tiled, explicit tileDefs mapping, and scalable rendering so tile size can be tuned via config.

## Confirmed decisions
- Phaser 3 engine with TypeScript
- Build tooling: Vite + npm
- Local hotseat (single-machine) play for MVC
- One 25x25 tile map (BasicMap.tmj) for current iteration; three units per side (Hunter, Soldier, Thief)
- Four rounds, three objectives, objective control radius of two tiles
- Canonical hit and damage rules from design doc are active for MVC
- Character spritesheets: 32x32 frames, displaying frame 0 for static sprites
- Map tileset: 16x16 tiles (world.png from punyworld tileset) rendered at configurable TILE_SIZE
- Units get **movement + main action** per activation; main action can be attack or dash (second move)
- Attack-first is allowed; opportunity attacks deferred
- Activated units dim via alpha (including HP text)
- Defeated units show the corpse frame (index 24) instead of fading
- Key milestone-1 exclusions (no AI, no party builder, no shop/editor/upload, no animation system, no networking)

## Completed implementation
1. ✅ Project scaffolding (TypeScript, Vite, npm, package.json, tsconfig.json, vite.config.ts)
2. ✅ Centralized game config (`src/config/gameConfig.ts`) with all balance constants
3. ✅ Type definitions (`src/engine/types.ts`) for core game entities
4. ✅ Data files:
   - `blueTeam.json` and `redTeam.json` with Hunter, Soldier, Thief stats
   - `map01.json` as original Tiled JSON (22x22 grid)
   - `BasicMap.tmj` as current Tiled map (25x25 grid, Tile Layer 1/2)
   - `tileDefs.basicmap.stub.json` generated from BasicMap gids (explicit mapping)
5. ✅ Engine modules:
   - `CombatResolver.ts` - canonical hit/damage formulas
   - `MovementEngine.ts` - legal move calculation with flood fill
   - `ObjectiveController.ts` - control radius checks and scoring
   - `TurnManager.ts` - phase transitions and round progression
6. ✅ Phaser scenes:
   - `PreloadScene.ts` - asset loading with spritesheets
   - `BattleScene.ts` - main gameplay with map, units, interaction
   - `ResultsScene.ts` - winner display and restart
7. ✅ Fixed spritesheet loading (32x32 frames, display frame 0)
8. ✅ Two-action economy: `hasUsedMovement` / `hasUsedMainAction`, dash support, action status UI
9. ✅ In-world HP labels above units (current/max)
10. ✅ Activation dimming and corpse frame on death

## Current state
- Game loop is functional: unit selection → movement/attack → alternating activations → round end → winner determination
- Map now loads from `BasicMap.tmj` with Tile Layer 1/2 (ground + overlay)
- Tile defs use explicit gid mapping, with objective markers flagged via `objectiveMarker`
- Movement range highlighting (green), dash range (blue), and attack targets (red) working
- Objective control visual feedback (color changes based on controlling team, updated at round end; ties go neutral, uncontested holds)
- UI displays round, active team, objective scores, and selected unit info (action status included)
- Units show HP labels above them; activated units are dimmed; defeated units display corpse frame
- Rendering scale is controlled by `GameConfig.TILE_SIZE` (tilemap layers scale from 16px source tiles)

## Known issues / testing needed
- Full gameplay loop needs end-to-end testing
- Combat resolution needs playtesting for balance verification
- Objective control scoring at round end needs validation (including contested neutral and uncontested hold behavior)
- Confirm corpse frame index is consistent across all spritesheets

## Immediate next steps
1. Review `tileDefs.basicmap.stub.json` and assign correct terrain categories (stairs/roads/water/cliffs)
2. Validate objective marker placements from gid 708 in BasicMap
3. Tune `GameConfig.TILE_SIZE` for desired readability
4. Comprehensive gameplay testing (full match from start to finish)

## Implementation guidance
- Config remains source-of-truth for all tunable values
- Rules logic is cleanly separated from rendering
- Prioritize functional correctness over polish for MVC milestone