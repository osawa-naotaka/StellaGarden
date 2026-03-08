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
 * 陸地セル限定の Priority-Flood でくぼ地を埋める。
 *
 * 全セル対象の fillDepressions を使うと海セルも陸地として流路計算され、
 * accumulation が海底セルに吸収されて陸上に戻らなくなる（川が生成されない原因）。
 * 本関数は海セル（hm < horizonHeight）を outlet として扱い、
 * 陸地セルのみで Priority-Flood を行う。
 * → 沿岸の陸セルが真の outlet になり、accumulation が陸上に集中する。
 */
function fillLandDepressions(
    hmf: Float32Array,
    hm: Int32Array,
    horizonHeight: number,
    width: number,
    depth: number,
): Float32Array {
    const DIRS8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as const;
    const filled  = new Float32Array(hmf);
    const visited = new Uint8Array(width * depth);

    const heap: Array<[number, number]> = [];
    const heapPush = (val: number, idx: number) => {
        heap.push([val, idx]);
        let i = heap.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p][0] <= heap[i][0]) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const heapPop = (): [number, number] => {
        const top = heap[0];
        const last = heap.pop()!;
        if (heap.length > 0) {
            heap[0] = last;
            let i = 0;
            while (true) {
                let s = i;
                const l = 2 * i + 1, r = 2 * i + 2;
                if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
                if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
                if (s === i) break;
                [heap[i], heap[s]] = [heap[s], heap[i]];
                i = s;
            }
        }
        return top;
    };

    // シード: 海セルに隣接する陸地セル（沿岸セル）＋マップ境界の陸地セル
    for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            const idx = z * width + x;
            if (hm[idx] < horizonHeight) { visited[idx] = 1; continue; } // 海セルは処理対象外

            let isSeed = (x === 0 || x === width - 1 || z === 0 || z === depth - 1);
            if (!isSeed) {
                for (const [dz, dx] of DIRS8) {
                    const nx = x + dx, nz = z + dz;
                    if (nx < 0 || nx >= width || nz < 0 || nz >= depth) { isSeed = true; break; }
                    if (hm[nz * width + nx] < horizonHeight) { isSeed = true; break; } // 海隣接
                }
            }
            if (isSeed) {
                heapPush(hmf[idx], idx);
                visited[idx] = 1;
            }
        }
    }

    // 陸地セルのみで低い順に処理
    while (heap.length > 0) {
        const [h, idx] = heapPop();
        const x = idx % width, z = (idx / width) | 0;
        for (const [dz, dx] of DIRS8) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nx >= width || nz < 0 || nz >= depth) continue;
            const nidx = nz * width + nx;
            if (visited[nidx]) continue;
            if (hm[nidx] < horizonHeight) { visited[nidx] = 1; continue; } // 海セルはスキップ
            visited[nidx] = 1;
            filled[nidx] = Math.max(hmf[nidx], h);
            heapPush(filled[nidx], nidx);
        }
    }

    return filled;
}

/**
 * パス追跡方式で川を生成する。
 *
 * フロー累積は map.height が小さい（6段階）と沿岸に出口が多数生まれて
 * 累積が分散し機能しないため、代わりに以下の方法を用いる:
 *
 * 1. fillLandDepressions でくぼ地補正済みの effectiveHmf を作る
 * 2. 高地の山頂付近から N 本の川を発生させる（春点選択）
 * 3. 各春点から effectiveHmf の最急降下方向に追跡して海まで連続したパスを引く
 * 4. 経過距離に応じて川幅を広げる（下流ほど幅広）
 */
function generateRivers(map: VoxelMap, hm: Int32Array, hmf: Float32Array): void {
    const W = map.width, D = map.depth;
    const DIRS8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as const;

    // くぼ地補正: 平坦エリアでも底→縁方向に微小勾配を付与して追跡を安定させる
    const filledHmf = fillLandDepressions(hmf, hm, map.horizonHeight, W, D);
    const effectiveHmf = new Float32Array(W * D);
    for (let i = 0; i < W * D; i++) {
        effectiveHmf[i] = filledHmf[i] + (filledHmf[i] - hmf[i]) * 1e-4;
    }

    // 春点（river source）の選択:
    //   上位 30% の陸地セルから、互いに MIN_SEP タイル以上離れた点を選ぶ
    const NUM_RIVERS  = 25;
    const MIN_SEP     = 25;
    const TOP_FRAC    = 0.30;

    const landByHeight: number[] = [];
    for (let i = 0; i < W * D; i++) {
        if (hm[i] >= map.horizonHeight) landByHeight.push(i);
    }
    landByHeight.sort((a, b) => effectiveHmf[b] - effectiveHmf[a]);

    const rng     = alea("river_sources");
    const topN    = (landByHeight.length * TOP_FRAC) | 0;
    const pool    = landByHeight.slice(0, topN);
    // Fisher-Yates シャッフルで重複なくランダムに選ぶ
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

    // 各川を追跡してタイルをマーク
    // visited を川ごとに使い回す（配列確保コスト削減）
    const riverCells = new Uint8Array(W * D);
    const visited    = new Uint8Array(W * D);

    for (const spring of springs) {
        visited.fill(0);
        let idx  = spring;
        let step = 0;

        while (step < 5000) {
            if (visited[idx]) break;
            visited[idx] = 1;

            const x = idx % W, z = (idx / W) | 0;

            if (hm[idx] >= map.horizonHeight) {
                riverCells[idx] = 1;
                // 下流ほど幅を広げる
                if (step > 30) {
                    for (const [dz, dx] of DIRS8) {
                        const nx = x + dx, nz = z + dz;
                        if (nx >= 0 && nx < W && nz >= 0 && nz < D) {
                            if (hm[nz * W + nx] >= map.horizonHeight) riverCells[nz * W + nx] = 1;
                        }
                    }
                }
            } else {
                break; // 海に到達 → 終了
            }

            // 次のセル: 未訪問の隣接セルのうち effectiveHmf が最小のものへ
            // ★ 現在セルより高くても移動する（平坦エリア通過のため厳密降下を外す）
            let minF   = Infinity;
            let minIdx = -1;
            for (const [dz, dx] of DIRS8) {
                const nx = x + dx, nz = z + dz;
                if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
                const nidx = nz * W + nx;
                if (visited[nidx]) continue;
                const nf = effectiveHmf[nidx];
                if (nf < minF) { minF = nf; minIdx = nidx; }
            }

            if (minIdx === -1) break; // 全8隣接が訪問済み（ほぼ発生しない）
            idx = minIdx;
            step++;
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
