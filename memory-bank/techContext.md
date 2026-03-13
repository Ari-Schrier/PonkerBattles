# Tech Context

## Platform and deployment
- Target runtime: modern web browsers (ES2020+)
- Deployment: Azure Static Web Apps (static, no backend)
- Build output: `dist/` via Vite

## Engine and tooling
- Engine: Phaser 3.80.1
- Language: TypeScript 5.3.3 (strict)
- Build tool: Vite 5.1.3
- Package manager: npm

## Technical constraints
- Balance values must remain centralized in `gameConfig.ts`.
- Avoid hard-coded rules inside gameplay flow logic.
- Keep engine logic Phaser-free for testability.

## Development workflow
- `npm run dev`: Vite dev server
- `npm run build`: TypeScript + Vite production build
- `npm run preview`: Preview production build

## Assets
- Spritesheets: 32×32 frames (directional rows)
- Tileset: `world.png` (16×16 tiles, punyworld set)

## Key notes
- Rendering scale derived from `GameConfig.TILE_SIZE`.
- Ability system is data-driven via JSON (see `systemPatterns.md`).