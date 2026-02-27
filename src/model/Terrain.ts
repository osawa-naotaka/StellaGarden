import alea from "alea";
import { createNoise2D } from "simplex-noise";
import type { Pos3D, VoxelMap } from "../lib/VoxelMap";

export const TERRAIN_TYPES = {
    empty: 0,
    water: 1,
    grass: 2,
    soil: 3,
    wetSoil: 4,
};

export const ENTITY_TYPES = {
    none: 0,
    tree: 1,
};

export function getTerrainTypeFromVoxel(voxel: number): number {
    return voxel & 0x000000ff;
}

export function getEntityTypeFromVoxel(voxel: number): number {
    return (voxel >> 8) & 0x000000ff;
}

function calcId5FromHights(hights: number[]): number {
    const idArr = [0, hights[1], 0, hights[3], hights[4], hights[5], 0, hights[7], 0];
    return idArr.reduce((prev, cur) => (prev << 2) | cur, 0);
}

function calcId5FromPos3D(pos: Pos3D[]): number {
    const idArr = [0, pos[1].y, 0, pos[3].y, pos[4].y, pos[5].y, 0, pos[7].y, 0];
    return idArr.reduce((prev, cur) => (prev << 2) | cur, 0);
}

function calcHightsFromId(id5: number): number[] {
    const hights: number[] = [];
    for (let i = 0; i < 9; i++) {
        hights.unshift(id5 & 0x00000003);
        id5 >>= 2;
    }
    return hights;
}

function calcId9FromHights(hights: number[]): number {
    return hights.reduce((prev, cur) => (prev << 2) | cur, 0);
}

function calcId9FromPos3D(pos: Pos3D[]): number {
    return pos.reduce((prev, cur) => (prev << 2) | cur.y, 0);
}

export function grassSpritesName(pos: Pos3D[], centerHight: number): string[] {
    const hightId5 = calcId5FromPos3D(pos);
    const hightId9 = calcId9FromPos3D(pos);
    switch (hightId9) {
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_5"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_6"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_9"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_10"];
        case calcId9FromHights([1, 2, 2, 2, 2, 2, 2, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_5"];
        case calcId9FromHights([2, 2, 1, 2, 2, 2, 2, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_6"];
        case calcId9FromHights([2, 2, 2, 2, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_9"];
        case calcId9FromHights([2, 2, 2, 2, 2, 2, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_10"];
        default:
            break;
    }

    switch (hightId5) {
        case calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_0"];
        case calcId5FromHights([0, 0, 0, 1, 1, 1, 1, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_2"];
        case calcId5FromHights([0, 0, 0, 1, 1, 0, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_3"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_4"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_11"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_12"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_13"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_15"];

        case calcId5FromHights([1, 1, 1, 1, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_0"];
        case calcId5FromHights([1, 1, 1, 2, 2, 2, 2, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_2"];
        case calcId5FromHights([1, 1, 1, 2, 2, 1, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_3"];
        case calcId5FromHights([1, 2, 2, 1, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_4"];
        case calcId5FromHights([2, 2, 2, 2, 2, 2, 2, 2, 2]):
            return ["grass_hill_dark_0_5_9"];
        case calcId5FromHights([2, 2, 1, 2, 2, 1, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_11"];
        case calcId5FromHights([1, 2, 2, 1, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_12"];
        case calcId5FromHights([2, 2, 2, 2, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_13"];
        case calcId5FromHights([2, 2, 1, 2, 2, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_15"];
        default:
            if (centerHight === 1) {
                return ["grass_water_normal_0_5_9"];
            } else if (centerHight === 2) {
                return ["grass_water_dark_0_5_9"];
            } else if (centerHight === 3) {
                return ["grass_water_dark_0_5_9"];
            } else {
                throw new Error(`Unknown hightId: ${calcHightsFromId(hightId5)}`);
            }
    }
}

export function grassWaterSpriteName1(hights: number): string {
    switch (hights) {
        case [0, 0, 0, 0, 1, 0, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_0_0";
        case [0, 1, 0, 0, 1, 0, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_1_0";
        case [0, 1, 0, 0, 1, 0, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_1_1";
        case [0, 0, 0, 0, 1, 0, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_1_2";
        case [0, 0, 0, 0, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_2_0";
        case [0, 0, 0, 1, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_2_1";
        case [0, 0, 0, 1, 1, 0, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_2_2";
        case [0, 0, 0, 0, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_0";
        case [0, 0, 0, 1, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_1";
        case [0, 0, 0, 1, 1, 0, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_2";
        case [0, 1, 0, 0, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_3";
        case [0, 1, 0, 1, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_4";
        case [0, 1, 0, 1, 1, 0, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_5";
        case [0, 1, 0, 0, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_6";
        case [0, 1, 0, 1, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_7";
        case [0, 1, 0, 1, 1, 0, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_3_8";
        case [1, 1, 0, 1, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_0";
        case [0, 0, 0, 1, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_1";
        case [0, 0, 0, 1, 1, 1, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_2";
        case [0, 1, 1, 1, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_3";
        case [0, 1, 0, 0, 1, 1, 0, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_4";
        case [0, 1, 1, 1, 1, 1, 1, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_5";
        case [1, 1, 0, 1, 1, 1, 1, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_6";
        case [0, 1, 0, 1, 1, 0, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_7";
        case [0, 1, 1, 0, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_8";
        case [1, 1, 1, 1, 1, 1, 0, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_9";
        case [1, 1, 1, 1, 1, 1, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_10";
        case [1, 1, 0, 1, 1, 0, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_11";
        case [0, 1, 0, 1, 1, 1, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_12";
        case [0, 1, 1, 1, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_13";
        case [1, 1, 0, 1, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_14";
        case [0, 1, 0, 1, 1, 1, 0, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_4_15";
        case [0, 0, 0, 0, 1, 1, 0, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_0";
        case [0, 1, 0, 1, 1, 1, 1, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_1";
        case [0, 0, 0, 1, 1, 1, 1, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_2";
        case [0, 0, 0, 1, 1, 0, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_3";
        case [0, 1, 1, 0, 1, 1, 0, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_4";
        case [0, 1, 1, 1, 1, 1, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_5";
        case [1, 1, 0, 1, 1, 1, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_7";
        case [0, 1, 1, 1, 1, 1, 0, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_8";
        case [1, 1, 1, 1, 1, 1, 1, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_9";
        case [1, 1, 0, 1, 1, 1, 0, 1, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_10";
        case [1, 1, 0, 1, 1, 0, 1, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_11";
        case [0, 1, 1, 0, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 1, 0, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [0, 1, 1, 0, 1, 1, 0, 0, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 1, 0, 1, 1, 0, 0, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_12";
        case [1, 1, 1, 1, 1, 1, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 1, 1, 1, 1, 1, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 1, 1, 1, 1, 0, 0, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 1, 1, 1, 1, 1, 0, 1].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_13";
        case [1, 1, 1, 1, 1, 1, 0, 1, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_14";
        case [1, 1, 0, 1, 1, 0, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 0, 1, 1, 0, 1, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 1, 1, 1, 0, 0, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
        case [1, 1, 1, 1, 1, 0, 1, 0, 0].reduce((prev, cur) => (prev << 2) | cur, 0):
            return "grass_water_normal_0_5_15";
        default:
            return "grass_water_normal_0_5_9";
    }
}

export function getTerrainSpriteNamesFromVoxel(voxel: number[], pos: Pos3D[]): string[] {
    const type = getTerrainTypeFromVoxel(voxel[4]);
    switch (type) {
        case TERRAIN_TYPES.water:
            return ["water_grass_normal_0_5_9"];
        case TERRAIN_TYPES.soil:
            switch (pos[4].y) {
                case 1:
                    return ["ground_normal_5"];
                case 2:
                    return ["ground_darker_5"];
                case 3:
                    return ["ground_darkest_5"];
                default:
                    throw new Error(`Invalid y position for soil: ${pos[4].x}, ${pos[4].y}, ${pos[4].z}`);
            }
        case TERRAIN_TYPES.wetSoil:
            return ["soil_wet_0_5_9"];
        case TERRAIN_TYPES.grass:
            return grassSpritesName(pos, pos[4].y);
        default:
            throw new Error(`Unknown voxel type: ${type}`);
    }
}

export function getEntitySpriteNameFromVoxel(voxel: number): string | null {
    const type = getEntityTypeFromVoxel(voxel);
    switch (type) {
        case ENTITY_TYPES.none:
            return null;
        case ENTITY_TYPES.tree:
            return "birch_tree_sapling";
        default:
            throw new Error(`Unknown voxel type: ${type}`);
    }
}

export function generateTerrain(map: VoxelMap): void {
    const terrainNoise = createNoise2D(alea("terrain"));
    const scale = 0.01; // スケールを小さくすると大きな地形に

    // 地形生成
    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const noiseValue = terrainNoise(x * scale, z * scale);
            const h = Math.min(map.height - 1, Math.floor((noiseValue + 1) * 0.5 * map.height));
            if (h < map.horizonHeight) {
                for (let y = 0; y < h; y++) {
                    map.set(TERRAIN_TYPES.soil, { x, y, z }); // soil
                }
                for (let y = h; y < map.horizonHeight; y++) {
                    map.set(TERRAIN_TYPES.water, { x, y, z }); // water
                }
            } else {
                for (let y = 0; y < h; y++) {
                    map.set(TERRAIN_TYPES.grass, { x, y, z }); // grass
                }
                map.set(TERRAIN_TYPES.grass, { x, y: h, z }); // grass
            }
        }
    }

    // 樹木生成
    const forestNoise = createNoise2D(alea("forest"));
    const treeNoise = createNoise2D(alea("tree"));
    const forestScale = 0.025; // 森のバイオーム（低周波）
    const treeScale = 0.15; // 個別の木の配置（高周波）

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
                const terrain = map.get(pos);
                // grass または soil の上にのみ配置
                if (terrain === TERRAIN_TYPES.soil || terrain === TERRAIN_TYPES.grass) {
                    // 表面セルと同じ位置に樹木を配置
                    const newTerrain = terrain | 0x00000100;
                    map.set(newTerrain, pos);
                }
            }
        }
    }
}
