import type { Inventory } from "../engine/Inventory";
import { ENTITY_TYPES, TERRAIN_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel } from "../engine/TerrainDefs";
import type { GameEventMap } from "../engine/Events";
import type { EventBroker } from "../lib/Event";
import type { VoxelMap } from "../lib/VoxelMap";

/** 選択中のツールに応じてタイルを操作するハンドラを EventBroker に登録し、解除用の dispose 関数を返す。 */
export function createInteractionHandler(
    voxelMap: VoxelMap,
    inventory: Inventory,
    eventBroker: EventBroker<GameEventMap>,
): () => void {
    return eventBroker.subscribe("interact", (packet) => {
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const tool = inventory.selectedTool;

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
    });
}
