// simplex-noise などのライブラリを使用

import alea from "alea";
import { createNoise2D } from "simplex-noise";

export function generateTerrain(width: number, height: number) {
    const noise2D = createNoise2D(alea("seed"));
    const terrain: number[][] = [];
    const scale = 0.1; // スケールを小さくすると大きな地形に

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
