# Active Context

## Current focus
Expanding the MVC combat loop with the two-action economy (movement + main action), plus in-battle visibility improvements (HP labels, activation dimming, corpse frame on death). Recent work focused on bug fixes around action gating and clearer turn feedback.

## Confirmed decisions
- Phaser 3 engine with TypeScript
- Build tooling: Vite + npm
- Local hotseat (single-machine) play for MVC
- One 22x22 tile map, three units per side (Hunter, Soldier, Thief)
- Four rounds, three objectives, objective control radius of two tiles
- Canonical hit and damage rules from design doc are active for MVC
- Character spritesheets: 32x32 frames, displaying frame 0 for static sprites
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
8. ✅ Two-action economy: `hasUsedMovement` / `hasUsedMainAction`, dash support, action status UI
9. ✅ In-world HP labels above units (current/max)
10. ✅ Activation dimming and corpse frame on death

## Current state
- Game loop is functional: unit selection → movement/attack → alternating activations → round end → winner determination
- Units display correctly as single sprites (not full sheets)
- Movement range highlighting (green), dash range (blue), and attack targets (red) working
- Objective control visual feedback (color changes based on controlling team, updated at round end; ties go neutral, uncontested holds)
- UI displays round, active team, objective scores, and selected unit info (action status included)
- Units show HP labels above them; activated units are dimmed; defeated units display corpse frame

## Known issues / testing needed
- Full gameplay loop needs end-to-end testing
- Combat resolution needs playtesting for balance verification
- Objective control scoring at round end needs validation (including contested neutral and uncontested hold behavior)
- Confirm corpse frame index is consistent across all spritesheets

## Immediate next steps
1. Comprehensive gameplay testing (full match from start to finish)
2. Validate combat formulas produce expected results
3. Test objective control transitions between rounds
4. Validate activation dimming resets correctly each round
5. Optional: add HP color-coding for quick readability
6. Document deployment process for Azure Static Web Apps (user handling separately)

## Implementation guidance
- Config remains source-of-truth for all tunable values
- Rules logic is cleanly separated from rendering
- Prioritize functional correctness over polish for MVC milestone