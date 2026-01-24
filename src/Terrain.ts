import alea from "alea";
import { createNoise2D } from "simplex-noise";

export function generateTerrain(width: number, height: number) {
    const noise2D = createNoise2D(alea("rand"));
    const terrain: number[][] = [];
    const scale = 0.04; // スケールを小さくすると大きな地形に

    for (let y = 0; y < height; y++) {
        terrain[y] = [];
        for (let x = 0; x < width; x++) {
            // -1から1の値を-3から3にマッピング
            const noiseValue = noise2D(x * scale, y * scale);
            terrain[y][x] = Math.floor(noiseValue * 3);
        }
    }

    return terrain;
}

export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export function zigzagTerrain(terrain: number[][]): Pos3D[] {
    const zigzagged: Pos3D[] = [];
    const height = terrain.length;
    const width = terrain[0].length;

    for (let summed = 0; summed <= width - 1; summed++) {
        for (let x = 0; x <= summed; x++) {
            const y = summed - x;
            zigzagged.push({ x: x - y, y: x + y, z: terrain[y][x] });
        }
    }

    for (let summed = width; summed <= width + height - 2; summed++) {
        for (let x = summed - (height - 1); x <= width - 1; x++) {
            const y = summed - x;
            zigzagged.push({ x: x - y, y: x + y, z: terrain[y][x] });
        }
    }

    return zigzagged;
}
