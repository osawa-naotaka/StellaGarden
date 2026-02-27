import type { Pos2D } from "../lib/VoxelMap";
import type { GameState } from "./GameState";
import { ENTITY_TYPES, TERRAIN_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel } from "./Terrain";

export class InteractionSystem {
    private gameState: GameState;

    constructor(gameState: GameState) {
        this.gameState = gameState;
    }

    interact(pos: Pos2D): void {
        const { voxelMap, player } = this.gameState;
        const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surfacePos);
        const tool = player.toolbar[player.slotSelected];

        switch (tool) {
            case "watering_can":
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.soil) {
                    voxelMap.set(TERRAIN_TYPES.wetSoil, surfacePos);
                }
                break;
            case "shovel":
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass && getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none) {
                    if (surfacePos.y > 1) {
                        voxelMap.remove(surfacePos);
                    }
                }
                break;
            case "axe":
                if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.tree) {
                    voxelMap.set(voxel & 0x000000ff, surfacePos);
                }
                break;
            case "hoes":
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass && getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none) {
                    voxelMap.set(TERRAIN_TYPES.soil, surfacePos);
                }
                break;
        }
    }
}
