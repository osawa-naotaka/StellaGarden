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

    for (let pos = queue.shift(); pos; pos = queue.shift()) {
        const [x, z] = pos;

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

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * 指定座標の周囲にある flowedWater (TERRAIN_TYPES.water) が
 * waterSource から到達不能になっていれば除去する。
 *
 * dirt 設置など、水路の接続が切れる操作の後に呼び出す。
 */
export function removeDisconnectedWater(voxelMap: IVoxelWriter, cx: number, cz: number): void {
    const horizonH = voxelMap.horizonHeight;
    const globalVisited = new Set<number>();
    const key = (x: number, z: number) => x * voxelMap.depth + z;

    for (const [dx, dz] of DIRS) {
        const sx = cx + dx;
        const sz = cz + dz;
        if (sx < 0 || sx >= voxelMap.width || sz < 0 || sz >= voxelMap.depth) continue;
        if (globalVisited.has(key(sx, sz))) continue;

        // この隣接タイルが flowedWater を持つか確認
        const groundY = voxelMap.getGroundSurfacePosition({ x: sx, y: 0, z: sz }).y;
        if (groundY >= horizonH) continue;
        const surfaceTerrain = getTerrainTypeFromVoxel(voxelMap.get({ x: sx, y: groundY + 1, z: sz }));
        if (surfaceTerrain !== TERRAIN_TYPES.water) continue;

        // BFS: この flowedWater の連結成分を探索し、waterSource に到達できるか調べる
        const component: [number, number][] = [[sx, sz]];
        const visited = new Set<number>();
        visited.add(key(sx, sz));
        let foundSource = false;

        for (let i = 0; i < component.length; i++) {
            const [qx, qz] = component[i];

            for (const [ddx, ddz] of DIRS) {
                const nx = qx + ddx;
                const nz = qz + ddz;
                if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
                const k = key(nx, nz);
                if (visited.has(k)) continue;

                const nGroundY = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y;
                if (nGroundY >= horizonH) continue;

                const nTerrain = getTerrainTypeFromVoxel(voxelMap.get({ x: nx, y: nGroundY + 1, z: nz }));
                if (nTerrain === TERRAIN_TYPES.waterSource) {
                    foundSource = true;
                    break;
                }
                if (nTerrain === TERRAIN_TYPES.water) {
                    visited.add(k);
                    component.push([nx, nz]);
                }
            }
            if (foundSource) break;
        }

        // globalVisited にマージ（同じ連結成分を二重に探索しない）
        for (const k of visited) globalVisited.add(k);

        if (!foundSource) {
            for (const [wx, wz] of component) {
                const gy = voxelMap.getGroundSurfacePosition({ x: wx, y: 0, z: wz }).y;
                for (let y = gy + 1; y <= horizonH; y++) {
                    voxelMap.remove({ x: wx, y, z: wz });
                }
            }
        }
    }
}
