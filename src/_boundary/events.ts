import type { Pos2D, Pos3D } from "../lib/VoxelMap";

/**
 * ゲーム内の全イベント型定義。全モジュールの唯一のイベント型定義ソース。
 *
 * カテゴリ:
 *   - UI イベント: view/ や App.tsx が発行・購読する
 *   - input → engine: InputHandler が発行、engine が購読
 *   - engine 発行: engine が状態変化時に発行するが現フェーズでは購読者なし（将来の最適化用）
 *   - engine 内部: engine 内の複数システム間で使うイベント
 */
export type GameEventMap = {
    // ─── UI イベント ──────────────────────────────────────────────────────────
    /** ツールバースロット選択 */
    select_slot: { slotIndex: number };
    /** インベントリ開閉トグル（E キー）。view/ が subscribe する唯一の UI イベント。 */
    toggle_inventory: Record<string, never>;
    /** 作業台を右クリックしてクラフトUIを開く。
     *  発行: InteractionSystem（作業台エンティティ検出時）。購読: App.tsx → InventoryView.show("craft")。 */
    open_craft_ui: { pos: Pos2D; workbenchPos: Pos2D };
    /** チェストを右クリックしてチェストUIを開く。 */
    open_chest_ui: { pos: Pos2D };
    /** warp gate を右クリックして地球出荷UIを開く。 */
    open_warp_gate_ui: { pos: Pos2D };
    /** 炉を左クリックして炉UIを開く。
     *  発行: Forge.ts の onOpenFacilityUI（forge / forge_burning の両方）。購読: UIState → ForgeView.show(pos)。 */
    open_forge_ui: { pos: Pos2D };
    /** 手動処理施設（threshing_machine / screw_presses / scutching_board / spinning_wheel / loom / anvil）の UI を開く。
     *  発行: 各エンティティの onOpenFacilityUI（右クリック）。購読: UIState → ManualProcessingPanel。 */
    open_processing_manual_ui: { pos: Pos2D };
    /** 日次処理施設（compost_bin / soaking_basket / bonfire / kiln）の UI を開く。
     *  発行: 各エンティティの onOpenFacilityUI（右クリック）。購読: UIState → DailyProcessingPanel。 */
    open_processing_daily_ui: { pos: Pos2D };
    /** 自動処理施設（auto_thresher 等。シャフト動力で day_changed 時に一括処理）の UI を開く。
     *  発行: 各エンティティの onOpenFacilityUI（右クリック）。購読: UIState → AutoProcessingPanel。 */
    open_processing_auto_ui: { pos: Pos2D };
    /** 台車を右クリックして台車UIを開く。
     *  発行: InteractionSystem（cartStorage.findAt がヒットした時、施設パスより先に発行）。
     *  購読: UIState → CartPanel。台車は voxel 外管理のため pos ではなく cartId で特定する。 */
    open_cart_ui: { cartId: number };

    // ─── input → engine（Phase 3 以降で使用） ───────────────────────────────
    /** プレイヤー移動要求。移動量が 0 でない場合のみ発行すること。
     *  dx, dz は正規化済みの方向ベクトル、deltaMS はフレーム時間(ms)。
     *  engine サブスクライバーは moveBy(dx, dz, deltaMS) を呼んで座標を更新する。 */
    player_move: { dx: number; dz: number; deltaMS: number };
    /** ワールドへのインタラクション（左クリック）— ツール使用 */
    interact_world: { pos: Pos2D };
    /** 右クリック — 施設UIの起動 */
    open_facility_ui: { pos: Pos2D };
    /** ズーム変更 */
    zoom_change: { delta: number };

    // ─── engine 発行（Phase 4 以降、将来の最適化用。現フェーズでは購読者なし） ────
    // view/ は tick() で毎フレーム完全描画するため、現時点でこれらを購読しない。
    // 将来、チャンクキャッシュ無効化・差分 UI 更新などの最適化が必要になった時点で
    // view/ 側が subscribe を追加する。
    /** 地形ボクセル変更通知（将来: TopView チャンクキャッシュ無効化に使う） */
    terrain_changed: { pos: Pos3D; voxel: bigint };
    /** インベントリスロット変更通知（将来: UI 差分更新に使う） */
    inventory_changed: {
        slotIndex: number;
        isToolbar: boolean;
        stack: { itemId: string; count: number } | null;
    };
    /** プレイヤー位置・ズーム変更通知 */
    player_position_changed: { posInWorld: Pos2D; zoomLevel: number };

    // ─── engine 発行: ゲーム内時間 ──────────────────────────────────────────
    /** ゲーム内の1日が切り替わった（朝5時相当）。
     *  発行: engine/GameTime。購読: App.tsx → CropSystem.advanceDayAllCrops() を呼ぶ。 */
    day_changed: Record<string, never>;

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
    /** ステーションがアイテムを搬送した（フォークアニメーション駆動用）。
     *  発行: engine/StationSystem（カート通過時に実際にアイテムが移動したときのみ）。
     *  購読: view/StationForkView。実際の搬送は即時に完了しており、これは描画演出専用のイベント。
     *  stationPos はステーション本体タイル座標、restSide はフォークの休止辺（向き）。
     *  フォークは restSide のタイル → その逆側のタイルへ平行移動し、アイテムを運ぶ演出を行う。
     *  itemId は浮遊アイコンの種類（搬送した代表アイテム）。 */
    station_fired: { stationPos: Pos2D; restSide: "up" | "down" | "left" | "right"; itemId: string };

    // ─── ミッションシステム関連 ──────────────────────────────────────────────
    // ミッション進捗判定（engine/MissionSystem）が購読する。
    /** エンティティが配置された（warp gate / workbench / 各種施設）。
     *  発行: 配置処理を行う engine 側システム。
     *  購読: MissionSystem。 */
    entity_placed: { pos: Pos2D; entityType: string };
    /** 朝5時の出荷処理が行われた。
     *  発行: useGameEngine の day_changed ハンドラ（reputationSystem.processShipment の後）。
     *  購読: MissionSystem。items は { itemId: string -> count: number } の連想配列。 */
    item_shipped: { items: ReadonlyMap<string, number> };
    /** Tier アンロック達成。累積出荷量が閾値を初めて超えた瞬間に発行される。
     *  発行: ReputationSystem.processShipment（出荷前と後の累積を比較して閾値を跨いだ tier）。
     *  購読: MissionSystem。itemId はアンロックされた Tier の itemId（例: "soybeans" = Tier 2 解放）。
     *  Tier 3a/3b、Tier 6a/6b のような並行アンロックでは複数の tier_unlocked が連続して発行される。 */
    tier_unlocked: { itemId: string };

    // ─── ADV 会話システム関連 ────────────────────────────────────────────────
    // doc/25_MISSION_SYSTEM.md §3.2 の ADV 型会話ウィンドウを駆動するイベント。
    /** ADV 型会話の表示要求。メインミッション開始/完了時などに発行される。
     *  発行: MissionSystem（メインミッション完了 → 次メイン開始の流れ）。
     *  購読: DialogView（モーダル表示開始、uiState.setTimeSpeed("paused") を呼ぶ）。
     *  scriptId はミッション ID + サフィックス（例: "M-01:opening", "M-01:completion"）。
     *  lines は表示するセリフの配列（各要素が 1 クリック分のセリフ）。
     *  speakerName は会話枠に表示する話者名。立ち絵差分は将来拡張時に追加する。 */
    dialog_requested: { scriptId: string; speakerName: string; lines: ReadonlyArray<string> };
    /** ADV 型会話の表示終了通知。最終セリフをクリックして閉じられたタイミングで発行される。
     *  発行: DialogView。
     *  購読: MissionSystem（完了会話の終了を検知して次ミッション開始の dialog_requested を連続発行する場合に使う）。 */
    dialog_finished: { scriptId: string };
};
