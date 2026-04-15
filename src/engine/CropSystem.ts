import type { IVoxelWriter } from "../_boundary/interfaces";
import { type DailyTickContext, getEntityDef } from "../_registry/EntityRegistry";
import type { CropDef } from "./CropDefs";
import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getDroughtCounterFromVoxel,
    getEntityTypeFromVoxel,
    getTerrainTypeFromVoxel,
    setCropGrowthStageInVoxel,
    setDroughtCounterInVoxel,
    TERRAIN_TYPES,
} from "./TerrainDefs";

/** 水切れ枯死の閾値。この日数連続で水切れすると枯死する。 */
const DROUGHT_DEATH_THRESHOLD = 3;

/**
 * 作物共通の1日次処理。各作物の onDailyTick から呼ぶ。
 *
 * - 水やり必須作物 (needsWater=true):
 *   - wetSoil → 成長 + drought=0 + 乾燥
 *   - soil → 成長停止 + drought+=1 → drought>=3 で枯死
 * - ジャガイモ等（needsWater=false）:
 *   - 常に成長。wetSoil → watered count+=1 + 乾燥
 */
export function applyCropDailyTick(ctx: DailyTickContext, cropDef: CropDef): void {
    const { voxelMap, pos, isWet } = ctx;
    let voxel = ctx.voxel;
    const dayCounter = getCropGrowthStageFromVoxel(voxel);

    // 既に枯死済み: 乾燥のみ
    if (dayCounter >= cropDef.witherDay) {
        if (isWet) voxelMap.set((voxel & ~0xffn) | BigInt(TERRAIN_TYPES.soil), pos);
        return;
    }

    if (cropDef.needsWater) {
        // --- 水やり必須作物 ---
        if (isWet) {
            // 水やり済み: 成長 + drought リセット + 乾燥
            voxel = setCropGrowthStageInVoxel(voxel, dayCounter + 1);
            voxel = setDroughtCounterInVoxel(voxel, 0);
            voxel = (voxel & ~0xffn) | BigInt(TERRAIN_TYPES.soil);
        } else {
            // 水切れ: 成長停止 + drought インクリメント
            const drought = getDroughtCounterFromVoxel(voxel);
            const newDrought = drought + 1;
            if (newDrought >= DROUGHT_DEATH_THRESHOLD) {
                // 枯死
                voxel = setCropGrowthStageInVoxel(voxel, cropDef.witherDay);
                voxel = setDroughtCounterInVoxel(voxel, 0);
            } else {
                voxel = setDroughtCounterInVoxel(voxel, newDrought);
            }
        }
    } else {
        // --- 水やり不要作物（ジャガイモ等）: 常に成長 ---
        voxel = setCropGrowthStageInVoxel(voxel, dayCounter + 1);
        if (isWet) {
            // 水やり回数をカウント（drought bits を流用）
            const wateredCount = getDroughtCounterFromVoxel(voxel);
            if (wateredCount < 3) {
                voxel = setDroughtCounterInVoxel(voxel, wateredCount + 1);
            }
            voxel = (voxel & ~0xffn) | BigInt(TERRAIN_TYPES.soil);
        }
    }

    voxelMap.set(voxel, pos);
}

/**
 * ゲーム内1日が経過するたびに呼び出す統合日次処理。
 *
 * 各タイルを走査し、エンティティのない wetSoil を乾燥させる。
 * エンティティがあれば EntityRegistry の onDailyTick に委譲する。
 */
export function processDailyTick(voxelMap: IVoxelWriter): void {
    for (let x = 0; x < voxelMap.width; x++) {
        for (let z = 0; z < voxelMap.depth; z++) {
            const pos = voxelMap.getSurfacePosition({ x, y: 0, z });
            const voxel = voxelMap.get(pos);
            const entityType = getEntityTypeFromVoxel(voxel);
            const isWet = getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.wetSoil;

            if (entityType === ENTITY_TYPES.none) {
                if (isWet) voxelMap.set((voxel & ~0xffn) | BigInt(TERRAIN_TYPES.soil), pos);
                continue;
            }

            const def = getEntityDef(entityType);
            def?.onDailyTick?.({ voxelMap, pos, voxel, isWet });
        }
    }
}
