/**
 * soil / wetSoil 地形のインタラクション定義。
 * - hoes: 作物エンティティの削除（虚空へ消滅、アイテム追加なし）
 */
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import { registerTerrain } from "../TerrainRegistry";

function onSoilInteract(ctx: import("../EntityRegistry").InteractionContext): boolean {
    if (ctx.tool !== "hoes") return false;

    const entityType = getEntityTypeFromVoxel(ctx.voxel);
    if (entityType === ENTITY_TYPES.none) return false;

    // 作物エンティティを削除（虚空へ消滅、アイテム追加なし）
    const terrainType = getTerrainTypeFromVoxel(ctx.voxel);
    ctx.voxelMap.set(terrainType, ctx.surfacePos);
    return true;
}

registerTerrain({
    terrainType: TERRAIN_TYPES.soil,
    onInteract: onSoilInteract,
});

registerTerrain({
    terrainType: TERRAIN_TYPES.wetSoil,
    onInteract: onSoilInteract,
});
