import type { GameEventMap } from "../_boundary/events";
import type { IInventoryWriter, IPlayerStateReader, IVoxelWriter } from "../_boundary/interfaces";
import { getEntityDef, type InteractionContext } from "../_registry/EntityRegistry";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import { getItemDef } from "../_registry/ItemRegistry";
import { getTerrainDef } from "../_registry/TerrainRegistry";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../engine/TerrainDefs";
import type { EventBroker } from "../lib/Event";
import type { UIState } from "../view/UIState";

/** resolve helper: facility_part をアンカーの entityType に解決する */
function resolveEntityType(voxelMap: IVoxelWriter, voxel: number, x: number, z: number): number {
    let entityType = getEntityTypeFromVoxel(voxel);
    if (entityType === ENTITY_TYPES.facility_part) {
        const anchor = findFacilityAnchor(voxelMap, x, z);
        if (anchor) entityType = anchor.entityType;
    }
    return entityType;
}

/** インタラクションハンドラを EventBroker に登録し、解除用の dispose 関数を返す。 */
export function createInteractionHandler(
    voxelMap: IVoxelWriter,
    inventory: IInventoryWriter,
    eventBroker: EventBroker<GameEventMap>,
    uiState: UIState,
    playerState: IPlayerStateReader,
): () => void {
    const INTERACT_RANGE = 5; // タイル

    // 右クリック: ツール使用（収穫・撤去・植え付け・掘削等）
    const d1 = eventBroker.subscribe("interact_world", (packet) => {
        if (uiState.mode === "placement") return;
        const distX = packet.pos.x - playerState.posInWorld.x;
        const distZ = packet.pos.z - playerState.posInWorld.z;
        if (Math.abs(distX) > INTERACT_RANGE || Math.abs(distZ) > INTERACT_RANGE) return;
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const terrainType = getTerrainTypeFromVoxel(voxel);
        const tool = inventory.selectedTool;

        if (terrainType === TERRAIN_TYPES.waterSource) return;

        const ctx: InteractionContext = { voxelMap, inventory, eventBroker, surfacePos, voxel, tool };
        const entityType = resolveEntityType(voxelMap, voxel, packet.pos.x, packet.pos.z);

        // パス1: EntityRegistry — エンティティベース
        const entityDef = getEntityDef(entityType);
        if (entityDef?.onInteract?.(ctx)) return;

        // パス2: ItemRegistry — アイテムベース
        if (tool) {
            const itemDef = getItemDef(tool);
            if (itemDef?.onItemUse?.(ctx)) return;
        }

        // パス3: TerrainRegistry — 地形ベース
        const terrainDef = getTerrainDef(terrainType);
        if (terrainDef?.onInteract?.(ctx)) return;
    });

    // 左クリック: 施設UIの起動等
    const d2 = eventBroker.subscribe("interact_primary", (packet) => {
        if (uiState.mode !== "normal") return;
        const distX = packet.pos.x - playerState.posInWorld.x;
        const distZ = packet.pos.z - playerState.posInWorld.z;
        if (Math.abs(distX) > INTERACT_RANGE || Math.abs(distZ) > INTERACT_RANGE) return;
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const terrainType = getTerrainTypeFromVoxel(voxel);

        if (terrainType === TERRAIN_TYPES.waterSource) return;

        const ctx: InteractionContext = { voxelMap, inventory, eventBroker, surfacePos, voxel, tool: inventory.selectedTool };
        const entityType = resolveEntityType(voxelMap, voxel, packet.pos.x, packet.pos.z);

        const entityDef = getEntityDef(entityType);
        entityDef?.onPrimaryInteract?.(ctx);
    });

    return () => {
        d1();
        d2();
    };
}
