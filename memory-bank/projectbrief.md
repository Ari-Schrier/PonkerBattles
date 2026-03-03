# Project Brief

## Project
Dungeon-fantasy, turn-based tactical skirmish game (working title: BattleGame), built as a static web app for Azure deployment.

## Core Vision
Combine:
- **Team/deck expression** (like party-building games)
- **Tactical, tile-based combat** with alternating activations

Deliver a focused **MVC** first, then expand.

## MVC Scope (Confirmed)
- Engine: **Phaser**
- Play mode: **local hotseat** (single machine)
- Map count: **1**
- Units: **3 per side** (predefined)
- Objectives: **3 control points**
- Rounds: **4**
- Input: mouse controls
- Visuals: tile map + unit sprites (no animation required in MVC)

## Canonical MVC Rules (Source of Truth)
- Objective control: majority of units within **2 tiles** of objective
- Hit check: `(2d10 - 8) + attackBonus >= evasion`
- Damage: reduced by armor, with minimum of **1**
- Unit activates once per round
- Win: most objectives controlled after 4 rounds

## Critical Product Constraint
Rules must be **configurable and easy to rebalance** (e.g., changing 4 rounds to 6 should be a config edit, not logic refactor).

## Out of Scope (Milestone 1)
- Party builder/custom roster UI
- Equipment shop/loadout editor
- Map upload/editor pipeline
- Unit animation system
- AI opponent
- Networking/multiplayer backend

## Deployment Target
- Azure Static Web App (no backend required for MVC gameplay loop)
