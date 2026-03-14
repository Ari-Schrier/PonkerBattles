# Ability System Documentation

## Overview

This is a comprehensive, data-driven ability system for turn-based tactical RPGs. It provides a flexible, extensible architecture for defining abilities, status effects, targeting patterns, and effect resolution entirely through JSON data.

## Architecture

### Core Components

1. **Types** (`types.ts`) - TypeScript definitions for all system interfaces
2. **TargetingSystem** (`TargetingSystem.ts`) - Handles target validation and resolution
3. **EffectResolver** (`EffectResolver.ts`) - Executes individual ability effects
4. **StatusManager** (`StatusManager.ts`) - Manages active status effects on units
5. **AbilityResolver** (`AbilityResolver.ts`) - Orchestrates ability execution
6. **TriggerManager** (`TriggerManager.ts`) - Manages automatic ability triggering
7. **AbilityDataLoader** (`AbilityDataLoader.ts`) - Loads definitions from JSON

### Data Flow

```
Player Input → AbilityResolver → TargetingSystem → EffectResolver → StatusManager
                                       ↓
Game Events → TriggerManager → AbilityResolver (for triggered abilities)
```

## Quick Start

### 1. Initialize the System

```typescript
import { StatusManager } from './engine/abilities/StatusManager';
import { AbilityResolver } from './engine/abilities/AbilityResolver';
import { TriggerManager } from './engine/abilities/TriggerManager';
import { AbilityDataLoader } from './engine/abilities/AbilityDataLoader';

// Create managers
const statusManager = new StatusManager();
const abilityResolver = new AbilityResolver(statusManager);
const triggerManager = new TriggerManager(abilityResolver, statusManager);

// Load ability and status definitions
const { abilities, statuses } = await AbilityDataLoader.loadAll();

// Register definitions
triggerManager.registerAbilities(abilities);
statusManager.registerStatuses(statuses);
```

### 2. Add Abilities to Units

```typescript
// When loading or creating units, add abilities
unit.abilities = [
  {
    definitionId: 'melee_attack',
    triggerCount: 0
  },
  {
    definitionId: 'dash',
    triggerCount: 0
  },
  {
    definitionId: 'counterattack',
    triggerCount: 0
  }
];
```

### 3. Execute Activated Abilities

```typescript
// When player selects an ability and target
const ability = triggerManager.getAbility('melee_attack');
if (!ability) return;

// Check if ability can be used
const canUse = abilityResolver.canUseAbility(
  ability,
  caster,
  targetPosition,
  allUnits,
  mapWidth,
  mapHeight
);

if (canUse) {
  const result = abilityResolver.executeActivatedAbility(
    ability,
    caster,
    targetPosition,
    allUnits,
    mapWidth,
    mapHeight
  );
  
  // Handle result: update unit HP, apply statuses, play animations
  console.log('Ability result:', result);
}
```

### 4. Trigger Automatic Abilities

```typescript
// On turn start
const turnStartResults = triggerManager.onTurnStart(
  activeUnit,
  allUnits,
  mapWidth,
  mapHeight
);

// On damage taken
const damageResults = triggerManager.onDamageTaken(
  defender,
  damageAmount,
  attacker,
  allUnits,
  mapWidth,
  mapHeight
);

// On death
const deathResults = triggerManager.onDeath(
  deadUnit,
  killer,
  allUnits,
  mapWidth,
  mapHeight
);
```

## JSON Schema

### Ability Definition

```json
{
  "id": "unique_ability_id",
  "name": "Display Name",
  "description": "Human-readable description",
  "trigger": {
    "type": "activated|on_damage_taken|on_death|on_turn_start|etc",
    "chance": 1.0,
    "maxTriggers": 5,
    "cooldown": 2
  },
  "cost": {
    "type": "main_action|movement|free|reaction"
  },
  "targeting": {
    "pattern": "single_enemy|radius_enemies|self|etc",
    "range": 5,
    "minRange": 1,
    "radius": 2,
    "requiresLineOfSight": false,
    "canTargetSelf": true,
    "mustTargetEmpty": false,
    "mustTargetOccupied": true
  },
  "effects": [
    {
      "type": "damage|heal|attack|teleport|apply_status|etc",
      "amount": 2,
      "statusId": "poison",
      "statusDuration": 3
    }
  ],
  "animationSteps": [
    {
      "type": "caster_anim|projectile|effect_visual|etc",
      "animationType": "attack",
      "duration": 400
    }
  ],
  "cooldown": 3,
  "maxCharges": 5,
  "aiHints": {
    "priority": "high",
    "preferredTargetType": "low_hp",
    "role": "offensive",
    "useWhen": "Description of when AI should use"
  }
}
```

### Status Definition

```json
{
  "id": "unique_status_id",
  "name": "Display Name",
  "description": "Human-readable description",
  "duration": 3,
  "stackable": true,
  "maxStacks": 5,
  "triggers": [
    {
      "type": "on_turn_start",
      "chance": 1.0
    }
  ],
  "effects": [
    {
      "type": "damage",
      "amount": 1
    }
  ],
  "statModifiers": [
    {
      "stat": "attackBonus",
      "modifierType": "flat|percent|multiply",
      "amount": 2
    }
  ],
  "tint": 65280,
  "animationSteps": [
    {
      "type": "effect_visual",
      "effectSprite": "poison_damage",
      "effectDuration": 500
    }
  ]
}
```

## Trigger Types

- `activated` - Player-activated ability
- `on_damage_taken` - When unit takes damage
- `on_death` - When unit dies
- `on_kill` - When unit kills an enemy
- `on_turn_start` - At start of unit's turn
- `on_turn_end` - At end of unit's turn
- `on_round_start` - At start of each round
- `on_round_end` - At end of each round
- `on_move` - When unit moves
- `on_dash` - When unit uses dash
- `on_stationary` - When turn ends without moving
- `on_attack` - When unit attacks
- `on_attacked` - When unit is attacked
- `on_miss` - When unit misses an attack
- `on_missed_by` - When attack against unit misses
- `on_ally_death` - When an ally dies
- `on_enemy_death` - When an enemy dies

## Targeting Patterns

- `self` - The caster
- `single_tile` - A single tile (may be empty)
- `single_unit` - A single unit
- `single_enemy` - A single enemy unit
- `single_ally` - A single ally unit
- `line` - All tiles in a line
- `radius` - All tiles within radius
- `radius_units` - All units within radius
- `radius_enemies` - All enemy units within radius
- `radius_allies` - All ally units within radius
- `adjacent` - Adjacent tiles (8-directional)
- `adjacent_units` - Adjacent units
- `adjacent_enemies` - Adjacent enemy units
- `cone` - Cone in a direction
- `all_enemies` - All enemy units on map
- `all_allies` - All ally units on map
- `all_units` - All units on map

## Effect Types

- `damage` - Deal direct damage
- `heal` - Restore health
- `attack` - Use unified combat system
- `teleport` - Move unit to target position
- `move` - Move unit (with pathfinding)
- `push` - Push unit away from caster
- `pull` - Pull unit toward caster
- `dash` - Grant extra movement action
- `apply_status` - Apply status effect
- `remove_status` - Remove status effect
- `modify_stat` - Permanently modify stat
- `spawn_entity` - Spawn new entity
- `kill` - Instant death
- `swap_positions` - Swap caster and target positions
- `create_hazard` - Create persistent hazard

## Integration with Existing Systems

### Combat Integration

The ability system integrates with your existing `CombatResolver`:

```typescript
// In EffectResolver, attack effects use the unified combat system
case 'attack':
  const attackResult = CombatResolver.resolveAttack(attacker, target.unit);
  return {
    success: attackResult.hit,
    damageDealt: attackResult.damage,
    unitKilled: attackResult.targetDefeated
  };
```

### Animation Integration

Abilities define animation sequences that can be executed through your existing `ActionQueue`:

```typescript
// In BattleScene or controller
for (const animStep of result.animationSequence) {
  actionQueue.enqueue(async () => {
    switch (animStep.type) {
      case 'caster_anim':
        await playUnitAnimation(caster, animStep.animationType);
        break;
      case 'projectile':
        await playProjectile(caster.position, target.position);
        break;
      case 'effect_visual':
        await playEffect(target.position, animStep.effectSprite);
        break;
    }
  });
}
```

## Example Abilities

See `src/data/abilities.json` for complete examples including:

- **Melee Attack** - Basic adjacent attack
- **Dash** - Grants extra movement
- **Fireball** - Area damage with projectile
- **Counterattack** - Automatic retaliation
- **Poison Strike** - Attack that applies status
- **Heal** - Restore ally HP
- **Teleport** - Instant repositioning
- **Execute** - High damage to low HP targets
- **Battle Cry** - AoE buff
- **Death Explosion** - Trigger on death

## Example Statuses

See `src/data/statuses.json` for complete examples including:

- **Poison** - Damage over time (stackable)
- **Attack Buff** - Increased attack power
- **Defense Buff** - Increased armor
- **Burn** - Fire damage over time
- **Regeneration** - Healing over time
- **Stun** - Cannot move
- **Slow** - Reduced movement
- **Berserk** - High attack, low defense
- **Shield** - Absorbs one hit
- **Thorns** - Damage on being attacked
- **Marked** - Take extra damage

## Best Practices

### 1. Keep Effects Atomic

Each effect should do one thing. Combine multiple effects for complex abilities:

```json
{
  "effects": [
    { "type": "attack" },
    { "type": "apply_status", "statusId": "poison", "statusDuration": 3 },
    { "type": "push", "distance": 1 }
  ]
}
```

### 2. Use Status Effects for Persistent Changes

Don't modify stats directly unless permanent. Use status effects with `statModifiers` for temporary changes.

### 3. Design for AI

Include `aiHints` in ability definitions to help future AI systems make good decisions:

```json
{
  "aiHints": {
    "priority": "high",
    "preferredTargetType": "low_hp",
    "role": "offensive",
    "useWhen": "Target below 50% HP"
  }
}
```

### 4. Leverage Conditional Effects

Use `condition` fields for situational effects:

```json
{
  "type": "damage",
  "amount": 10,
  "condition": {
    "type": "target_hp_below",
    "value": 2
  }
}
```

### 5. Animation Sequencing

Build cinematic ability sequences using multiple animation steps:

```json
{
  "animationSteps": [
    { "type": "caster_anim", "animationType": "cast", "duration": 500 },
    { "type": "projectile", "projectileSprite": "fireball", "projectileSpeed": 400 },
    { "type": "effect_visual", "effectSprite": "explosion", "effectDuration": 600 },
    { "type": "camera_shake", "intensity": 0.3, "duration": 200 },
    { "type": "sound", "soundKey": "explosion" }
  ]
}
```

## Testing

Basic validation is built into the data loader:

```typescript
const { abilities, statuses } = await AbilityDataLoader.loadAll();
const validation = AbilityDataLoader.validateAll(abilities, statuses);

if (!validation.valid) {
  console.error('Validation errors:', validation.abilityErrors, validation.statusErrors);
}
```

## Future Extensions

The system is designed to easily support:

- **Cooldowns** - Already in schema, just needs tracking per unit
- **Charges** - Limited uses per battle
- **Resource Costs** - Mana, stamina, etc.
- **Conditional Targeting** - "Target allies below 50% HP"
- **Multi-stage Abilities** - Abilities that resolve over multiple turns
- **Ability Upgrades** - Level up system for abilities
- **Equipment-granted Abilities** - Dynamic ability sets
- **Chain Abilities** - Abilities that unlock other abilities

## Performance Considerations

- Ability/status definitions are loaded once at startup
- Active abilities are stored as lightweight references (just `definitionId` and state)
- Effect resolution is synchronous and fast
- Targeting validation uses efficient spatial queries
- Status manager uses maps for O(1) lookups

## Debugging

Enable detailed logging:

```typescript
// In EffectResolver, StatusManager, etc.
console.log('Applying effect:', effect.type, 'to target:', target.unit?.name);
console.log('Status triggered:', statusId, 'on', triggerType);
```

Access debug information:

```typescript
// View all active statuses
const allStatuses = statusManager.getAllActiveStatuses();

// View all registered abilities
const allAbilities = triggerManager.getAllAbilities();

// Get unit's active statuses
const unitStatuses = statusManager.getStatuses(unit);
```

## License

This ability system is part of your tactical RPG game project.