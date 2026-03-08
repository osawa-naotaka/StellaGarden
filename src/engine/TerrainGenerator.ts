import alea from "alea";
import { createNoise2D } from "simplex-noise";
import type { VoxelMap } from "../lib/VoxelMap";
import { ENTITY_TYPES, TERRAIN_TYPES } from "./TerrainDefs";

/** シンプレックスノイズで地形と樹木を生成し、VoxelMap に書き込む。 */
export function generateTerrain(map: VoxelMap): void {
    const hm = computeHeightmap(map.width, map.depth, map.height);
    writeHeightmap(map, hm);
    generateRivers(map, hm);
    placeForestTrees(map);
}

/** fBm ノイズから高さマップを Int32Array で返す（VoxelMap への書き込みは行わない）。 */
function computeHeightmap(width: number, depth: number, maxHeight: number): Int32Array {
    const octaves = [
        { noise: createNoise2D(alea("terrain_0")), frequency: 0.008, amplitude: 1.00 }, // 大陸スケール
        { noise: createNoise2D(alea("terrain_1")), frequency: 0.025, amplitude: 0.45 }, // 山・谷
        { noise: createNoise2D(alea("terrain_2")), frequency: 0.070, amplitude: 0.18 }, // 丘
        { noise: createNoise2D(alea("terrain_3")), frequency: 0.180, amplitude: 0.07 }, // 細かい起伏
    ];
    const totalAmplitude = octaves.reduce((s, o) => s + o.amplitude, 0);

    const hm = new Int32Array(width * depth);
    for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            let n = 0;
            for (const { noise, frequency, amplitude } of octaves) {
                n += noise(x * frequency, z * frequency) * amplitude;
            }
            n /= totalAmplitude; // [-1, 1] に正規化
            hm[z * width + x] = Math.min(maxHeight - 1, Math.floor((n + 1) * 0.5 * maxHeight));
        }
    }
    return hm;
}

/** 高さマップを VoxelMap に書き込む。 */
function writeHeightmap(map: VoxelMap, hm: Int32Array): void {
    const W = map.width;
    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const h = hm[z * W + x];
            if (h < map.horizonHeight) {
                for (let y = 0; y < h; y++) map.set(TERRAIN_TYPES.dirt, { x, y, z });
                for (let y = h; y < map.horizonHeight; y++) map.set(TERRAIN_TYPES.water, { x, y, z });
            } else {
                for (let y = 0; y < h; y++) map.set(TERRAIN_TYPES.dirt, { x, y, z });
                map.set(TERRAIN_TYPES.grass, { x, y: h, z });
            }
        }
    }
}

/**
 * フロー累積アルゴリズムで川を生成する。
 *
 * 1. 各陸上セルの「最急降下方向」を計算（8方向 D8 法）
 * 2. セルを高い順に処理し、上流から順に累積値を下流へ伝播（1パスで完結）
 * 3. 累積値が閾値を超えたセルの表面を water に置き換える
 *    → 地形を削らず川タイルを置くだけなので渓谷にはならない
 */
function generateRivers(map: VoxelMap, hm: Int32Array): void {
    const W = map.width, D = map.depth;
    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as const;

    // 各セルの流れ先インデックス（-1 = 境界 or 海に到達 → 流れ終わり）
    const flowDir = new Int32Array(W * D).fill(-1);
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            const idx = z * W + x;
            const h = hm[idx];
            if (h < map.horizonHeight) continue; // 海セルはスキップ

            let minH = h;
            let minIdx = -1;
            for (const [dz, dx] of DIRS) {
                const nx = x + dx, nz = z + dz;
                if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
                const nh = hm[nz * W + nx];
                if (nh < minH) { minH = nh; minIdx = nz * W + nx; }
            }
            flowDir[idx] = minIdx;
        }
    }

    // セルを高さ降順でソート → DAG なので1パスで上流から累積を伝播できる
    const order = Array.from({ length: W * D }, (_, i) => i);
    order.sort((a, b) => hm[b] - hm[a]);

    const accum = new Float32Array(W * D).fill(1);
    for (const idx of order) {
        const dst = flowDir[idx];
        if (dst !== -1) accum[dst] += accum[idx];
    }

    // 閾値を超えたセルを川に（400×400 マップで中規模の川網が出る値）
    const RIVER_THRESHOLD = 250;   // 細い川（支流）
    const WIDE_RIVER_THRESHOLD = 900; // 幅広の川（本流）

    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            const idx = z * W + x;
            if (hm[idx] < map.horizonHeight) continue;
            if (accum[idx] < RIVER_THRESHOLD) continue;

            // 表面タイルを grass → water に置き換える（地形高さは変えない）
            map.set(TERRAIN_TYPES.water, { x, y: hm[idx], z });

            // 本流は隣接1セルまで広げる
            if (accum[idx] >= WIDE_RIVER_THRESHOLD) {
                for (const [dz, dx] of DIRS) {
                    const nx = x + dx, nz = z + dz;
                    if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
                    const nh = hm[nz * W + nx];
                    if (nh >= map.horizonHeight) {
                        map.set(TERRAIN_TYPES.water, { x: nx, y: nh, z: nz });
                    }
                }
            }
        }
    }
}

function placeForestTrees(map: VoxelMap): void {
    const forestNoise = createNoise2D(alea("forest"));
    const treeNoise = createNoise2D(alea("tree"));
    const forestScale = 0.025; // 森バイオームの周波数（低周波 = 大きなまとまり）
    const treeScale = 0.15; // 個別の木の配置周波数（高周波 = 細かい分布）

    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const isForestBiome = forestNoise(x * forestScale, z * forestScale) > 0.2;
            const shouldPlaceTree = isForestBiome && treeNoise(x * treeScale, z * treeScale) > 0.3;

            if (!shouldPlaceTree) continue;

            const pos = map.getSurfacePosition({ x, y: 0, z });
            const terrain = map.get(pos);

            if (terrain === TERRAIN_TYPES.soil || terrain === TERRAIN_TYPES.grass) {
                map.set(terrain | (ENTITY_TYPES.tree << 8), pos);
            }
        }
    }
}
