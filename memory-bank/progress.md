# Progress

## Current status
Core MVC gameplay loop now includes full animation support, A* path-based movement, dodge feedback on misses, and attacks of opportunity with correct turn resolution. Map pipeline loads BasicMap.tmj with explicit tileDefs mapping and configurable render scale. Recent refactors introduced scene controllers, ActionQueue sequencing, TerrainRules, and Direction enum.

Ability animations and status effects are now wired: fireball projectile + explosion visuals, poison strike overlays, status indicators, and round-start poison damage with bubble animation. Ability-based kills (fireball) now play death animations instead of freezing.

## Completed

### Project Infrastructure (2026-03-02)
- Initialized TypeScript + Vite + npm project
- Configured `tsconfig.json` with path aliases (@config, @engine, @scenes, etc.)
- Configured `vite.config.ts` for asset handling and code splitting
- Created `package.json` with Phaser 3.80.1, TypeScript 5.3.3, Vite 5.1.3
- Set up `.gitignore` and `index.html` entry point
- Installed dependencies successfully

### Core Configuration & Data
- Created `src/config/gameConfig.ts` as single source of truth for balance constants
  - MAX_ROUNDS = 4, OBJECTIVE_CONTROL_RADIUS = 2
  - Hit formula: 2d10 - 8 + attackBonus >= evasion
  - MIN_DAMAGE = 1, TILE_SIZE = 32, MAP dimensions 22x22
- Created `src/engine/types.ts` with comprehensive TypeScript interfaces
- Created unit data files:
  - `blueTeam.json`: Hunter (HP 25, Move 5), Soldier (HP 35, Move 4), Thief (HP 20, Move 6)
  - `redTeam.json`: Same classes with mirrored starting positions
- Created `objectives.json` with 3 center-line objectives
- Created `map01.json` as Tiled JSON export (22x22 grid, basic terrain, spawn/objective markers)

### Engine Implementation
- **CombatResolver.ts**: Hit rolls (2d10), attack resolution, damage calculation with armor mitigation
- **MovementEngine.ts**: Flood-fill pathfinding, legal move calculation, adjacency checks
- **ObjectiveController.ts**: Control radius checks, majority determination, scoring, winner calculation
- TurnManager.ts: Phase state machine, alternating activation tracking (with uneven teams), round progression, game end detection

### Phaser Scenes
- **PreloadScene.ts**: Asset loading with progress bar, spritesheet configuration (32x32 frames)
- **BattleScene.ts**: 
  - Tilemap rendering from Tiled JSON
  - Unit sprite creation with idle animation and directional animation playback
  - Objective visual markers with color-coded control status
  - Click-based interaction (select, move, attack)
  - Movement range highlighting (green) and attack targets (red)
  - A* pathfinding with segmented movement tweens
  - Turn progression and UI updates
  - Two-action activation flow (movement + main action) with dash
  - In-world HP labels above units
  - Activation dimming (sprite + HP text)
  - Corpse frame on unit defeat (index 24), including AoO deaths
- **ResultsScene.ts**: Winner announcement, color-coded results, click-to-restart

### Refactors (2026-03-09)
- **Scene controllers**: UnitController, UIController, MovementController, CombatController
- **ActionQueue** for sequential action execution
- **TerrainRules** module for walkability + movement cost
- **Direction enum** replacing numeric direction values

### Asset Integration
- Fixed spritesheet loading issue: Changed from `load.image()` to `load.spritesheet()` with 32x32 frame configuration
- Units now display as single sprites using `setFrame(0)`
- AnimationManager creates directional animations for walk/attack/damage/death/idle

### Animation & Combat Updates (2026-03-08)
- Added `AnimationManager` for directional animation sequencing
- Added `currentDirection` to Unit type for facing
- Added animation timing config to `GameConfig` (frame rates, movement duration, dodge timing)
- Movement uses A* pathfinding with per-tile tweened walk animations
- Attacks play animation first, then resolve hit/damage and trigger damage/death animations
- Misses trigger dodge tween for defender
- Attacks of opportunity trigger when moving away from adjacent enemies
- AoO triggers only once per move (start → destination) and does not retrigger mid-path
- AoO deaths end activation and leave corpse frame visible

### Ability + Status Visuals (2026-03-09)
- Added fireball projectile/explosion animations with overlapping damage animation
- Added poison strike overlay + poisoned indicator sprite
- Added green poison bubbles status animation
- Poison now triggers at round start for all poisoned units (on_round_start)
- End-of-turn status triggers restored with per-unit duration tick
- Ability damage deaths now play death animation via BattleScene

### Map Pipeline Updates (2026-03-08)
- Added BasicMap.tmj (25x25, Tile Layer 1/2) as default map load
- Generated `tileDefs.basicmap.stub.json` with explicit gid mappings and objective marker gid 708
- Updated MapLoader to accept Tile Layer 1/2 and extract objectives from marker gids
- Patched BasicMap tileset metadata to reference `assets/tilesets/world.png` (16x16 tiles)
- Rendering scale now derived from `GameConfig.TILE_SIZE` (tilemap layers scale from 16px source tiles)
- GameConfig updated to match BasicMap map dimensions and configurable tile size

### Combat/Activation Updates (2026-03-06)
- Implemented two-action economy (movement + main action), dash support, and action tracking
- Fixed attack gating so units cannot repeat attacks after main action is used
- Added HP labels that update on damage and move with units
- Activation dimming for units that have acted; reset each round
- Corpses shown via frame 24 instead of fading sprites

## Remaining (MVC milestone)

### Testing & Validation
- End-to-end gameplay testing (full 4-round match)
- Combat formula verification (hit rates, damage values)
- Objective control scoring validation
- Round progression edge cases
- Winner determination in tie scenarios
- Verify corpse frame index on all spritesheets
- Validate BasicMap objective marker placements and terrain mappings
- Finalize terrain categories in `tileDefs.basicmap.stub.json`

### Polish (Optional for MVC)
- Visual feedback improvements
- UI/UX refinements
- Error handling and edge cases

### Deployment (User handling separately)
- Azure Static Web Apps configuration
- Build verification (`npm run build`)
- Production testing (`npm run preview`)

## Known issues / watch points
- Spritesheet loading: RESOLVED (using load.spritesheet with 32x32 frames)
- Movement calculation may need optimization for larger maps (acceptable for 22x22)
- Turn progression logic needs comprehensive testing
- Defeated unit handling needs validation (corpse frame index consistency)
- Validate round-start poison timing vs animation feel

## Technical debt / future considerations
- Animation system (now implemented; future enhancements could add abilities/spells)
- AI opponent (milestone 2+)
- Networked multiplayer (milestone 2+)
- Map editor/uploader (milestone 2+)
- Party builder UI (milestone 2+)
- Unit ability system beyond basic attack

## Change log
- 2026-03-02: Initial memory bank bootstrap
- 2026-03-02: Project scaffolding complete (TypeScript + Vite + Phaser)
- 2026-03-02: Core engine modules implemented
- 2026-03-02: All three Phaser scenes created
- 2026-03-02: Spritesheet loading issue identified and fixed
- 2026-03-02: Memory bank updated post-implementation
- 2026-03-06: Added two-action economy, HP labels, activation dimming, and corpse frames; fixed attack repeat bug
- 2026-03-08: Integrated BasicMap.tmj, generated tileDefs stub, added objective marker parsing, and made render scale configurable via TILE_SIZE
- 2026-03-09: Extracted scene controllers, added ActionQueue sequencing, centralized TerrainRules, and replaced direction numbers with Direction enum
- 2026-03-09: Added poison/fireball ability animation wiring, status indicators, round-start poison trigger, and ability death animation handling