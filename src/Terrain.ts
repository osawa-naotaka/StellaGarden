import alea from "alea";
import { createNoise2D } from "simplex-noise";
import { VoxelMap } from "./VoxelMap";
import type { Pos2D, Pos3D } from "./VoxelMap";

export type TerrainType = "water" | "soil" | "grass" | "rock" | "air";
export type StaticEntityType = "tree" | "stone" | "bush";
export type DynamicEntityType = "player";
export type Direction = "left_up" | "right_up" | "left_down" | "right_down";
export type State = "Idle" | "walk" | "Dash";

export type DynamicEntity = {
    type: DynamicEntityType;
    pos: Pos3D;
    direction: Direction;
    state: State;
};

export type StaticEntity = {
    type: StaticEntityType;
    pos: Pos3D;
};

export type Entity = DynamicEntity | StaticEntity;

export type Terrain = {
    type: TerrainType;
    pos: Pos3D;
};

export type CellType = TerrainType | StaticEntityType | DynamicEntityType;
export type Cell = Terrain | StaticEntity | DynamicEntity;

export function getTerrainCell(cells: Cell[]): Cell | null {
    return cells.find(cell =>
        cell.type === "soil" || cell.type === "grass" || cell.type === "water"
    ) ?? null;
}



export function generateTerrain(map: VoxelMap<Cell>): void {
    const terrainNoise = createNoise2D(alea("rand"));
    const scale = 0.02; // スケールを小さくすると大きな地形に

    // 地形生成
    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const noiseValue = terrainNoise(x * scale, z * scale);
            const h = Math.floor((noiseValue + 1) * 0.5 * map.height);
            if (h < map.horizonHeight) {
                for (let y = 0; y < h; y++) {
                    map.set({ type: "soil", pos: { x, y, z } });
                }
                for (let y = h; y < map.horizonHeight; y++) {
                    map.set({ type: "water", pos: { x, y, z } });
                }
            } else {
                for (let y = 0; y < h - 1; y++) {
                    map.set({ type: "soil", pos: { x, y, z } });
                }
                map.set({ type: "grass", pos: { x, y: h - 1, z } });
            }
        }
    }

    // 樹木生成
    const forestNoise = createNoise2D(alea("forest"));
    const treeNoise = createNoise2D(alea("tree"));
    const forestScale = 0.05;  // 森のバイオーム（低周波）
    const treeScale = 0.3;     // 個別の木の配置（高周波）

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
                const surfaceCells = map.getSurfaceCell({ x, y: 0, z });
                const terrain = getTerrainCell(surfaceCells);

                // grass または soil の上にのみ配置
                if (terrain && (terrain.type === "grass" || terrain.type === "soil")) {
                    // 表面セルと同じ位置に樹木を配置
                    map.set({ type: "tree", pos: terrain.pos });
                }
            }
        }
    }
}

export type ZigzagPositionReturnValue = {
    pos: Pos3D;
    proj: Pos2D;
}[];

export function zigzagPosition(map: VoxelMap<Cell>): ZigzagPositionReturnValue {
    const posproj: ZigzagPositionReturnValue = [];
    // const pos: Pos3D[] = [];
    // const proj: Pos2D[] = [];

    for (let y = 0; y < map.height; y++) {
        for (let summed = 0; summed <= map.width - 1; summed++) {
            for (let x = 0; x <= summed; x++) {
                const z = summed - x;
                posproj.push({ pos : { x, y, z }, proj : { x: x - z, y: x + z } });
            }
        }

        for (let summed = map.width; summed <= map.width + map.depth - 2; summed++) {
            for (let x = summed - (map.depth - 1); x <= map.width - 1; x++) {
                const z = summed - x;
                posproj.push({ pos : { x, y, z }, proj : { x: x - z, y: x + z } });
            }
        }
    }

    return posproj;
}
