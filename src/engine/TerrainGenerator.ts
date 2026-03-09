import alea from "alea";
import { createNoise2D } from "simplex-noise";
import { VoxelMap, type Pos2D } from "../lib/VoxelMap";
import { ENTITY_TYPES, TERRAIN_TYPES } from "./TerrainDefs";
import { floodFillWater } from "./WaterSystem";

export type GenerateTerrainOptions = {
    width: number;
    height: number;
    depth: number;
    horizontalHeight: number;
};

type River = {
    waterSource: number;
    path: number[];
}

/** シンプレックスノイズで地形と樹木を生成し、VoxelMap に書き込む。 */
export function generateTerrain(opt: GenerateTerrainOptions): VoxelMap {
    const hightMap = computeHeightmap(opt.width, opt.depth, opt.height);
    const rivers = generateRivers(hightMap.hm, hightMap.hmf, opt);
    const hm = elodeRiverside(hightMap.hm, rivers, opt); // 渓谷カービングで高さマップを掘り下げる
    const map = createVoxelMap(hm, rivers, opt);
    // floodFillWater(map);
    placeForestTrees(map);

    return map;
}

function elodeRiverside(hm: Int8Array, rivers: River[], opt: GenerateTerrainOptions): Int8Array {
    for (const river of rivers) {
        for (const idx of river.path) {
            const h = hm[idx];            
            hm[idx] = Math.max(opt.horizontalHeight - 1, h - 1); // 水面より高い位置は掘り下げる（最大2ブロック）
        }
    }

    // --- BFS 平滑化: 隣接タイルの高さ差が1以下になるように周囲を掘る ---
    const DIRS4: ReadonlyArray<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const carvedQueue: number[] = rivers.flatMap(river => river.path);
    let qHead = 0;
    while (qHead < carvedQueue.length) {
        const idx = carvedQueue[qHead++];
        const { x, z } = idxToPos(idx, opt.width);
        const h = hm[idx];
        for (const [dx, dz] of DIRS4) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nx >= opt.width || nz < 0 || nz >= opt.depth) continue;
            const nidx = nz * opt.width + nx;
            if (hm[nidx] > h + 1) {
                hm[nidx] = h + 1;
                carvedQueue.push(nidx);
            }
        }
    }

    return hm;
}

function idxToPos(idx: number, width: number): Pos2D {
    return { x: idx % width, z: (idx / width) | 0 };
}

/**
 * fBm ノイズから高さマップを返す。
 * - hm:  Int32Array   … VoxelMap 書き込み用の整数高さ（0 〜 maxHeight-1）
 * - hmf: Float32Array … フロー方向計算用の連続値（0.0 〜 1.0）
 *   整数化すると同値セルが多発して flowDir が全て -1 になるため、
 *   フロー計算には必ず hmf を使う。
 */
function computeHeightmap(width: number, depth: number, maxHeight: number): { hm: Int8Array; hmf: Float32Array } {
    const octaves = [
        { noise: createNoise2D(alea("terrain_0")), frequency: 0.008, amplitude: 1.0 }, // 大陸スケール
        { noise: createNoise2D(alea("terrain_1")), frequency: 0.025, amplitude: 0.45 }, // 山・谷
        { noise: createNoise2D(alea("terrain_2")), frequency: 0.07, amplitude: 0.18 }, // 丘
        { noise: createNoise2D(alea("terrain_3")), frequency: 0.18, amplitude: 0.07 }, // 細かい起伏
    ];
    const totalAmplitude = octaves.reduce((s, o) => s + o.amplitude, 0);

    const hm = new Int8Array(width * depth);
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
            hm[idx] = Math.min(maxHeight - 1, Math.floor(normalized * maxHeight));
        }
    }
    return { hm, hmf };
}

/** 高さマップを VoxelMap に書き込む。水源位置にはwaterSourceブロックを配置する。 */
function createVoxelMap(hm: Int8Array, rivers: River[], opt: GenerateTerrainOptions): VoxelMap {
    const map = new VoxelMap(opt.width, opt.height, opt.depth, opt.horizontalHeight);

    for (let z = 0; z < opt.depth; z++) {
        for (let x = 0; x < opt.width; x++) {
            const idx = z * opt.width + x;
            const h = hm[idx];
            if (h < opt.horizontalHeight) {
                for (let y = 0; y < h; y++) map.set(TERRAIN_TYPES.dirt, { x, y, z });
                map.set(TERRAIN_TYPES.water, { x, y: h, z });
            } else {
                for (let y = 0; y < h; y++) map.set(TERRAIN_TYPES.dirt, { x, y, z });
                // 水源位置には waterSource を配置、それ以外は草地
                if (rivers.some(river => river.waterSource === idx)) {
                    map.set(TERRAIN_TYPES.waterSource, { x, y: h, z });
                } else {
                    map.set(TERRAIN_TYPES.grass, { x, y: h, z });
                }
            }
        }
    }

    return map;
}

/**
 * 渓谷カービング + 水源配置方式で川を生成する。
 *
 * 1. 貪欲ウォーク（既存）で春点→海岸のパスを生成
 * 2. パスの高さプロファイルを単調減少に補正
 * 3. パスに沿って渓谷をカービング（ハイトマップを掘り下げる）
 * 4. 春点に水源ブロック（waterSource）を配置
 *
 * 水の配置は後続の floodFillWater() が行う。
 * hm は in-place で変更される（渓谷カービングのため）。
 */

function generateRivers(hm: Int8Array, hmf: Float32Array, opt: GenerateTerrainOptions): River[] {
    const DIRS8: ReadonlyArray<[number, number]> = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
    ];

    // --- ノイズマップ生成 ---
    const pathNoise = createNoise2D(alea("river_path"));
    const NOISE_SCALE = 1.4;
    const NOISE_WEIGHT = 15.0;

    const noiseCost = new Float32Array(opt.width * opt.depth);
    for (let z = 0; z < opt.depth; z++) {
        for (let x = 0; x < opt.width; x++) {
            noiseCost[z * opt.width + x] = (pathNoise(x * NOISE_SCALE, z * NOISE_SCALE) + 1) * 0.5;
        }
    }

    // --- 海までの距離マップ（BFS）---
    const distToSea = new Float32Array(opt.width * opt.depth);
    distToSea.fill(Infinity);
    const bfsQueue: number[] = [];
    for (let z = 0; z < opt.depth; z++) {
        for (let x = 0; x < opt.width; x++) {
            const idx = z * opt.width + x;
            if (hm[idx] < opt.horizontalHeight) {
                distToSea[idx] = 0;
                bfsQueue.push(idx);
            }
        }
    }
    let head = 0;
    while (head < bfsQueue.length) {
        const idx = bfsQueue[head++];
        const { x, z } = idxToPos(idx, opt.width);
        const d = distToSea[idx];
        for (const [dz, dx] of DIRS8) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= opt.width || nz < 0 || nz >= opt.depth) continue;
            const nidx = nz * opt.width + nx;
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
    const TOP_FRAC = 0.3;

    const landByHeight: number[] = [];
    for (let i = 0; i < opt.width * opt.depth; i++) {
        if (hm[i] >= opt.horizontalHeight) landByHeight.push(i);
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
        const { x: sx, z: sz } = idxToPos(idx, opt.width);
        let tooClose = false;
        for (const [cx, cz] of springCoords) {
            if (Math.abs(cx - sx) + Math.abs(cz - sz) < MIN_SEP) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) {
            springs.push(idx);
            springCoords.push([sx, sz]);
        }
    }

    // --- 貪欲ウォークで各川のパスを生成 ---

    // 水源位置を記録（writeHeightmap 後に配置するため）
    const rivers: River[] = [];

    for (const spring of springs) {
        const visited = new Uint8Array(opt.width * opt.depth);
        const path: number[] = [];
        let current = spring;

        // パス生成（貪欲ウォーク）
        let i = 0;
        while (i < 5000) {
            if (visited[current]) break;
            visited[current] = 1;
            path[i++] = current;

            if (hm[current] < opt.horizontalHeight) break;

            const { x: cx, z: cz } = idxToPos(current, opt.width);
            let bestScore = Infinity;
            let bestIdx = -1;
            for (const [dz, dx] of DIRS8) {
                const nx = cx + dx,
                    nz = cz + dz;
                if (nx < 0 || nx >= opt.width || nz < 0 || nz >= opt.depth) continue;
                const nidx = nz * opt.width + nx;
                if (visited[nidx]) continue;
                const score = distToSea[nidx] + noiseCost[nidx] * NOISE_WEIGHT;
                if (score < bestScore) {
                    bestScore = score;
                    bestIdx = nidx;
                }
            }

            if (bestIdx === -1) break;
            current = bestIdx;
        }

        if (i < 5) continue; // 短すぎるパスはスキップ

        // 春点を水源として記録
        rivers.push({ waterSource: spring, path });
    }

    return rivers;
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
