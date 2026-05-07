import { PIXEL_PER_TILE, TILE_PER_CHUNK } from "../../_boundary/constants";
import type { Size2D } from "../../lib/VoxelMap";

/** 画面サイズとズームレベルから必要なチャンク数を計算する。 */
export function calcChunkPerViewport(screenW: number, screenH: number, zoomLevel: number): Size2D {
    const tilesW = screenW / (PIXEL_PER_TILE * zoomLevel);
    const tilesH = screenH / (PIXEL_PER_TILE * zoomLevel);
    return {
        w: Math.ceil(tilesW / TILE_PER_CHUNK) + 2,
        h: Math.ceil(tilesH / TILE_PER_CHUNK) + 2,
    };
}

/** 画面サイズとズームレベルから可視タイル数を計算する。 */
export function calcTilePerViewport(screenW: number, screenH: number, zoomLevel: number): Size2D {
    return {
        w: screenW / (PIXEL_PER_TILE * zoomLevel),
        h: screenH / (PIXEL_PER_TILE * zoomLevel),
    };
}
