# Progress

## Current status
Core MVC gameplay loop is active with two-action economy, HP labels, and improved visual feedback (activation dimming and corpse frames). Map pipeline now loads BasicMap.tmj with explicit tileDefs mapping and configurable render scale.

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
  - Unit sprite creation with frame 0 display
  - Objective visual markers with color-coded control status
  - Click-based interaction (select, move, attack)
  - Movement range highlighting (green) and attack targets (red)
  - Turn progression and UI updates
  - Two-action activation flow (movement + main action) with dash
  - In-world HP labels above units
  - Activation dimming (sprite + HP text)
  - Corpse frame on unit defeat (index 24)
- **ResultsScene.ts**: Winner announcement, color-coded results, click-to-restart

### Asset Integration
- Fixed spritesheet loading issue: Changed from `load.image()` to `load.spritesheet()` with 32x32 frame configuration
- Units now display as single sprites using `setFrame(0)`

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

## Technical debt / future considerations
- Animation system (out of scope for MVC, but spritesheet structure supports it)
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