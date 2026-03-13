# Project Brief

## Project
Dungeon-fantasy, turn-based tactical skirmish game (BattleGame), built as a static web app for Azure deployment.

## Core vision
Combine party expression with tactical, tile-based combat and alternating activations. Deliver a focused MVC first, then expand.

## MVC scope
- Engine: Phaser
- Play mode: local hotseat
- Map count: 1
- Units: 3 per side
- Objectives: 3 control points
- Rounds: 4
- Input: mouse

## Canonical rules (source of truth)
- Objective control radius: 2 tiles
- Hit check: (2d10 - 8) + attackBonus >= evasion
- Damage: reduced by armor, minimum 1
- Unit activates once per round
- Win: most objectives after 4 rounds

## Constraint
Rules must be configurable via `gameConfig.ts`, not hard-coded in logic.

## Out of scope (MVC)
- Party builder / loadout UI
- Map editor/uploader
- AI opponent
- Networking

## Deployment target
Azure Static Web Apps (no backend).