import type { IVoxelWriter } from "../_boundary/interfaces";
import {
    ENTITY_TYPES,
    getEntityTypeFromVoxel,
    getCropGrowthStageFromVoxel,
    setCropGrowthStageInVoxel,
} from "./TerrainDefs";

/** 作物の最終育成段階（potato_5）。これを超えてはならない。 */
const MAX_GROWTH_STAGE = 5;

/**
 * VoxelMap 全体を走査して、芋エンティティが載っているボクセルの
 * 育成カウンタを1インクリメントする。
 *
 * - ゲーム内1日が経過するたびに呼び出す（day_changed イベントを受けて App.tsx が呼ぶ）
 * - 育成カウンタが MAX_GROWTH_STAGE（5）に達しているタイルは更新しない
 * - y = horizonHeight の地表層のみを走査する
 */
export function advanceDayAllCrops(voxelMap: IVoxelWriter): void {
    const horizon = voxelMap.horizonHeight;

    for (let x = 0; x < voxelMap.width; x++) {
        for (let z = 0; z < voxelMap.depth; z++) {
            const pos = { x, y: horizon, z };
            const voxel = voxelMap.get(pos);

            if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.potato) continue;

            const stage = getCropGrowthStageFromVoxel(voxel);
            if (stage >= MAX_GROWTH_STAGE) continue;

            voxelMap.set(setCropGrowthStageInVoxel(voxel, stage + 1), pos);
        }
    }
}
