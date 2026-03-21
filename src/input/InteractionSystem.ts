import type { GameEventMap } from "../_boundary/events";
import type { IInventoryWriter, IVoxelWriter } from "../_boundary/interfaces";
import { getEntityDef, type InteractionContext } from "../_registry/EntityRegistry";
import { getItemDef } from "../_registry/ItemRegistry";
import { getTerrainDef } from "../_registry/TerrainRegistry";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import {
    ENTITY_TYPES,
    getEntityTypeFromVoxel,
    getTerrainTypeFromVoxel,
    TERRAIN_TYPES,
} from "../engine/TerrainDefs";
import type { EventBroker } from "../lib/Event";

/** 選択中のツールに応じてタイルを操作するハンドラを EventBroker に登録し、解除用の dispose 関数を返す。 */
export function createInteractionHandler(
    voxelMap: IVoxelWriter,
    inventory: IInventoryWriter,
    eventBroker: EventBroker<GameEventMap>,
): () => void {
    return eventBroker.subscribe("interact_world", (packet) => {
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const terrainType = getTerrainTypeFromVoxel(voxel);
        const tool = inventory.selectedTool;

        // 水源ブロックは操作対象外（破壊不能）
        if (terrainType === TERRAIN_TYPES.waterSource) return;

        const ctx: InteractionContext = { voxelMap, inventory, eventBroker, surfacePos, voxel, tool };

        // facility_part → アンカーの entityType に解決してからディスパッチ
        let entityType = getEntityTypeFromVoxel(voxel);
        if (entityType === ENTITY_TYPES.facility_part) {
            const anchor = findFacilityAnchor(voxelMap, packet.pos.x, packet.pos.z);
            if (anchor) entityType = anchor.entityType;
        }

        // パス1: EntityRegistry — エンティティベース（例: 収穫・撤去・クラフトUI）
        const entityDef = getEntityDef(entityType);
        if (entityDef?.onInteract?.(ctx)) return;

        // パス2: ItemRegistry — アイテムベース（例: 植え付け・肥料・水やり・土盛り）
        if (tool) {
            const itemDef = getItemDef(tool);
            if (itemDef?.onItemUse?.(ctx)) return;
        }

        // パス3: TerrainRegistry — 地形ベース（例: 掘削・耕作）
        const terrainDef = getTerrainDef(terrainType);
        if (terrainDef?.onInteract?.(ctx)) return;
    });
}
