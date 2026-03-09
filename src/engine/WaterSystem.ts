import type { IVoxelWriter } from "../_boundary/interfaces";
import { getTerrainTypeFromVoxel, TERRAIN_TYPES } from "./TerrainDefs";

/**
 * Depression Filling アルゴリズムで水源から水を広げる。
 *
 * 全水源（waterSource）を起点に、低い方へ BFS で水を伝播させる。
 * 窪地がある場合は rim の高さまで水が溜まる。
 *
 * 地形生成時とゲーム中の地形変更後の両方で使用する。
 */
export function floodFillWater(map: IVoxelWriter): void {
    const W = map.width;
    const D = map.depth;
    const H = map.height;

    // --- 1. 既存の water タイルを除去（waterSource は残す）---
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                const voxel = map.get({ x, y, z });
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.water) {
                    map.remove({ x, y, z });
                }
            }
        }
    }

    // --- 2. 各セルの地表高さを計算 + 水源を収集 ---
    const groundHeight = new Int32Array(W * D);
    const sources: Array<{ x: number; z: number; y: number }> = [];

    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            // 上から走査して最初の非空ブロックを探す
            let surfaceY = -1;
            for (let y = H - 1; y >= 0; y--) {
                const voxel = map.get({ x, y, z });
                if (voxel !== 0) {
                    surfaceY = y;
                    if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.waterSource) {
                        sources.push({ x, z, y });
                    }
                    break;
                }
            }
            groundHeight[z * W + x] = surfaceY;
        }
    }

    // --- 3. 海水の復元（水源の有無に関係なく常に実行）---
    const horizonH = map.horizonHeight;
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            const gh = groundHeight[z * W + x];
            if (gh < horizonH - 1) {
                for (let y = gh + 1; y < horizonH; y++) {
                    map.set(TERRAIN_TYPES.water, { x, y, z });
                }
            }
        }
    }

    if (sources.length === 0) return;

    // --- 4. Depression Filling（優先度付きキュー）---
    // 水面高さが低いセルから順に処理する。
    // 簡易的な優先度付きキューとしてバケットキューを使用。
    // 高さは 0〜H 程度なので、バケット数は H+1 で十分。

    const waterLevel = new Int32Array(W * D).fill(-1); // -1 = 未訪問
    const isWater = new Uint8Array(W * D); // 水を配置するセル

    // バケットキュー: buckets[level] = [idx, idx, ...]
    const buckets: number[][] = [];
    for (let i = 0; i <= H; i++) buckets.push([]);
    let minBucket = H + 1;

    // 水源をキューに投入
    for (const src of sources) {
        const idx = src.z * W + src.x;
        if (waterLevel[idx] !== -1) continue;
        const level = src.y;
        waterLevel[idx] = level;
        buckets[level].push(idx);
        if (level < minBucket) minBucket = level;
    }

    const DIRS4: ReadonlyArray<[number, number]> = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
    ];

    while (minBucket <= H) {
        const bucket = buckets[minBucket];
        if (bucket.length === 0) {
            minBucket++;
            continue;
        }
        const idx = bucket.pop()!;
        const x = idx % W;
        const z = (idx / W) | 0;
        const level = waterLevel[idx];

        for (const [dx, dz] of DIRS4) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
            const nidx = nz * W + nx;
            if (waterLevel[nidx] !== -1) continue;

            const gh = groundHeight[nidx];
            if (gh < 0) continue; // 空のカラム

            // 隣接セルの水面は「流入元の水面」と「地面の高さ」の高い方
            const newLevel = Math.max(gh, level);

            // 水面が高さ上限を超える場合はスキップ
            if (newLevel >= H) continue;

            waterLevel[nidx] = newLevel;

            // 地面より水面が高い = 水で満たされている
            if (newLevel > gh) {
                isWater[nidx] = 1;
            }

            buckets[newLevel].push(nidx);
            if (newLevel < minBucket) minBucket = newLevel;
        }
    }

    // --- 5. 水源からの水タイルを配置 ---
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            const idx = z * W + x;
            if (!isWater[idx]) continue;
            const gh = groundHeight[idx];
            const wl = waterLevel[idx];
            const startY = Math.max(gh + 1, horizonH); // 海水と重複しないように
            for (let y = startY; y <= wl; y++) {
                map.set(TERRAIN_TYPES.water, { x, y, z });
            }
        }
    }
}
