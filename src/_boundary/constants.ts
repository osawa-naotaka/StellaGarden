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

/**
 * 素掘り水路における、waterSource からの最大水拡散距離（BFS ホップ数）。
 * この距離を超えたタイルには water を配置しない（地面に染み込む挙動）。
 * 将来の石組み導水路では Infinity を渡すことで距離制限なしにできる。
 * doc/16_IRRIGATION.md §2.3 参照。
 */
export const MAX_WATER_SPREAD_DISTANCE = 8;
