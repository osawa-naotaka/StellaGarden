import type { Pos2D } from "../lib/VoxelMap";
import type { GameState } from "./GameState";
import { ENTITY_TYPES, TERRAIN_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel } from "./world/TerrainDefs";

/** 選択中のツールに応じてタイルを操作するハンドラを生成して返す。 */
export function createInteractionHandler(gameState: GameState): (pos: Pos2D) => void {
    return (pos: Pos2D) => {
        const { voxelMap, player } = gameState;
        const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surfacePos);
        const tool = player.inventory.selectedTool;

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
    };
}
