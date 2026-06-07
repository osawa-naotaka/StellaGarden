import { MAX_WATER_SPREAD_DISTANCE } from "../_boundary/constants";
import type { IVoxelWriter } from "../_boundary/interfaces";
import { getTerrainTypeFromVoxel, TERRAIN_TYPES } from "./VoxelDefs";

const DIRS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
];

/**
 * 指定座標から水の FloodFill を行う（2フェーズBFS）。
 *
 * Phase 1: (startX, startZ) から BFS で waterSource タイルを探索（maxDist 歩以内）。
 *          waterSource が 1 つも見つからなければ何もしない。
 *
 * Phase 2: Phase 1 で見つかった全 waterSource を同時起点とした多源BFS で、
 *          maxDist 歩以内のタイルに water を配置する（waterSource タイルは上書きしない）。
 *
 * @param maxDist waterSource からの最大BFSホップ数。
 *                将来の石組み導水路では Infinity を渡して無制限にできる。
 */
export function floodFillWater(voxelMap: IVoxelWriter, startX: number, startZ: number, maxDist: number = MAX_WATER_SPREAD_DISTANCE): void {
    const horizonH = voxelMap.horizonHeight;
    const key = (x: number, z: number) => x * voxelMap.depth + z;

    // ── Phase 1: (startX, startZ) から BFS で waterSource を探索 ──────────────

    const p1Visited = new Set<number>();
    const p1Queue: [number, number, number][] = [[startX, startZ, 0]];
    p1Visited.add(key(startX, startZ));

    const sources: [number, number][] = [];

    let p1Idx = 0;
    while (p1Idx < p1Queue.length) {
        const [x, z, dist] = p1Queue[p1Idx++];

        const groundY = voxelMap.getGroundSurfacePosition({ x, z }).y;
        if (groundY >= horizonH) continue;

        const terrain = getTerrainTypeFromVoxel(voxelMap.get({ x, y: groundY + 1, z }));
        if (terrain === TERRAIN_TYPES.waterSource) {
            sources.push([x, z]);
        }

        // maxDist 歩を超えたタイルへは展開しない
        if (dist >= maxDist) continue;

        for (const [dx, dz] of DIRS) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
            const k = key(nx, nz);
            if (p1Visited.has(k)) continue;

            const nGroundY = voxelMap.getGroundSurfacePosition({ x: nx, z: nz }).y;
            if (nGroundY < horizonH) {
                p1Visited.add(k);
                p1Queue.push([nx, nz, dist + 1]);
            }
        }
    }

    // waterSource が 1 つも見つからなければ水なし
    if (sources.length === 0) return;

    // ── Phase 2: 多源BFS で水を配置（maxDist 歩まで） ────────────────────────

    const p2Visited = new Set<number>();
    const p2Queue: [number, number, number][] = [];

    for (const [srcX, srcZ] of sources) {
        const k = key(srcX, srcZ);
        if (!p2Visited.has(k)) {
            p2Visited.add(k);
            p2Queue.push([srcX, srcZ, 0]);
        }
    }

    let p2Idx = 0;
    while (p2Idx < p2Queue.length) {
        const [x, z, dist] = p2Queue[p2Idx++];

        const groundY = voxelMap.getGroundSurfacePosition({ x, z }).y;
        if (groundY >= horizonH) continue;

        // 距離 1〜maxDist のタイルに water を配置（dist===0 の waterSource タイルは上書きしない）
        if (dist > 0) {
            for (let y = groundY + 1; y <= horizonH; y++) {
                const existing = voxelMap.get({ x, y, z });
                const existingTerrain = getTerrainTypeFromVoxel(existing);
                if (existingTerrain !== TERRAIN_TYPES.water && existingTerrain !== TERRAIN_TYPES.waterSource) {
                    voxelMap.set(BigInt(TERRAIN_TYPES.water), { x, y, z });
                }
            }
        }

        if (dist >= maxDist) continue;

        for (const [dx, dz] of DIRS) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
            const k = key(nx, nz);
            if (p2Visited.has(k)) continue;

            const nGroundY = voxelMap.getGroundSurfacePosition({ x: nx, z: nz }).y;
            if (nGroundY < horizonH) {
                p2Visited.add(k);
                p2Queue.push([nx, nz, dist + 1]);
            }
        }
    }
}

/**
 * 指定座標の周囲にある flowedWater (TERRAIN_TYPES.water) が
 * waterSource から maxDist 歩以内に到達可能でなければ除去する。
 *
 * dirt 設置など、水路の接続が切れる操作の後に呼び出す。
 *
 * @param maxDist waterSource からの最大BFSホップ数。
 *                将来の石組み導水路では Infinity を渡して無制限にできる。
 */
export function removeDisconnectedWater(voxelMap: IVoxelWriter, cx: number, cz: number, maxDist: number = MAX_WATER_SPREAD_DISTANCE): void {
    const horizonH = voxelMap.horizonHeight;
    const globalVisited = new Set<number>();
    const key = (x: number, z: number) => x * voxelMap.depth + z;

    for (const [dx, dz] of DIRS) {
        const sx = cx + dx;
        const sz = cz + dz;
        if (sx < 0 || sx >= voxelMap.width || sz < 0 || sz >= voxelMap.depth) continue;
        if (globalVisited.has(key(sx, sz))) continue;

        // この隣接タイルが flowedWater を持つか確認
        const groundY = voxelMap.getGroundSurfacePosition({ x: sx, z: sz }).y;
        if (groundY >= horizonH) continue;
        const surfaceTerrain = getTerrainTypeFromVoxel(voxelMap.get({ x: sx, y: groundY + 1, z: sz }));
        if (surfaceTerrain !== TERRAIN_TYPES.water) continue;

        // ── Step 1: flowedWater の連結成分を収集 ────────────────────────────

        const component: [number, number][] = [[sx, sz]];
        const componentVisited = new Set<number>();
        componentVisited.add(key(sx, sz));

        for (let i = 0; i < component.length; i++) {
            const [qx, qz] = component[i];

            for (const [ddx, ddz] of DIRS) {
                const nx = qx + ddx;
                const nz = qz + ddz;
                if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
                const k = key(nx, nz);
                if (componentVisited.has(k)) continue;

                const nGroundY = voxelMap.getGroundSurfacePosition({ x: nx, z: nz }).y;
                if (nGroundY >= horizonH) continue;

                const nTerrain = getTerrainTypeFromVoxel(voxelMap.get({ x: nx, y: nGroundY + 1, z: nz }));
                if (nTerrain === TERRAIN_TYPES.water) {
                    componentVisited.add(k);
                    component.push([nx, nz]);
                }
            }
        }

        // ── Step 2: 連結成分に隣接する waterSource タイルを収集 ─────────────

        const sourcesVisited = new Set<number>();
        const sourcesList: [number, number][] = [];

        for (const [wx, wz] of component) {
            for (const [ddx, ddz] of DIRS) {
                const nx = wx + ddx;
                const nz = wz + ddz;
                if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
                const k = key(nx, nz);
                if (sourcesVisited.has(k)) continue;

                const nGroundY = voxelMap.getGroundSurfacePosition({ x: nx, z: nz }).y;
                if (nGroundY >= horizonH) continue;

                const nTerrain = getTerrainTypeFromVoxel(voxelMap.get({ x: nx, y: nGroundY + 1, z: nz }));
                if (nTerrain === TERRAIN_TYPES.waterSource) {
                    sourcesVisited.add(k);
                    sourcesList.push([nx, nz]);
                }
            }
        }

        // ── Step 3: 多源BFS で各タイルの距離を記録（maxDist 歩まで） ────────

        const distMap = new Map<number, number>();
        const bfsQueue: [number, number, number][] = [];

        for (const [srcX, srcZ] of sourcesList) {
            const k = key(srcX, srcZ);
            if (!distMap.has(k)) {
                distMap.set(k, 0);
                bfsQueue.push([srcX, srcZ, 0]);
            }
        }

        let bfsIdx = 0;
        while (bfsIdx < bfsQueue.length) {
            const [x, z, dist] = bfsQueue[bfsIdx++];

            if (dist >= maxDist) continue;

            for (const [ddx, ddz] of DIRS) {
                const nx = x + ddx;
                const nz = z + ddz;
                if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
                const k = key(nx, nz);
                if (distMap.has(k)) continue;

                const nGroundY = voxelMap.getGroundSurfacePosition({ x: nx, z: nz }).y;
                if (nGroundY >= horizonH) continue;

                const nTerrain = getTerrainTypeFromVoxel(voxelMap.get({ x: nx, y: nGroundY + 1, z: nz }));
                if (nTerrain === TERRAIN_TYPES.water || nTerrain === TERRAIN_TYPES.waterSource) {
                    distMap.set(k, dist + 1);
                    bfsQueue.push([nx, nz, dist + 1]);
                }
            }
        }

        // ── Step 4: 到達されなかったか距離 > maxDist のタイルの水を除去 ─────

        for (const [wx, wz] of component) {
            const k = key(wx, wz);
            const d = distMap.get(k);
            if (d === undefined || d > maxDist) {
                const gy = voxelMap.getGroundSurfacePosition({ x: wx, z: wz }).y;
                for (let y = gy + 1; y <= horizonH; y++) {
                    voxelMap.remove({ x: wx, y, z: wz });
                }
            }
        }

        // globalVisited にマージ（同じ連結成分を二重に探索しない）
        for (const k of componentVisited) globalVisited.add(k);
    }
}
