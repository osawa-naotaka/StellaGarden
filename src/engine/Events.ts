/**
 * 後方互換のための re-export。
 * GameEventMap の正規定義は src/_boundary/events.ts に移動済み。
 * 既存の `import { GameEventMap } from "../engine/Events"` はそのまま動作する。
 */
export type { GameEventMap } from "../_boundary/events";
