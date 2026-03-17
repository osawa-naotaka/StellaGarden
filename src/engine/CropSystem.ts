import type { IVoxelWriter } from "../_boundary/interfaces";
import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getEntityTypeFromVoxel,
    getTerrainTypeFromVoxel,
    setCropGrowthStageInVoxel,
    TERRAIN_TYPES,
} from "./TerrainDefs";

/** 作物の最終育成段階（potato_5）。これを超えてはならない。 */
const MAX_GROWTH_STAGE = 7;

/**
 * VoxelMap 全体を走査して、芋エンティティが載っているボクセルの
 * 育成カウンタを1インクリメントする。
 *
 * - ゲーム内1日が経過するたびに呼び出す（day_changed イベントを受けて App.tsx が呼ぶ）
 * - 育成カウンタが MAX_GROWTH_STAGE（5）に達しているタイルは更新しない
 * - y = horizonHeight の地表層のみを走査する
 */
/**
 * VoxelMap 全体を走査して、wet soil を soil に変更する。
 * 作物エンティティが存在する場合はエンティティと growthStage を保持したまま地形タイプのみ変更する。
 *
 * - ゲーム内1日が経過するたびに呼び出す（day_changed イベントを受けて App.tsx が呼ぶ）
 */
export function dryWetSoil(voxelMap: IVoxelWriter): void {
    for (let x = 0; x < voxelMap.width; x++) {
        for (let z = 0; z < voxelMap.depth; z++) {
            const pos = voxelMap.getGroundSurfacePosition({ x, y: 0, z });
            const voxel = voxelMap.get(pos);

            if (getTerrainTypeFromVoxel(voxel) !== TERRAIN_TYPES.wetSoil) continue;

            // 地形タイプのみ soil に変更（エンティティ・growthStage は保持）
            voxelMap.set((voxel & ~0xff) | TERRAIN_TYPES.soil, pos);
        }
    }
}

export function advanceDayAllCrops(voxelMap: IVoxelWriter): void {
    for (let x = 0; x < voxelMap.width; x++) {
        for (let z = 0; z < voxelMap.depth; z++) {
            const pos = voxelMap.getSurfacePosition({ x, y: 0, z });
            const voxel = voxelMap.get(pos);

            if (
                getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.potato &&
                getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.soy &&
                getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.flax &&
                getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.sunflower &&
                getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.tree
            )
                continue;

            const stage = getCropGrowthStageFromVoxel(voxel);
            if (stage >= MAX_GROWTH_STAGE) continue;

            voxelMap.set(setCropGrowthStageInVoxel(voxel, stage + 1), pos);
        }
    }
}
