import { ENTITY_TYPES, getCropGrowthStageFromVoxel, setCropGrowthStageInVoxel, setEntityTypeInVoxel } from "../../engine/TerrainDefs";
import { type DailyTickContext, type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem, registerItemAlias } from "../ItemRegistry";

/** 堆肥場に投入できる有機物アイテム */
const MATERIALS = new Set(["flax_stalk"]);

/** 投入が必要な有機物の合計数 */
const REQUIRED_ORGANIC = 8;

/** 各発酵フェーズの経過日数（この日数後に次のフェーズへ） */
const FERMENT_DAYS = 2;

registerEntity({
    entityType: ENTITY_TYPES.soaking_basket,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_072.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去
        if (ctx.tool === "axe") {
            return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.compost_bin);
        }
        // 有機物を REQUIRED_ORGANIC 個まとめて投入する（facility_part タイルからも操作可能なようアンカーを解決）
        if (!ctx.tool || !MATERIALS.has(ctx.tool)) return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (!anchor) return false;
        const anchorPos = ctx.voxelMap.getSurfacePosition({ x: anchor.anchorX, y: 0, z: anchor.anchorZ });
        const anchorVoxel = ctx.voxelMap.get(anchorPos);
        // 10個消費できない場合は何もしない
        if (!ctx.inventory.consumeSelectedItem(REQUIRED_ORGANIC)) return false;
        // 即座に発酵開始フェーズへ移行
        ctx.voxelMap.set(setEntityTypeInVoxel(anchorVoxel, ENTITY_TYPES.soaking_basket_loaded), anchorPos);
        return true;
    },
});

// ── 投入直後（053_1）──

registerEntity({
    entityType: ENTITY_TYPES.soaking_basket_loaded,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_056.png", 0, 0]];
    },

    onDailyTick(ctx: DailyTickContext): void {
        const stage = getCropGrowthStageFromVoxel(ctx.voxel);
        if (stage >= FERMENT_DAYS - 1) {
            // 2日経過 → 発酵中へ（growth counter をリセット）
            ctx.voxelMap.set(setEntityTypeInVoxel(ctx.voxel, ENTITY_TYPES.soaking_basket_done), ctx.pos);
        } else {
            ctx.voxelMap.set(setCropGrowthStageInVoxel(ctx.voxel, stage + 1), ctx.pos);
        }
    },
});


registerEntity({
    entityType: ENTITY_TYPES.soaking_basket_done,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_073.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // 手で堆肥を回収 → 空の堆肥場に戻す
        if (ctx.tool !== "hand") return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (!anchor) return false;
        const anchorPos = ctx.voxelMap.getSurfacePosition({ x: anchor.anchorX, y: 0, z: anchor.anchorZ });
        const anchorVoxel = ctx.voxelMap.get(anchorPos);
        if (!ctx.inventory.addItems([{ itemId: "processed_flax", count: 8 }])) return false;
        ctx.voxelMap.set(setEntityTypeInVoxel(anchorVoxel, ENTITY_TYPES.soaking_basket), anchorPos);
        return true;
    },
});

// ── アイテム登録 ──

registerItem({
    itemId: "soaking_basket",
    spriteName: "ss_sprite_065.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.soaking_basket,
        entitySize: { w: 3, h: 1 },
        fieldSpriteName: "ss_sprite_072.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.soaking_basket, { w: 3, h: 1 });
        },
    },
});

// 各発酵状態でも findFacilityAnchor がアンカーを解決できるように登録する
registerItemAlias(ENTITY_TYPES.soaking_basket_loaded, "soaking_basket");
registerItemAlias(ENTITY_TYPES.soaking_basket_done, "soaking_basket");
