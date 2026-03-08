# Tech Context

## Platform and deployment
- Target runtime: modern web browsers (ES2020+)
- Deployment target: **Azure Static Web Apps**
- MVC requires no backend services
- Build output: `dist/` directory via Vite

## Engine and language (CONFIRMED)
- Engine: **Phaser 3.80.1**
- Language: **TypeScript 5.3.3** (confirmed choice for maintainability)
- Build tool: **Vite 5.1.3**
- Package manager: **npm**

## Existing repository context
- Design documentation: `Design Docs/Tactics Game.pdf`
- Art assets: `assets/` directory
  - Character spritesheets: 32x32 frames, 29 columns × 8 rows (Hunter, Soldier, Thief in Blue/Red variants)
- Tileset: `world.png` (16x16 tiles, 27×65 grid = 1755 tiles; punyworld overworld set)

## Technical constraints
- Keep rules values editable via centralized config (`gameConfig.ts`)
- Avoid hard-coded balance constants inside gameplay flow logic
- Keep architecture simple and modular for early iteration
- Spritesheet frames are 32x32 in Phaser, displayed at 32x32

## Actual implemented project structure
```
src/
├── config/
│   └── gameConfig.ts          # All balance constants and game rules
├── data/
│   ├── maps/
│   │   └── map01.json         # Tiled JSON export (22×22 grid)
│   ├── units/
│   │   ├── blueTeam.json      # 3 blue units (Hunter, Soldier, Thief)
│   │   └── redTeam.json       # 3 red units
│   └── objectives.json        # 3 objective positions
├── engine/
│   ├── types.ts               # TypeScript interfaces
│   ├── CombatResolver.ts      # Hit/damage formulas
│   ├── MovementEngine.ts      # Pathfinding and legal moves
│   ├── ObjectiveController.ts # Control checks and scoring
│   └── TurnManager.ts         # Phase transitions and rounds
├── scenes/
│   ├── PreloadScene.ts        # Asset loading
│   ├── BattleScene.ts         # Main gameplay
│   └── ResultsScene.ts        # Winner display
└── main.ts                    # Phaser game instance
```

## Key technical decisions

### TypeScript Configuration
- Module: ESNext, bundler resolution
- Path aliases: `@config`, `@engine`, `@scenes`, `@data`, `@ui`
- Strict mode enabled for type safety

### Vite Configuration
- Dev server on port 3000
- Code splitting: Phaser in separate chunk
- Asset handling: images, JSON, tilemaps
## Spritesheet Loading
- **Method**: `load.spritesheet()` with frame configuration
- **Frame size**: 32×32 pixels
- **Display size**: Derived from `GameConfig.TILE_SIZE` for readability (map tiles scaled from 16px source tiles)
- **Frame display**: Frame 0 only for MVC (no animation)

### Data Format Choices
- **Map data**: Tiled JSON export (industry standard, editor-friendly)
- **Unit data**: JSON files (easy to edit, no rebuild needed)
- **Config data**: TypeScript const object (type-safe, IDE autocomplete)

## Development workflow
- `npm run dev`: Start Vite dev server with hot reload
- `npm run build`: TypeScript compilation + Vite production build
- `npm run preview`: Test production build locally

## CI/CD note
User handling Azure Static Web Apps deployment separately (no GitHub Actions workflow included in scaffold).

## Performance considerations
- 25×25 map = 625 tiles (well within Phaser limits)
- 6 units total (minimal sprite count)
- No animations in MVC (reduces draw calls)
- Flood-fill movement calculation is O(n) where n = reachable tiles (acceptable for this scale)

## Browser compatibility
- Target: Modern browsers with ES2020+ support
- Phaser 3 supports: Chrome, Firefox, Safari, Edge (recent versions)
- No polyfills needed for target audience