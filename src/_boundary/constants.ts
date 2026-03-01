/**
 * 複数モジュールで共有する定数。
 * model/GameState.ts のローカル定数を一元管理する。
 */

/**
 * タイル 1 枚のピクセルサイズ（スプライトのサイズと一致させること）。
 * model/GameState.ts の PIXEL_PER_TILE と同じ値。
 */
export const PIXEL_PER_TILE = 16;

/**
 * チャンク 1 枚のタイル数（1辺）。
 * model/GameState.ts の TILE_PER_CHUNK と同じ値。
 */
export const TILE_PER_CHUNK = 16;
