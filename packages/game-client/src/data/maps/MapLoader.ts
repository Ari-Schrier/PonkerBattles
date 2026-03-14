import type { MapData, MapDefinition, MapLayer, MapObject, Objective, TileDefinition } from '@battlegame/game-core';

export class MapLoader {
  static fromTiledJson(mapData: MapData, tileDefs: TileDefinition[]): MapDefinition {
    const groundLayer = this.getLayer(mapData.layers, ['Ground', 'Tile Layer 1']);
    const overlayLayer = this.getLayer(mapData.layers, ['Overlay', 'Tile Layer 2']);
    const objectLayer = this.getLayer(mapData.layers, 'Objects');

    if (!groundLayer?.data) {
      throw new Error('Ground layer missing tile data.');
    }

    const overlayData = overlayLayer?.data ?? new Array(mapData.width * mapData.height).fill(0);

    const objectiveMarkers = this.getObjectiveMarkers(overlayData, mapData.width, tileDefs);

    const objects = objectLayer?.objects ?? [];
    const objectives = [
      ...objects
        .filter(obj => obj.type === 'objective')
        .map((obj, index) => this.toObjective(obj, index, mapData.tilewidth, mapData.tileheight)),
      ...objectiveMarkers
    ];

    const spawnPoints = objects.filter(obj => obj.type === 'spawn');

    return {
      width: mapData.width,
      height: mapData.height,
      tilewidth: mapData.tilewidth,
      tileheight: mapData.tileheight,
      groundLayer: groundLayer.data,
      overlayLayer: overlayData,
      tileDefs,
      objectives,
      spawnPoints
    };
  }

  static getTileDefByGid(tileDefs: TileDefinition[], gid: number): TileDefinition | undefined {
    return tileDefs.find(def => def.gid === gid);
  }

  private static getLayer(layers: MapLayer[], names: string | string[]): MapLayer | undefined {
    const nameList = Array.isArray(names) ? names : [names];
    return layers.find(layer => nameList.includes(layer.name));
  }

  private static toObjective(obj: MapObject, index: number, tilewidth: number, tileheight: number): Objective {
    return {
      id: obj.name || `objective_${index + 1}`,
      position: {
        x: Math.floor(obj.x / tilewidth),
        y: Math.floor(obj.y / tileheight)
      },
      controlledBy: null
    };
  }

  private static getObjectiveMarkers(overlayData: number[], mapWidth: number, tileDefs: TileDefinition[]): Objective[] {
    const markerGids = new Set(tileDefs.filter(def => def.objectiveMarker).map(def => def.gid));
    if (markerGids.size === 0) {
      return [];
    }

    const objectives: Objective[] = [];
    overlayData.forEach((gid, index) => {
      if (!gid || !markerGids.has(gid)) {
        return;
      }
      const x = index % mapWidth;
      const y = Math.floor(index / mapWidth);
      objectives.push({
        id: `objective_${objectives.length + 1}`,
        position: { x, y },
        controlledBy: null
      });
    });

    return objectives;
  }
}