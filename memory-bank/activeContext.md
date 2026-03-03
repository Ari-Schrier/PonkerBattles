# Active Context

## Current focus
Initial Phaser project scaffolding is complete. The game now has a functional baseline with unit placement, movement, combat, and objective control. Currently addressing asset loading issues and preparing for full gameplay testing.

## Confirmed decisions
- Phaser 3 engine with TypeScript
- Build tooling: Vite + npm
- Local hotseat (single-machine) play for MVC
- One 22x22 tile map, three units per side (Hunter, Soldier, Thief)
- Four rounds, three objectives, objective control radius of two tiles
- Canonical hit and damage rules from design doc are active for MVC
- Character spritesheets: 32x32 frames, displaying frame 0 for static sprites
- Key milestone-1 exclusions (no AI, no party builder, no shop/editor/upload, no animation system, no networking)

## Completed implementation
1. ✅ Project scaffolding (TypeScript, Vite, npm, package.json, tsconfig.json, vite.config.ts)
2. ✅ Centralized game config (`src/config/gameConfig.ts`) with all balance constants
3. ✅ Type definitions (`src/engine/types.ts`) for core game entities
4. ✅ Data files:
   - `blueTeam.json` and `redTeam.json` with Hunter, Soldier, Thief stats
   - `objectives.json` with 3 objective positions
   - `map01.json` as Tiled JSON (22x22 grid, placeholder terrain)
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

## Current state
- Game loop is functional: unit selection → movement/attack → alternating activations → round end → winner determination
- Units display correctly as single sprites (not full sheets)
- Movement range highlighting (green) and attack targets (red) working
- Objective control visual feedback (color changes based on controlling team, updated at round end; ties go neutral, uncontested holds)
- UI displays round, active team, objective scores, and selected unit info

## Known issues / testing needed
- Full gameplay loop needs end-to-end testing
- Combat resolution needs playtesting for balance verification
- Objective control scoring at round end needs validation (including contested neutral and uncontested hold behavior)
- Edge cases: defeated units, tie scenarios, boundary conditions

## Immediate next steps
1. Comprehensive gameplay testing (full match from start to finish)
2. Validate combat formulas produce expected results
3. Test objective control transitions between rounds
4. Identify and fix any UX or visual issues
5. Polish pass on UI/feedback (optional for MVC)
6. Document deployment process for Azure Static Web Apps (user handling separately)

## Implementation guidance
- Config remains source-of-truth for all tunable values
- Rules logic is cleanly separated from rendering
- Prioritize functional correctness over polish for MVC milestone