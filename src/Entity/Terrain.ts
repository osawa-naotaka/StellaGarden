import alea from "alea";
import { createNoise2D } from "simplex-noise";
import type { Pos3D, VoxelMap } from "../lib/VoxelMap";


export function getSpriteNameFromVoxel(voxel: number, pos: Pos3D): string {
    const type = voxel & 0x000000ff;
    switch (type) {
        case 1: // water
            return "water";
        case 2: // soil
            switch (pos.y) {
                case 1:
                    return "ground_normal_5";
                case 2:
                    return "ground_darker_5";
                case 3:
                    return "ground_darkest_5";
                default:
                    throw new Error(`Invalid y position for soil: ${pos.y}`);
            }
        case 3: // grass
            switch (pos.y) {
                case 1:
                    return "grass_normal_5";
                case 2:
                    return "grass_darker_5";
                case 3:
                    return "grass_darkest_5";
                default:
                    throw new Error(`Invalid y position for grass: ${pos.x}, ${pos.y}, ${pos.z}`);
            }
        case 0x00000100: // tree flag
            return "birch_tree_sapling";
        default:
            throw new Error(`Unknown voxel type: ${type}`);
    }
}

export function generateTerrain(map: VoxelMap): void {
    const terrainNoise = createNoise2D(alea("terrain"));
    const scale = 0.02; // スケールを小さくすると大きな地形に

    // 地形生成
    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const noiseValue = terrainNoise(x * scale, z * scale);
            const h = Math.min(map.height - 1, Math.floor((noiseValue + 1) * 0.5 * map.height));
            if (h < map.horizonHeight) {
                for (let y = 0; y < h; y++) {
                    map.set(2, { x, y, z }); // soil
                }
                for (let y = h; y < map.horizonHeight; y++) {
                    map.set(1, { x, y, z }); // water
                }
            } else {
                for (let y = 0; y < h; y++) {
                    map.set(2, { x, y, z }); // soil
                }
                map.set(3, { x, y: h, z }); // grass
            }
        }
    }

    // 樹木生成
    const forestNoise = createNoise2D(alea("forest"));
    const treeNoise = createNoise2D(alea("tree"));
    const forestScale = 0.05; // 森のバイオーム（低周波）
    const treeScale = 0.3; // 個別の木の配置（高周波）

    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const forestValue = forestNoise(x * forestScale, z * forestScale);
            const treeValue = treeNoise(x * treeScale, z * treeScale);

            // 森のバイオーム判定
            const isForestBiome = forestValue > 0.2;

            // 木を配置する判定
            const shouldPlaceTree = isForestBiome && treeValue > 0.3;

            if (shouldPlaceTree) {
                // 表面セルを取得
                const pos = map.getSurfacePosition({ x, y: 0, z });
                if(pos === null) throw new Error(`Failed to get surface position for tree at (${x}, ${z})`);

                const terrain = map.get(pos);
                if (terrain === null) throw new Error(`Failed to get terrain for tree at (${x}, ${z})`);

                // grass または soil の上にのみ配置
                if (terrain && (terrain === 2 || terrain === 3)) {
                    // 表面セルと同じ位置に樹木を配置
                    const newTerrain = terrain | 0x00000100;
                    map.set(newTerrain, pos);
                }
            }
        }
    }
}
