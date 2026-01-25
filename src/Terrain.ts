import alea from "alea";
import { createNoise2D } from "simplex-noise";
import { VoxelMap } from "./VoxelMap";
import type { Pos2D, Pos3D } from "./VoxelMap";

export type CellType = "water" | "soil" | "grass" | "rock" | "air";
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

export type Cell = {
    type: CellType;
    pos: Pos3D;
};



export function generateTerrain(map: VoxelMap<Cell>): void {
    const noise2D = createNoise2D(alea("rand"));
    const scale = 0.02; // スケールを小さくすると大きな地形に

    for (let z = 0; z < map.depth; z++) {
        for (let x = 0; x < map.width; x++) {
            const noiseValue = noise2D(x * scale, z * scale);
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
