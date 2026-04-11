import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getTerrainTypeFromVoxel,
    setCropGrowthStageInVoxel,
} from "../../engine/TerrainDefs";
import { registerEntity, type DailyTickContext, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem, registerItemAlias } from "../ItemRegistry";

/** 堆肥場に投入できる有機物アイテム */
const ORGANIC_MATERIALS = new Set(["stem", "leaves", "crop_residue"]);

/** 投入が必要な有機物の合計数 */
const REQUIRED_ORGANIC = 10;

/** 各発酵フェーズの経過日数（この日数後に次のフェーズへ） */
const FERMENT_DAYS = 2;

// ── 空の堆肥場 ──

registerEntity({
    entityType: ENTITY_TYPES.compost_bin,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_071.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去
        if (ctx.tool === "axe") {
            return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.compost_bin);
        }
        // 有機物を1個投入する（facility_part タイルからも操作可能なようアンカーを解決）
        if (!ctx.tool || !ORGANIC_MATERIALS.has(ctx.tool)) return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (!anchor) return false;
        const anchorPos = ctx.voxelMap.getSurfacePosition({ x: anchor.anchorX, y: 0, z: anchor.anchorZ });
        const anchorVoxel = ctx.voxelMap.get(anchorPos);
        const count = getCropGrowthStageFromVoxel(anchorVoxel);
        if (!ctx.inventory.consumeSelectedItem(1)) return false;
        if (count + 1 >= REQUIRED_ORGANIC) {
            // 10個投入完了 → 発酵開始（growth counter をリセット）
            const terrain = getTerrainTypeFromVoxel(anchorVoxel);
            ctx.voxelMap.set(terrain | (ENTITY_TYPES.compost_bin_loaded << 8), anchorPos);
        } else {
            ctx.voxelMap.set(setCropGrowthStageInVoxel(anchorVoxel, count + 1), anchorPos);
        }
        return true;
    },
});

// ── 投入直後（053_1）──

registerEntity({
    entityType: ENTITY_TYPES.compost_bin_loaded,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_053_1.png", 0, 0]];
    },

    onDailyTick(ctx: DailyTickContext): void {
        const stage = getCropGrowthStageFromVoxel(ctx.voxel);
        if (stage >= FERMENT_DAYS - 1) {
            // 2日経過 → 発酵中へ（growth counter をリセット）
            const terrain = getTerrainTypeFromVoxel(ctx.voxel);
            ctx.voxelMap.set(terrain | (ENTITY_TYPES.compost_bin_fermenting << 8), ctx.pos);
        } else {
            ctx.voxelMap.set(setCropGrowthStageInVoxel(ctx.voxel, stage + 1), ctx.pos);
        }
    },
});

// ── 発酵中（053_2）──

registerEntity({
    entityType: ENTITY_TYPES.compost_bin_fermenting,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_053_2.png", 0, 0]];
    },

    onDailyTick(ctx: DailyTickContext): void {
        const stage = getCropGrowthStageFromVoxel(ctx.voxel);
        if (stage >= FERMENT_DAYS - 1) {
            // 2日経過 → 発酵完了へ
            const terrain = getTerrainTypeFromVoxel(ctx.voxel);
            ctx.voxelMap.set(terrain | (ENTITY_TYPES.compost_bin_done << 8), ctx.pos);
        } else {
            ctx.voxelMap.set(setCropGrowthStageInVoxel(ctx.voxel, stage + 1), ctx.pos);
        }
    },
});

// ── 発酵完了（053_3）──

registerEntity({
    entityType: ENTITY_TYPES.compost_bin_done,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_053_3.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // 手で堆肥を回収 → 空の堆肥場に戻す
        if (ctx.tool !== "hand") return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (!anchor) return false;
        const anchorPos = ctx.voxelMap.getSurfacePosition({ x: anchor.anchorX, y: 0, z: anchor.anchorZ });
        const anchorVoxel = ctx.voxelMap.get(anchorPos);
        if (!ctx.inventory.addItems([{ itemId: "compost", count: 1 }])) return false;
        const terrain = getTerrainTypeFromVoxel(anchorVoxel);
        ctx.voxelMap.set(terrain | (ENTITY_TYPES.compost_bin << 8), anchorPos);
        return true;
    },
});

// ── アイテム登録 ──

registerItem({
    itemId: "compost_bin",
    spriteName: "ss_sprite_062.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.compost_bin,
        entitySize: { w: 2, h: 2 },
        fieldSpriteName: "ss_sprite_071.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.compost_bin, { w: 2, h: 2 });
        },
    },
});

// 各発酵状態でも findFacilityAnchor がアンカーを解決できるように登録する
registerItemAlias(ENTITY_TYPES.compost_bin_loaded, "compost_bin");
registerItemAlias(ENTITY_TYPES.compost_bin_fermenting, "compost_bin");
registerItemAlias(ENTITY_TYPES.compost_bin_done, "compost_bin");
