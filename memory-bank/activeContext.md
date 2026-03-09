# Active Context

## Current focus
Ability system polish: animation sequencing, status effect visuals, and turn/round trigger consistency.

## Confirmed decisions
- Phaser 3 engine with TypeScript
- Build tooling: Vite + npm
- Local hotseat (single-machine) play for MVC
- One 25x25 tile map (BasicMap.tmj) for current iteration; three units per side (Hunter, Soldier, Thief)
- Four rounds, three objectives, objective control radius of two tiles
- Canonical hit and damage rules from design doc are active for MVC
- Character spritesheets: 32x32 frames, directional rows + animation columns used for runtime animations
- Map tileset: 16x16 tiles (world.png from punyworld tileset) rendered at configurable TILE_SIZE
- Units get **movement + main action** per activation; main action can be attack or dash (second move)
- Attack-first is allowed; attacks of opportunity trigger when moving away from adjacent enemies
- Activated units dim via alpha (including HP text)
- Defeated units show the corpse frame (index 24) instead of fading
- Key milestone-1 exclusions (no AI, no party builder, no shop/editor/upload, no networking)

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
11. ✅ Animation system with directional walk/attack/damage/death/idle sequences
12. ✅ A* pathfinding for obstacle-aware movement with segment-based tweening
13. ✅ Dodge animation on missed attacks
14. ✅ Attacks of opportunity (AoO) when moving away from adjacent enemies
15. ✅ Scene controllers split (Unit/UI/Movement/Combat) and ActionQueue sequencing
16. ✅ Terrain rules moved to `TerrainRules` module
17. ✅ Direction enum replaces numeric direction values across engine/controllers/tests
18. ✅ Ability system scaffolding with targeting, effects, triggers, statuses, and JSON definitions
19. ✅ Ability/action menu UI for selecting unit abilities
20. ✅ Hunters have Fireball and Thieves have Poison Strike via unit data
21. ✅ Ability animation sequencing extended with projectile/effect/target/camera steps
22. ✅ Poison Strike applies status with overlay indicator and poison bubbles
23. ✅ Fireball projectile + explosion visuals wired, with damage anim overlap support
24. ✅ Round-start status triggers (poison) and end-of-turn status ticks now supported

## Current state
- Game loop is functional: unit selection → movement/attack → alternating activations → round end → winner determination
- Ability system is initialized from JSON data loaded in PreloadScene
- Ability menu appears above selected unit showing activated abilities
- Ability targeting highlights appear when selecting an ability
- Ability execution applies damage/statuses and consumes action costs
- Status indicators now render above poisoned units and move with them
- Poison bubbles play at round start for all poisoned units
- Ability-based kills (e.g., fireball) now play death animation instead of freezing
- Map now loads from `BasicMap.tmj` with Tile Layer 1/2 (ground + overlay)
- Tile defs use explicit gid mapping, with objective markers flagged via `objectiveMarker`
- Movement range highlighting (green), dash range (blue), and attack targets (red) working
- Movement uses A* pathing and plays directional walk animations along the path
- Objective control visual feedback (color changes based on controlling team, updated at round end; ties go neutral, uncontested holds)
- UI displays round, active team, objective scores, and selected unit info (action status included)
- Units show HP labels above them; activated units are dimmed; defeated units display corpse frame
- Rendering scale is controlled by `GameConfig.TILE_SIZE` (tilemap layers scale from 16px source tiles)
- Movement/combat sequencing uses shared ActionQueue for animations
- Terrain walkability and movement costs are centralized in `TerrainRules`
- Direction is now an enum (`Direction`) instead of magic numbers
- AoO triggers once at movement start (adjacent enemies at start who are not adjacent at destination)
- AoO deaths now end the moving unit's activation and leave the corpse frame visible

## Known issues / testing needed
- Full gameplay loop needs end-to-end testing
- Combat resolution needs playtesting for balance verification
- Objective control scoring at round end needs validation (including contested neutral and uncontested hold behavior)
- Confirm corpse frame index is consistent across all spritesheets
- Verify AoO edge cases (multiple adjacent enemies, AoO + dodge + death) during full matches
- Validate round-start poison timing vs animation feel

## Immediate next steps
1. Polish ability animations and integrate with ActionQueue
2. Add ability-specific UI indicators (icons, cooldowns)
3. Add status effect visuals (tints/overlays)
4. Comprehensive gameplay testing with abilities and triggers

## Implementation guidance
- Config remains source-of-truth for all tunable values
- Rules logic is cleanly separated from rendering
- Prioritize functional correctness over polish for MVC milestone