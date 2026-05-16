import alea from "alea";
import { createNoise2D } from "simplex-noise";
import { type Pos2D, VoxelMap } from "../lib/VoxelMap";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, placeEntity, setDaysElapsedInVoxel, setDisplacementXInVoxel, setDisplacementZInVoxel, setEntityTypeInVoxel, TERRAIN_TYPES } from "./VoxelDefs";

export type GenerateTerrainOptions = {
    width: number;
    height: number;
    depth: number;
    horizonHeight: number;
};

type River = {
    path: number[];
};

/** シンプレックスノイズで地形と樹木を生成し、VoxelMap に書き込む。 */
export function generateTerrain(seed: string, opt: GenerateTerrainOptions): VoxelMap {
    const hightMap = computeHeightmap(seed, opt.width, opt.depth, opt.height);
    const { major, tributaries } = generateRivers(seed, hightMap.hm, hightMap.hmf, opt);
    const hm = elodeRiverside(hightMap.hm, [...major, ...tributaries], opt); // 渓谷カービングで高さマップを掘り下げる
    const map = createVoxelMap(hm, opt);
    const riversideCells = placeClay(seed, map, hm, major, opt);
    map.setRiversideCells(riversideCells);
    placeEntities(seed, map);

    return map;
}

export function generateTestTerrain(opt: GenerateTerrainOptions): VoxelMap {
    const hm = new Int8Array(opt.width * opt.depth).fill(opt.horizonHeight);

    let bin = 0;
    for (let h = 0; h < 16; h++) {
        for (let w = 0; w < 16; w++) {
            const base = h * 4 * opt.width + w * 4;

            // center
            hm[base + 1 * opt.width + 1] = opt.horizonHeight + 1;

            if (bin & 1) hm[base + 0 * opt.width + 0] = opt.horizonHeight + 1;
            if (bin & 2) hm[base + 0 * opt.width + 1] = opt.horizonHeight + 1;
            if (bin & 4) hm[base + 0 * opt.width + 2] = opt.horizonHeight + 1;
            if (bin & 8) hm[base + 1 * opt.width + 0] = opt.horizonHeight + 1;
            if (bin & 16) hm[base + 1 * opt.width + 2] = opt.horizonHeight + 1;
            if (bin & 32) hm[base + 2 * opt.width + 0] = opt.horizonHeight + 1;
            if (bin & 64) hm[base + 2 * opt.width + 1] = opt.horizonHeight + 1;
            if (bin & 128) hm[base + 2 * opt.width + 2] = opt.horizonHeight + 1;

            bin++;
        }
    }

    const map = createVoxelMap(hm, opt);
    return map;
}

function elodeRiverside(hm: Int8Array, rivers: River[], opt: GenerateTerrainOptions): Int8Array {
    const SLOPE_INTERVAL = 4; // Nタイルごとに高さ+1（大きいほど緩やかな傾斜）

    for (const river of rivers) {
        for (const idx of river.path) {
            hm[idx] = opt.horizonHeight - 1; // 海面直下まで掘り下げ
        }
    }

    // --- BFS 平滑化: 川からの距離に応じて緩やかに高さを上げる ---
    const DIRS4: ReadonlyArray<[number, number]> = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
    ];
    const W = opt.width;
    const D = opt.depth;
    const riverH = opt.horizonHeight - 1;

    const dist = new Int32Array(W * D).fill(-1);
    const queue: number[] = [];
    for (const river of rivers) {
        for (const idx of river.path) {
            if (dist[idx] === -1) {
                dist[idx] = 0;
                queue.push(idx);
            }
        }
    }

    let qHead = 0;
    while (qHead < queue.length) {
        const idx = queue[qHead++];
        const { x, z } = idxToPos(idx, W);
        const d = dist[idx];
        for (const [dx, dz] of DIRS4) {
            const nx = x + dx,
                nz = z + dz;
            if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
            const nidx = nz * W + nx;
            if (dist[nidx] !== -1) continue;
            const nd = d + 1;
            const targetH = riverH + Math.ceil(nd / SLOPE_INTERVAL);
            if (hm[nidx] > targetH) {
                dist[nidx] = nd;
                hm[nidx] = targetH;
                queue.push(nidx);
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
function computeHeightmap(seed: string, width: number, depth: number, maxHeight: number): { hm: Int8Array; hmf: Float32Array } {
    const octaves = [
        { noise: createNoise2D(alea(`${seed}terrain_0`)), frequency: 0.008, amplitude: 1.0 }, // 大陸スケール
        { noise: createNoise2D(alea(`${seed}terrain_1`)), frequency: 0.025, amplitude: 0.45 }, // 山・谷
        { noise: createNoise2D(alea(`${seed}terrain_2`)), frequency: 0.07, amplitude: 0.18 }, // 丘
        { noise: createNoise2D(alea(`${seed}terrain_3`)), frequency: 0.18, amplitude: 0.07 }, // 細かい起伏
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

/** 高さマップを VoxelMap に書き込む。高さ < horizonHeight のタイルは水になる。 */
function createVoxelMap(hm: Int8Array, opt: GenerateTerrainOptions): VoxelMap {
    const map = new VoxelMap(opt.width, opt.height, opt.depth, opt.horizonHeight);
    const W = opt.width;
    const D = opt.depth;

    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            const idx = z * W + x;
            const h = hm[idx];
            if (h < opt.horizonHeight) {
                for (let y = 0; y <= h; y++) map.set(BigInt(TERRAIN_TYPES.dirt), { x, y, z });
                for (let y = h + 1; y <= opt.horizonHeight; y++) map.set(BigInt(TERRAIN_TYPES.waterSource), { x, y, z });
            } else {
                for (let y = 0; y < h; y++) map.set(BigInt(TERRAIN_TYPES.dirt), { x, y, z });
                // 水辺判定: h == horizonHeight かつ 4近傍に h < horizonHeight があれば grass ではなく dirt
                const isWaterside = h === opt.horizonHeight && isAdjacentToWater(hm, x, z, W, D, opt.horizonHeight);
                map.set(BigInt(isWaterside ? TERRAIN_TYPES.dirt : TERRAIN_TYPES.grass), { x, y: h, z });
            }
        }
    }

    return map;
}

/** (x, z) の 4 近傍に水（h < horizonHeight）があるかを返す。 */
function isAdjacentToWater(hm: Int8Array, x: number, z: number, W: number, D: number, horizonHeight: number): boolean {
    const DIRS: ReadonlyArray<[number, number]> = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
    ];
    for (const [dx, dz] of DIRS) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
        if (hm[nz * W + nx] < horizonHeight) return true;
    }
    return false;
}

/**
 * 大河パスに隣接する水辺セルを列挙し、CLAY_RATE の割合で粘土エンティティを配置する。
 * 戻り値は再生成レジストリ（VoxelMap.riversideCells）に格納される全水辺セルのインデックス配列。
 */
function placeClay(seed: string, map: VoxelMap, hm: Int8Array, majorRivers: River[], opt: GenerateTerrainOptions): Uint32Array {
    const CLAY_RATE = 0.15;
    const W = opt.width;
    const D = opt.depth;
    const DIRS: ReadonlyArray<[number, number]> = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
    ];

    const riversideSet = new Set<number>();
    for (const river of majorRivers) {
        for (const idx of river.path) {
            const { x, z } = idxToPos(idx, W);
            for (const [dx, dz] of DIRS) {
                const nx = x + dx;
                const nz = z + dz;
                if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
                const nidx = nz * W + nx;
                if (hm[nidx] === opt.horizonHeight) riversideSet.add(nidx);
            }
        }
    }

    const rng = alea(`${seed}clay_initial`);
    for (const idx of riversideSet) {
        if (rng() >= CLAY_RATE) continue;
        const pos = { x: idx % W, y: opt.horizonHeight, z: (idx / W) | 0 };
        const voxel = map.get(pos);
        const terrain = Number(voxel & 0xffn);
        const entity = Number((voxel >> 8n) & 0xffn);
        if (terrain === TERRAIN_TYPES.dirt && entity === ENTITY_TYPES.none) {
            map.set(voxel | (BigInt(ENTITY_TYPES.clay) << 8n), pos);
        }
    }

    return Uint32Array.from(riversideSet);
}

/**
 * 大河（ノイズ蛇行直線）＋支流（貪欲ウォーク）方式で川を生成する。
 *
 * 1. 大河: マップ対辺間をノイズで蛇行した直線パスで横断（2〜3本）
 * 2. 支流: 中〜高標高から大河/海岸へ向かう貪欲ウォーク（5〜10本）
 *
 * elodeRiverside() でパスに沿って海面まで掘り下げる。
 */
function generateRivers(seed: string, hm: Int8Array, hmf: Float32Array, opt: GenerateTerrainOptions): { major: River[]; tributaries: River[] } {
    const W = opt.width;
    const D = opt.depth;

    // --- 大河パス生成（ノイズ蛇行直線方式）---
    const MEANDER_AMPLITUDE = 40;
    const MEANDER_FREQUENCY = 3.0;

    const rngMajor = alea(`${seed}river_major_rng`);
    // 端点はマップ幅の20%〜80%の範囲に制限
    const margin20 = (v: number) => Math.floor(v * 0.2 + rngMajor() * v * 0.6);

    const majorRivers: River[] = [];

    // 左右方向の大河（1本）
    {
        const entryZ = margin20(D);
        const exitZ = margin20(D);
        const meanderNoise = createNoise2D(alea(`${seed}river_major_0`));
        const path: number[] = [];
        let prevZ = entryZ;
        for (let x = 0; x < W; x++) {
            const t = x / (W - 1);
            const baseZ = entryZ + (exitZ - entryZ) * t;
            const offset = MEANDER_AMPLITUDE * meanderNoise(t * MEANDER_FREQUENCY, 0);
            const z = Math.max(0, Math.min(D - 1, Math.round(baseZ + offset)));
            // 連続性保証: z が2以上飛ぶ場合は中間を補間
            const minZ = Math.min(prevZ, z);
            const maxZ = Math.max(prevZ, z);
            for (let iz = minZ; iz <= maxZ; iz++) {
                path.push(iz * W + x);
            }
            prevZ = z;
        }
        majorRivers.push({ path });
    }

    // 上下方向の大河（1本）
    {
        const entryX = margin20(W);
        const exitX = margin20(W);
        const meanderNoise = createNoise2D(alea(`${seed}river_major_1`));
        const path: number[] = [];
        let prevX = entryX;
        for (let z = 0; z < D; z++) {
            const t = z / (D - 1);
            const baseX = entryX + (exitX - entryX) * t;
            const offset = MEANDER_AMPLITUDE * meanderNoise(t * MEANDER_FREQUENCY, 0);
            const x = Math.max(0, Math.min(W - 1, Math.round(baseX + offset)));
            const minX = Math.min(prevX, x);
            const maxX = Math.max(prevX, x);
            for (let ix = minX; ix <= maxX; ix++) {
                path.push(z * W + ix);
            }
            prevX = x;
        }
        majorRivers.push({ path });
    }

    // --- 大河パスタイルのセットを構築（支流のdistToTarget計算に使う）---
    const majorPathSet = new Set<number>();
    for (const river of majorRivers) {
        for (const idx of river.path) majorPathSet.add(idx);
    }

    // --- 支流: distToTarget（海岸 or 大河タイル）BFS ---
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

    const distToTarget = new Float32Array(W * D);
    distToTarget.fill(Infinity);
    const bfsQueue: number[] = [];
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            const idx = z * W + x;
            if (hm[idx] < opt.horizonHeight || majorPathSet.has(idx)) {
                distToTarget[idx] = 0;
                bfsQueue.push(idx);
            }
        }
    }
    let head = 0;
    while (head < bfsQueue.length) {
        const idx = bfsQueue[head++];
        const { x, z } = idxToPos(idx, W);
        const d = distToTarget[idx];
        for (const [dz, dx] of DIRS8) {
            const nx = x + dx,
                nz = z + dz;
            if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
            const nidx = nz * W + nx;
            const nd = d + 1;
            if (nd < distToTarget[nidx]) {
                distToTarget[nidx] = nd;
                bfsQueue.push(nidx);
            }
        }
    }

    // --- 支流ノイズコスト ---
    const pathNoise = createNoise2D(alea(`${seed}river_trib`));
    const NOISE_SCALE = 1.4;
    const NOISE_WEIGHT = 4.0;
    const noiseCost = new Float32Array(W * D);
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            noiseCost[z * W + x] = (pathNoise(x * NOISE_SCALE, z * NOISE_SCALE) + 1) * 0.5;
        }
    }

    // --- 支流春点の選択 ---
    const NUM_TRIBS = 7;
    const MIN_SEP = 25;
    const TOP_FRAC = 0.4;

    const landByHeight: number[] = [];
    for (let i = 0; i < W * D; i++) {
        if (hm[i] >= opt.horizonHeight) landByHeight.push(i);
    }
    landByHeight.sort((a, b) => hmf[b] - hmf[a]);

    const rng = alea(`${seed}river_trib_sources`);
    const topN = (landByHeight.length * TOP_FRAC) | 0;
    const pool = landByHeight.slice(0, topN);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const springs: number[] = [];
    const springCoords: Array<[number, number]> = [];
    for (const idx of pool) {
        if (springs.length >= NUM_TRIBS) break;
        const { x: sx, z: sz } = idxToPos(idx, W);
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

    // --- 支流: 貪欲ウォーク ---
    const tributaries: River[] = [];
    for (const spring of springs) {
        const visited = new Uint8Array(W * D);
        const path: number[] = [];
        let current = spring;
        let i = 0;
        while (i < 5000) {
            if (visited[current]) break;
            visited[current] = 1;
            path[i++] = current;
            // 大河タイルまたは海岸に到達したら終了
            if (hm[current] < opt.horizonHeight || majorPathSet.has(current)) break;
            const { x: cx, z: cz } = idxToPos(current, W);
            let bestScore = Infinity;
            let bestIdx = -1;
            for (const [dz, dx] of DIRS8) {
                const nx = cx + dx,
                    nz = cz + dz;
                if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
                const nidx = nz * W + nx;
                if (visited[nidx]) continue;
                const score = distToTarget[nidx] + noiseCost[nidx] * NOISE_WEIGHT;
                if (score < bestScore) {
                    bestScore = score;
                    bestIdx = nidx;
                }
            }
            if (bestIdx === -1) break;
            current = bestIdx;
        }
        if (i < 5) continue;
        tributaries.push({ path });
    }

    return { major: majorRivers, tributaries };
}

function placeEntities(seed: string, map: VoxelMap): void {
    // 隕鉄を先に配置（2x2、レア）。以降のパスは既設エンティティを上書きしない。
    placeMeteoricIron(seed, map);

    const forestNoise = createNoise2D(alea(`${seed}forest`));
    const treeNoise = createNoise2D(alea(`${seed}tree`));
    const forestScale = 0.025; // 森バイオームの周波数（低周波 = 大きなまとまり）
    const treeScale = 10; // 個別の木の配置周波数（高周波 = 細かい分布）

    const stoneNoise = createNoise2D(alea(`${seed}stone`));
    const stoneScale = 10; // 個別の石の配置周波数（高周波 = 細かい分布）

    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const isForestBiome = forestNoise(x * forestScale, z * forestScale) > 0.2;
            const shouldPlaceTree = isForestBiome && treeNoise(x * treeScale, z * treeScale) > 0.4;
            const shouldPlaceStone = stoneNoise(x * stoneScale, z * stoneScale) > 0.9;

            if (!shouldPlaceTree && !shouldPlaceStone) continue;

            const pos = map.getSurfacePosition({ x, y: 0, z });
            const terrain = map.get(pos);
            const terrainType = getTerrainTypeFromVoxel(terrain);
            // 既存エンティティ（隕鉄・facility_part 等）があるタイルは上書きしない
            if (getEntityTypeFromVoxel(terrain) !== ENTITY_TYPES.none) continue;

            if (shouldPlaceStone) {
                if (terrainType === TERRAIN_TYPES.soil || terrainType === TERRAIN_TYPES.grass) {
                    map.set(setEntityTypeInVoxel(terrain, ENTITY_TYPES.stone), pos);
                }
            } else if (shouldPlaceTree) {
                if (terrainType === TERRAIN_TYPES.soil || terrainType === TERRAIN_TYPES.grass) {
                    map.set(setDaysElapsedInVoxel(setEntityTypeInVoxel(terrain, ENTITY_TYPES.tree), 13), pos);
                }
            }
        }
    }
}

/**
 * 隕鉄を 2x2 タイル占有で配置する。
 * 配置条件: 4タイル全てが grass、同じ高さ、エンティティなし。
 * 密度: 1タイルあたり 0.04% の試行確率（400x400 マップで試行 ~64 回、成立は約 15〜30 個）。
 */
function placeMeteoricIron(seed: string, map: VoxelMap): void {
    const rng = alea(`${seed}meteoric_iron`);
    const DENSITY = 0.0004;

    for (let z = 0; z < map.depth - 1; z++) {
        for (let x = 0; x < map.width - 1; x++) {
            if (rng() >= DENSITY) continue;
            if (!canPlaceMeteoricIron(map, x, z)) continue;

            for (let dz = 0; dz < 2; dz++) {
                for (let dx = 0; dx < 2; dx++) {
                    const pos = map.getSurfacePosition({ x: x + dx, y: 0, z: z + dz });
                    let v = map.get(pos);
                    const entity = dx === 0 && dz === 0 ? ENTITY_TYPES.meteoric_iron : ENTITY_TYPES.facility_part;
                    v = placeEntity(v, entity);
                    if (dx !== 0 || dz !== 0) {
                        v = setDisplacementXInVoxel(v, dx);
                        v = setDisplacementZInVoxel(v, dz);
                    } 
                    map.set(v, pos);
                }
            }
        }
    }
}

function canPlaceMeteoricIron(map: VoxelMap, x: number, z: number): boolean {
    let anchorY = -1;
    for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
            const pos = map.getSurfacePosition({ x: x + dx, y: 0, z: z + dz });
            const v = map.get(pos);
            if (getTerrainTypeFromVoxel(v) !== TERRAIN_TYPES.grass) return false;
            if (getEntityTypeFromVoxel(v) !== ENTITY_TYPES.none) return false;
            if (anchorY === -1) anchorY = pos.y;
            else if (pos.y !== anchorY) return false;
        }
    }
    return true;
}
