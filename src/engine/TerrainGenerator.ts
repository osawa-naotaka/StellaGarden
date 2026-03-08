import alea from "alea";
import { createNoise2D } from "simplex-noise";
import type { VoxelMap } from "../lib/VoxelMap";
import { ENTITY_TYPES, TERRAIN_TYPES } from "./TerrainDefs";

/** シンプレックスノイズで地形と樹木を生成し、VoxelMap に書き込む。 */
export function generateTerrain(map: VoxelMap): void {
    const { hm, hmf } = computeHeightmap(map.width, map.depth, map.height);
    writeHeightmap(map, hm, map.horizonHeight);
    generateRivers(map, hm, hmf);
    placeForestTrees(map);
}

/**
 * fBm ノイズから高さマップを返す。
 * - hm:  Int32Array   … VoxelMap 書き込み用の整数高さ（0 〜 maxHeight-1）
 * - hmf: Float32Array … フロー方向計算用の連続値（0.0 〜 1.0）
 *   整数化すると同値セルが多発して flowDir が全て -1 になるため、
 *   フロー計算には必ず hmf を使う。
 */
function computeHeightmap(
    width: number,
    depth: number,
    maxHeight: number,
): { hm: Int32Array; hmf: Float32Array } {
    const octaves = [
        { noise: createNoise2D(alea("terrain_0")), frequency: 0.008, amplitude: 1.00 }, // 大陸スケール
        { noise: createNoise2D(alea("terrain_1")), frequency: 0.025, amplitude: 0.45 }, // 山・谷
        { noise: createNoise2D(alea("terrain_2")), frequency: 0.070, amplitude: 0.18 }, // 丘
        { noise: createNoise2D(alea("terrain_3")), frequency: 0.180, amplitude: 0.07 }, // 細かい起伏
    ];
    const totalAmplitude = octaves.reduce((s, o) => s + o.amplitude, 0);

    const hm  = new Int32Array(width * depth);
    const hmf = new Float32Array(width * depth);
    for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            let n = 0;
            for (const { noise, frequency, amplitude } of octaves) {
                n += noise(x * frequency, z * frequency) * amplitude;
            }
            const normalized = (n / totalAmplitude + 1) * 0.5; // [0, 1]
            const idx = z * width + x;
            hmf[idx] = normalized;
            hm[idx]  = Math.min(maxHeight - 1, Math.floor(normalized * maxHeight));
        }
    }
    return { hm, hmf };
}

/** 高さマップを VoxelMap に書き込む。 */
function writeHeightmap(map: VoxelMap, hm: Int32Array, horizonHeight: number): void {
    const W = map.width;
    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const h = hm[z * W + x];
            if (h < horizonHeight) {
                for (let y = 0; y < h; y++) map.set(TERRAIN_TYPES.dirt, { x, y, z });
                for (let y = h; y < horizonHeight; y++) map.set(TERRAIN_TYPES.water, { x, y, z });
            } else {
                for (let y = 0; y < h; y++) map.set(TERRAIN_TYPES.dirt, { x, y, z });
                map.set(TERRAIN_TYPES.grass, { x, y: h, z });
            }
        }
    }
}

/**
 * 貪欲ウォーク + ノイズコスト方式で川を生成する。
 *
 * bigbadwofl 方式: 各ステップで「目標までの距離 + ノイズ値」が最小の
 * 隣接セルを貪欲に選ぶ。累積コストを持たないため、ノイズが毎ステップ
 * 横方向に引っ張ることで自然な蛇行が生まれる。
 *
 * 1. 高地の山頂付近から N 本の川を発生させる（春点選択）
 * 2. 各春点から最寄りの海岸／海セルへ向かって貪欲ウォーク
 * 3. score = 目標までの距離 + ノイズ値 × 重み で次セルを選択
 * 4. 経過距離に応じて川幅を広げる（下流ほど幅広）
 */
function generateRivers(map: VoxelMap, hm: Int32Array, hmf: Float32Array): void {
    const W = map.width, D = map.depth;
    const DIRS8: ReadonlyArray<[number, number]> = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    // --- ノイズマップ生成 ---
    // 貪欲ウォークのスコアに加算するノイズ。これが蛇行の源。
    const pathNoise = createNoise2D(alea("river_path"));
    const NOISE_SCALE = 1.4;   // ノイズの空間周波数（小さいほど大きなカーブ）
    const NOISE_WEIGHT = 5.0;   // ノイズコストの重み（距離1に対してノイズ0〜5で横に引っ張る）

    // ノイズコストマップを事前計算（0〜1 に正規化）
    const noiseCost = new Float32Array(W * D);
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            noiseCost[z * W + x] = (pathNoise(x * NOISE_SCALE, z * NOISE_SCALE) + 1) * 0.5;
        }
    }

    // --- 各海セルから最寄りの海岸までの距離マップ（BFS）---
    // 貪欲ウォークのヒューリスティックとして使う。
    // マンハッタン距離だと最寄りの海岸1点にしか向かわないが、
    // BFS距離なら「最も近い海」全体に向かうので、パスが自然に集束する。
    const distToSea = new Float32Array(W * D);
    distToSea.fill(Infinity);
    const bfsQueue: number[] = [];
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            const idx = z * W + x;
            if (hm[idx] < map.horizonHeight) {
                distToSea[idx] = 0;
                bfsQueue.push(idx);
            }
        }
    }
    let head = 0;
    while (head < bfsQueue.length) {
        const idx = bfsQueue[head++];
        const x = idx % W, z = (idx / W) | 0;
        const d = distToSea[idx];
        for (const [dz, dx] of DIRS8) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
            const nidx = nz * W + nx;
            const nd = d + 1;
            if (nd < distToSea[nidx]) {
                distToSea[nidx] = nd;
                bfsQueue.push(nidx);
            }
        }
    }

    // --- 春点（river source）の選択 ---
    const NUM_RIVERS = 25;
    const MIN_SEP = 25;
    const TOP_FRAC = 0.30;

    const landByHeight: number[] = [];
    for (let i = 0; i < W * D; i++) {
        if (hm[i] >= map.horizonHeight) landByHeight.push(i);
    }
    landByHeight.sort((a, b) => hmf[b] - hmf[a]);

    const rng = alea("river_sources");
    const topN = (landByHeight.length * TOP_FRAC) | 0;
    const pool = landByHeight.slice(0, topN);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const springs: number[] = [];
    const springCoords: Array<[number, number]> = [];
    for (const idx of pool) {
        if (springs.length >= NUM_RIVERS) break;
        const sx = idx % W, sz = (idx / W) | 0;
        let tooClose = false;
        for (const [cx, cz] of springCoords) {
            if (Math.abs(cx - sx) + Math.abs(cz - sz) < MIN_SEP) { tooClose = true; break; }
        }
        if (!tooClose) { springs.push(idx); springCoords.push([sx, sz]); }
    }

    // --- 貪欲ウォークで各川のパスを生成 ---
    const riverCells = new Uint8Array(W * D);

    for (const spring of springs) {
        const visited = new Uint8Array(W * D);
        const path: number[] = [];
        let current = spring;

        while (path.length < 5000) {
            if (visited[current]) break;
            visited[current] = 1;
            path.push(current);

            // 海に到達 → 終了
            if (hm[current] < map.horizonHeight) break;

            // 未訪問の隣接セルの中で score = distToSea + noise * weight が最小のものを選ぶ
            const cx = current % W, cz = (current / W) | 0;
            let bestScore = Infinity;
            let bestIdx = -1;
            for (const [dz, dx] of DIRS8) {
                const nx = cx + dx, nz = cz + dz;
                if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
                const nidx = nz * W + nx;
                if (visited[nidx]) continue;
                const score = distToSea[nidx] + noiseCost[nidx] * NOISE_WEIGHT;
                if (score < bestScore) { bestScore = score; bestIdx = nidx; }
            }

            if (bestIdx === -1) break;
            current = bestIdx;
        }

        // パスの各セルを riverCells にマーク（下流ほど幅を広げる）
        for (let i = 0; i < path.length; i++) {
            const idx = path[i];
            if (hm[idx] < map.horizonHeight) continue;
            riverCells[idx] = 1;

            // 後半 60% は幅を広げる（3x3）
            const progress = i / path.length;
            if (progress > 0.4) {
                const px = idx % W, pz = (idx / W) | 0;
                for (const [dz, dx] of DIRS8) {
                    const nx = px + dx, nz = pz + dz;
                    if (nx >= 0 && nx < W && nz >= 0 && nz < D) {
                        const nidx = nz * W + nx;
                        if (hm[nidx] >= map.horizonHeight) riverCells[nidx] = 1;
                    }
                }
            }
        }
    }

    // マークされた陸地セルを water タイルに変換
    for (let i = 0; i < W * D; i++) {
        if (!riverCells[i]) continue;
        const x = i % W, z = (i / W) | 0;
        map.set(TERRAIN_TYPES.water, { x, y: hm[i], z });
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
