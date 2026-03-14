import type { MapDefinition, Position, TerrainCategory, TileDefinition } from './types';

export class TerrainRules {
  private mapDefinition: MapDefinition;
  private tileDefLookup: Map<number, TileDefinition>;

  constructor(mapDefinition: MapDefinition, tileDefs: TileDefinition[]) {
    this.mapDefinition = mapDefinition;
    this.tileDefLookup = new Map(tileDefs.map(def => [def.gid, def]));
  }

  getTileDef(pos: Position): TileDefinition | undefined {
    const index = pos.y * this.mapDefinition.width + pos.x;
    const overlayGid = this.mapDefinition.overlayLayer[index];
    const groundGid = this.mapDefinition.groundLayer[index];
    const gid = overlayGid && overlayGid !== 0 ? overlayGid : groundGid;
    return gid ? this.tileDefLookup.get(gid) : undefined;
  }

  isWalkable(pos: Position): boolean {
    const def = this.getTileDef(pos);
    if (!def) {
      return true;
    }
    return this.isWalkableCategory(def.terrainType);
  }

  getMoveCost(pos: Position): number {
    const def = this.getTileDef(pos);
    if (!def) {
      return 1;
    }
    return this.getMoveCostForCategory(def.terrainType);
  }

  private isWalkableCategory(category: TerrainCategory): boolean {
    return category === 'land' || category === 'forest';
  }

  private getMoveCostForCategory(category: TerrainCategory): number {
    switch (category) {
      case 'forest':
        return 2;
      case 'cliff':
      case 'water':
        return Number.POSITIVE_INFINITY;
      case 'land':
      default:
        return 1;
    }
  }
}