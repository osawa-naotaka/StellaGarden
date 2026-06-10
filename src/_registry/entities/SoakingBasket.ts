/**
 * 浸漬槽（soaking_basket）の独立エンティティ登録。
 *
 * DailyProcessing.ts の汎用ヘルパーから外して独自実装する理由:
 * - variant ビット 3bit を **向き（縦/横）専用** に使う
 *   （完了フラグは voxel の enabled ビットを流用するため、variant と衝突しない）
 * - サイズが variant に応じて (3x1) / (1x3) に切り替わる（Waterwheel.ts と同じパターン）
 * - 配置条件として「4 近傍に water/waterSource が 1 タイル以上ある」を要求する
 *
 * スプライトについて:
 * - 縦置き専用スプライトは未用意のため、現状は横置きの ss_sprite_072 / ss_sprite_056 / ss_sprite_073 を流用する
 */
import type { IVoxelReader, Pos2D } from "../../_boundary/interfaces";
import type { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import {
    ENTITY_TYPES,
    getEnabledFromVoxel,
    getEntityTypeFromVoxel,
    getRotatedFromVoxel,
    getTerrainTypeFromVoxel,
    setVariantInVoxel,
    TERRAIN_TYPES,
} from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";
import { DAILY_PROCESSING_DEFS } from "../ProcessingRecipes";
import { DailyProcessingStorage } from "./DailyProcessing";

const PLACEABLE_TERRAINS: ReadonlySet<number> = new Set([TERRAIN_TYPES.grass, TERRAIN_TYPES.dirt, TERRAIN_TYPES.soil]);
const NEIGHBORS_4: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
];

const HORIZONTAL_SIZE = { w: 3, h: 1 };
const VERTICAL_SIZE = { w: 1, h: 3 };

function getSizeForVariant(variant: number): { w: number; h: number } {
    return variant === 1 ? VERTICAL_SIZE : HORIZONTAL_SIZE;
}

function isWaterTerrain(t: number): boolean {
    return t === TERRAIN_TYPES.water || t === TERRAIN_TYPES.waterSource;
}

function canPlaceSoakingBasket(map: IVoxelReader, pos: Pos2D, variant: PlacementVariant): boolean {
    const size = getSizeForVariant(variant);
    const { x, z } = pos;
    if (x < 0 || x + size.w > map.width || z < 0 || z + size.h > map.depth) return false;

    // 配置範囲のすべてのタイル: 陸地・surfaceY 一致・空エンティティ
    const baseY = map.getSurfacePosition({ x, z }).y;
    for (let dz = 0; dz < size.h; dz++) {
        for (let dx = 0; dx < size.w; dx++) {
            const surfacePos = map.getSurfacePosition({ x: x + dx, z: z + dz });
            if (surfacePos.y !== baseY) return false;
            const voxel = map.getSurface({ x: x + dx, z: z + dz });
            if (!PLACEABLE_TERRAINS.has(getTerrainTypeFromVoxel(voxel))) return false;
            if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) return false;
        }
    }

    // 配置範囲の外周 4 近傍に water/waterSource が 1 タイル以上あるか
    for (let dz = 0; dz < size.h; dz++) {
        for (let dx = 0; dx < size.w; dx++) {
            const tx = x + dx;
            const tz = z + dz;
            for (const [ndx, ndz] of NEIGHBORS_4) {
                const nx = tx + ndx;
                const nz = tz + ndz;
                if (nx < 0 || nx >= map.width || nz < 0 || nz >= map.depth) continue;
                // 配置範囲内のタイルは隣接判定から除外（外周のみ見る）
                if (nx >= x && nx < x + size.w && nz >= z && nz < z + size.h) continue;
                const v = map.getSurface({ x: nx, z: nz });
                if (isWaterTerrain(getTerrainTypeFromVoxel(v))) return true;
            }
        }
    }
    return false;
}

registerEntity({
    entityType: ENTITY_TYPES.soaking_basket,

    getEntitySize(variant: PlacementVariant) {
        return getSizeForVariant(variant);
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        if (getRotatedFromVoxel(voxel)) {
            return [["ss_sprite_073.png", 0, 0]];
        }
        if (getEnabledFromVoxel(voxel)) {
            return [["ss_sprite_056.png", 0, 0]];
        }
        return [["ss_sprite_072.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const storage = ctx.storageVault.get<SlotStorage>("soaking_basket");
        const extraItems = storage.collectAllStacks(ctx.anchorPos);
        const removed = removeFacilityByContext(ctx, extraItems);
        if (removed) storage.remove(ctx.anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_processing_daily_ui", { pos: ctx.anchorPos });
        return true;
    },
});

registerItem({
    itemId: "soaking_basket",
    displayName: "浸漬槽",
    spriteName: "ss_sprite_065.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.soaking_basket,
        defaultVariant: 0,
        maxVariant: 1,
        getFieldSpriteName(_variant: PlacementVariant) {
            // 暫定: 縦横ともに横置きスプライトを使用
            return "ss_sprite_072.png";
        },
        canPlace(voxelMap, pos, variant) {
            return canPlaceSoakingBasket(voxelMap, pos, variant);
        },
        onPlace(voxelMap, pos, variant, storageVault) {
            const size = getSizeForVariant(variant);
            placeFacility(voxelMap, pos, ENTITY_TYPES.soaking_basket, size);
            const surfacePos = voxelMap.getSurfacePosition(pos);
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
            storageVault.get<SlotStorage>("soaking_basket").create(pos);
        },
    },
});

const SOAKING_OUTPUT_SLOTS = DAILY_PROCESSING_DEFS[ENTITY_TYPES.soaking_basket]?.outputSlotCount ?? 1;
registerStorageFactory("soaking_basket", () => new DailyProcessingStorage(SOAKING_OUTPUT_SLOTS));
