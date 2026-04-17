import type { VoxelMap } from "../lib/VoxelMap";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, setEntityTypeInVoxel, TERRAIN_TYPES } from "./TerrainDefs";

/** 1 日あたりの粘土再生成試行回数。 */
const REGEN_PER_DAY = 8;

/**
 * 大河周辺の水辺セルからランダムに選んで粘土エンティティを再生成する。
 * day_changed イベントに合わせて呼び出す。
 *
 * - 対象セル: voxelMap.riversideCells（地形生成時に確定した大河水辺セル）
 * - 生やす条件: terrain == dirt かつ entity == none
 * - スキップ: 耕された畑（soil/wetSoil）、既に他のエンティティが載っているセル、dirt 以外に変化したセル
 */
export function regenerateClay(voxelMap: VoxelMap): void {
    const cells = voxelMap.riversideCells;
    if (cells.length === 0) return;
    const W = voxelMap.width;
    const y = voxelMap.horizonHeight;

    for (let i = 0; i < REGEN_PER_DAY; i++) {
        const idx = cells[(Math.random() * cells.length) | 0];
        const pos = { x: idx % W, y, z: (idx / W) | 0 };
        const voxel = voxelMap.get(pos);
        const terrain = getTerrainTypeFromVoxel(voxel);
        const entity = getEntityTypeFromVoxel(voxel);
        if (terrain !== TERRAIN_TYPES.dirt || entity !== ENTITY_TYPES.none) continue;
        voxelMap.set(setEntityTypeInVoxel(voxel, ENTITY_TYPES.clay), pos);
    }
}
