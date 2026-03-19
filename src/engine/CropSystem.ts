import type { IVoxelWriter } from "../_boundary/interfaces";
import { CROP_DEFS } from "./CropDefs";
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

/** CROP_DEFS に含まれない entity type（tree 等）に適用するフォールバック上限。 */
const FALLBACK_MAX_GROWTH_STAGE = 7;

/** 水切れ枯死の閾値。この日数連続で水切れすると枯死する。 */
const DROUGHT_DEATH_THRESHOLD = 3;

/**
 * ゲーム内1日が経過するたびに呼び出す統合日次処理。
 *
 * 旧 dryWetSoil + clearFertilized + advanceDayAllCrops を統合。
 * 処理順序が重要: 水やり判定を先に行い、その後乾燥する。
 *
 * - 作物なしの wetSoil → soil に乾燥
 * - 水やり必須作物 (needsWater=true):
 *   - wetSoil → 成長 + drought=0 + 乾燥
 *   - soil → 成長停止 + drought+=1 → drought>=3 で枯死
 * - ジャガイモ (needsWater=false):
 *   - wetSoil → 成長 + droughtCounter+=1 (水やり回数カウント) + 乾燥
 *   - soil → 成長（水なしでも育つ）
 * - tree・施設等 (CROP_DEFS 外):
 *   - 従来通り常に成長、フォールバック上限使用
 */
export function processDailyTick(voxelMap: IVoxelWriter): void {
    for (let x = 0; x < voxelMap.width; x++) {
        for (let z = 0; z < voxelMap.depth; z++) {
            const pos = voxelMap.getSurfacePosition({ x, y: 0, z });
            let voxel = voxelMap.get(pos);

            const entityType = getEntityTypeFromVoxel(voxel);
            const terrainType = getTerrainTypeFromVoxel(voxel);
            const isWet = terrainType === TERRAIN_TYPES.wetSoil;

            // --- エンティティなし: 乾燥のみ ---
            if (entityType === ENTITY_TYPES.none) {
                if (isWet) {
                    voxelMap.set((voxel & ~0xff) | TERRAIN_TYPES.soil, pos);
                }
                continue;
            }

            const cropDef = CROP_DEFS[entityType];

            // --- CROP_DEFS 外（tree・施設等）: 従来ロジック ---
            if (cropDef === undefined) {
                const stage = getCropGrowthStageFromVoxel(voxel);
                if (stage < FALLBACK_MAX_GROWTH_STAGE) {
                    voxel = setCropGrowthStageInVoxel(voxel, stage + 1);
                }
                // wetSoil があれば乾燥
                if (isWet) {
                    voxel = (voxel & ~0xff) | TERRAIN_TYPES.soil;
                }
                voxelMap.set(voxel, pos);
                continue;
            }

            // --- CROP_DEFS 内の作物 ---
            const dayCounter = getCropGrowthStageFromVoxel(voxel);

            // 既に枯死済みならスキップ（乾燥のみ）
            if (dayCounter >= cropDef.witherDay) {
                if (isWet) {
                    voxelMap.set((voxel & ~0xff) | TERRAIN_TYPES.soil, pos);
                }
                continue;
            }

            if (cropDef.needsWater) {
                // --- 水やり必須作物 ---
                if (isWet) {
                    // 水やり済み: 成長 + drought リセット + 乾燥
                    voxel = setCropGrowthStageInVoxel(voxel, dayCounter + 1);
                    voxel = setDroughtCounterInVoxel(voxel, 0);
                    voxel = (voxel & ~0xff) | TERRAIN_TYPES.soil;
                } else {
                    // 水切れ: 成長停止 + drought インクリメント
                    const drought = getDroughtCounterFromVoxel(voxel);
                    const newDrought = drought + 1;
                    if (newDrought >= DROUGHT_DEATH_THRESHOLD) {
                        // 枯死: エンティティは残し、dayCounter を witherDay に設定して枯死スプライトを表示
                        voxel = setCropGrowthStageInVoxel(voxel, cropDef.witherDay);
                        voxel = setDroughtCounterInVoxel(voxel, 0);
                    } else {
                        voxel = setDroughtCounterInVoxel(voxel, newDrought);
                    }
                }
            } else {
                // --- ジャガイモ等（水やり不要）: 常に成長 ---
                voxel = setCropGrowthStageInVoxel(voxel, dayCounter + 1);

                if (isWet) {
                    // 水やりされていたら watered count をインクリメント（drought bits を流用）
                    const wateredCount = getDroughtCounterFromVoxel(voxel);
                    if (wateredCount < 3) {
                        voxel = setDroughtCounterInVoxel(voxel, wateredCount + 1);
                    }
                    // 乾燥
                    voxel = (voxel & ~0xff) | TERRAIN_TYPES.soil;
                }
            }

            voxelMap.set(voxel, pos);
        }
    }
}
