import type { Inventory } from "../engine/Inventory";
import { ENTITY_TYPES, TERRAIN_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel } from "../engine/TerrainDefs";
import type { GameEventMap } from "../engine/Events";
import type { EventBroker } from "../lib/Event";
import type { VoxelMap } from "../lib/VoxelMap";

/** 中心座標を含む 3x3 範囲の表面 y がすべて同じかどうかを返す。範囲外タイルが含まれる場合は false。 */
function isFlat3x3(voxelMap: VoxelMap, centerX: number, centerZ: number, centerY: number): boolean {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            if (voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz }).y !== centerY) {
                return false;
            }
        }
    }
    return true;
}

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
                if (
                    getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    isFlat3x3(voxelMap, packet.pos.x, packet.pos.z, surfacePos.y)
                ) {
                    voxelMap.set(TERRAIN_TYPES.soil, surfacePos);
                }
                break;
        }
    });
}
