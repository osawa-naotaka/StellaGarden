import type { IVoxelWriter } from "../_boundary/interfaces";
import { getTerrainTypeFromVoxel, TERRAIN_TYPES } from "./TerrainDefs";

/**
 * 指定座標から水の FloodFill を行う。
 *
 * 掘削後に呼び出し、掘った位置の地面が horizonHeight 未満かつ
 * 4近傍に水が隣接していれば、そこから BFS で水を拡散する。
 *
 * 各タイルについて ground+1 〜 horizonHeight の範囲に water を配置する。
 */
export function floodFillWater(voxelMap: IVoxelWriter, startX: number, startZ: number): void {
    const horizonH = voxelMap.horizonHeight;

    // 起点の地面高さが horizonHeight 以上なら水は不要
    const startGround = voxelMap.getGroundSurfacePosition({ x: startX, y: 0, z: startZ });
    if (startGround.y >= horizonH) return;

    // 4近傍に水が存在するか確認
    const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];
    let hasAdjacentWater = false;
    for (const [dx, dz] of dirs) {
        const nx = startX + dx;
        const nz = startZ + dz;
        if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
        try {
            const surfacePos = voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz });
            const terrain = getTerrainTypeFromVoxel(voxelMap.get(surfacePos));
            if (terrain === TERRAIN_TYPES.water || terrain === TERRAIN_TYPES.waterSource) {
                hasAdjacentWater = true;
                break;
            }
        } catch {
            // No surface found — skip
        }
    }

    if (!hasAdjacentWater) return;

    // BFS で水を拡散
    const visited = new Set<number>();
    const key = (x: number, z: number) => x * voxelMap.depth + z;
    const queue: [number, number][] = [[startX, startZ]];
    visited.add(key(startX, startZ));

    while (queue.length > 0) {
        const [x, z] = queue.shift()!;

        // 地面の高さを取得
        const groundPos = voxelMap.getGroundSurfacePosition({ x, y: 0, z });
        if (groundPos.y >= horizonH) continue;

        // ground+1 〜 horizonHeight に水を配置
        for (let y = groundPos.y + 1; y <= horizonH; y++) {
            const existing = voxelMap.get({ x, y, z });
            const existingTerrain = getTerrainTypeFromVoxel(existing);
            if (existingTerrain !== TERRAIN_TYPES.water && existingTerrain !== TERRAIN_TYPES.waterSource) {
                voxelMap.set(TERRAIN_TYPES.water, { x, y, z });
            }
        }

        // 4近傍を探索
        for (const [dx, dz] of dirs) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
            const k = key(nx, nz);
            if (visited.has(k)) continue;
            visited.add(k);

            // 隣接タイルの地面が horizonHeight 未満ならキューに追加
            try {
                const neighborGround = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz });
                if (neighborGround.y < horizonH) {
                    queue.push([nx, nz]);
                }
            } catch {
                // No ground surface — skip
            }
        }
    }
}
