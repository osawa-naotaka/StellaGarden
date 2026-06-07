import type { IVoxelWriter } from "../_boundary/interfaces";
import { getFullowCanalShapeKey, isIrrigatingFurrowCanalShape } from "./FurrowCanalShape";
import { ENTITY_TYPES, getEnabledFromVoxel, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, setTerrainTypeInVoxel, TERRAIN_TYPES } from "./VoxelDefs";

export const FURROW_CANAL_IRRIGATION_RANGE = 3;

type Direction2D = {
    readonly dx: number;
    readonly dz: number;
};

function getIrrigationDirections(shape: ReturnType<typeof getFullowCanalShapeKey>): ReadonlyArray<Direction2D> {
    switch (shape) {
        case "h":
        case "end_l":
        case "end_r":
            return [
                { dx: 0, dz: -1 },
                { dx: 0, dz: 1 },
            ];
        case "v":
        case "end_u":
        case "end_d":
            return [
                { dx: -1, dz: 0 },
                { dx: 1, dz: 0 },
            ];
        default:
            return [];
    }
}

function isInBounds(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    return x >= 0 && x < voxelMap.width && z >= 0 && z < voxelMap.depth;
}

/**
 * filled な畝間水路から周囲の soil を wetSoil に変える。
 *
 * ルール:
 * - 散水対象は filled=true の pipe1 のみ
 * - 散水するのは直線・端末のみ（L字・T字・十字は散水しない）
 * - 横軸 pipe は上下、縦軸 pipe は左右に距離 n マス散水する
 * - soil のみ wetSoil に変える（wetSoil は維持、他 terrain は無視）
 *
 * この関数は日次処理の最後に呼ばれる想定。
 */
export function applyFullowCanalIrrigation(voxelMap: IVoxelWriter, range: number = FURROW_CANAL_IRRIGATION_RANGE): void {
    for (let x = 0; x < voxelMap.width; x++) {
        for (let z = 0; z < voxelMap.depth; z++) {
            const pipeSurfacePos = voxelMap.getSurfacePosition({ x, z });
            const pipeVoxel = voxelMap.get(pipeSurfacePos);

            if (getEntityTypeFromVoxel(pipeVoxel) !== ENTITY_TYPES.furrow_canal) continue;
            if (!getEnabledFromVoxel(pipeVoxel)) continue;

            const shape = getFullowCanalShapeKey(pipeVoxel);
            if (!isIrrigatingFurrowCanalShape(shape)) continue;

            const directions = getIrrigationDirections(shape);
            for (const dir of directions) {
                for (let step = 1; step <= range; step++) {
                    const nx = x + dir.dx * step;
                    const nz = z + dir.dz * step;
                    if (!isInBounds(voxelMap, nx, nz)) break;

                    const targetSurfacePos = voxelMap.getSurfacePosition({ x: nx, z: nz });
                    const targetVoxel = voxelMap.get(targetSurfacePos);
                    const terrainType = getTerrainTypeFromVoxel(targetVoxel);

                    if (terrainType === TERRAIN_TYPES.soil) {
                        voxelMap.set(setTerrainTypeInVoxel(targetVoxel, TERRAIN_TYPES.wetSoil), targetSurfacePos);
                    }
                }
            }
        }
    }
}
