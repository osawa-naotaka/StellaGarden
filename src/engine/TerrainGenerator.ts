import alea from "alea";
import { createNoise2D } from "simplex-noise";
import type { VoxelMap } from "../lib/VoxelMap";
import { ENTITY_TYPES, TERRAIN_TYPES } from "./TerrainDefs";

/** シンプレックスノイズで地形と樹木を生成し、VoxelMap に書き込む。 */
export function generateTerrain(map: VoxelMap): void {
    generateHeightmap(map);
    placeForestTrees(map);
}

function generateHeightmap(map: VoxelMap): void {
    const noise = createNoise2D(alea("terrain"));
    const scale = 0.01;

    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const noiseValue = noise(x * scale, z * scale);
            const h = Math.min(map.height - 1, Math.floor((noiseValue + 1) * 0.5 * map.height));

            if (h < map.horizonHeight) {
                for (let y = 0; y < h; y++) {
                    map.set(TERRAIN_TYPES.dirt, { x, y, z });
                }
                for (let y = h; y < map.horizonHeight; y++) {
                    map.set(TERRAIN_TYPES.water, { x, y, z });
                }
            } else {
                for (let y = 0; y < h; y++) {
                    map.set(TERRAIN_TYPES.dirt, { x, y, z });
                }
                map.set(TERRAIN_TYPES.grass, { x, y: h, z });
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
