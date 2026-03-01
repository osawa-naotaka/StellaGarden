import type { Pos2D, Pos3D } from "../lib/VoxelMap";

/**
 * ゲーム内の全イベント型定義。全モジュールの唯一のイベント型定義ソース。
 *
 * カテゴリ:
 *   - 既存イベント: 後方互換のために維持（将来フェーズで移行予定）
 *   - input → engine: InputHandler が発行、engine が購読（Phase 3 以降）
 *   - engine 発行: engine が状態変化時に発行するが現フェーズでは購読者なし（将来の最適化用）
 *   - engine 内部: engine 内の複数システム間で使うイベント
 */
export type GameEventMap = {
    // ─── 既存イベント（後方互換のため維持） ─────────────────────────────────
    /** @deprecated Phase 3 で interact_world に移行予定 */
    interact: { pos: Pos2D };
    /** ツールバースロット選択 */
    select_slot: { slotIndex: number };
    /** インベントリ開閉トグル（E キー）。view/ が subscribe する唯一の UI イベント。 */
    toggle_inventory: Record<string, never>;

    // ─── input → engine（Phase 3 以降で使用） ───────────────────────────────
    /** プレイヤー移動要求。移動量が 0 でない場合のみ発行すること。
     *  dx, dz は正規化済みの方向ベクトル、deltaMS はフレーム時間(ms)。
     *  engine サブスクライバーは moveBy(dx, dz, deltaMS) を呼んで座標を更新する。 */
    player_move: { dx: number; dz: number; deltaMS: number };
    /** ワールドへのインタラクション（右クリック）— interact の後継 */
    interact_world: { pos: Pos2D };
    /** ズーム変更 */
    zoom_change: { delta: number };

    // ─── engine 発行（Phase 4 以降、将来の最適化用。現フェーズでは購読者なし） ────
    // view/ は tick() で毎フレーム完全描画するため、現時点でこれらを購読しない。
    // 将来、チャンクキャッシュ無効化・差分 UI 更新などの最適化が必要になった時点で
    // view/ 側が subscribe を追加する。
    /** 地形ボクセル変更通知（将来: TopView チャンクキャッシュ無効化に使う） */
    terrain_changed: { pos: Pos3D; voxel: number };
    /** インベントリスロット変更通知（将来: UI 差分更新に使う） */
    inventory_changed: {
        slotIndex: number;
        isToolbar: boolean;
        stack: { itemId: string; count: number } | null;
    };
    /** プレイヤー位置・ズーム変更通知 */
    player_position_changed: { posInWorld: Pos2D; zoomLevel: number };

    // ─── engine 内部（ゲームロジック間の通知） ───────────────────────────────
    // engine 内の複数システム間で使う。view/ / input/ は原則として subscribe しない。
    /** 作物が植えられた */
    crop_planted: { pos: Pos2D; cropType: string };
    /** 作物に水やりされた */
    crop_watered: { pos: Pos2D };
    /** 作物が収穫された */
    crop_harvested: { pos: Pos2D; itemId: string; count: number };
    /** 木が伐採された */
    tree_felled: { pos: Pos2D };
};
