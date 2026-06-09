/**
 * モジュール間インターフェース定義。
 *
 * view/ と input/ はこのファイルから型を import すること。
 * engine/ や lib/ を直接 import してはならない。
 *
 * 依存方向: _boundary/ → lib/ → (なし)
 *           _boundary/ → engine/ItemDefs.ts → (なし)
 */

import type { ItemId } from "../engine/ItemDefs";
import type { EventBroker } from "../lib/Event";
import type { Pos2D, Pos3D, Size2D } from "../lib/VoxelMap";
import type { GameEventMap } from "./events";

// ─── プレイヤーの向き ──────────────────────────────────────────────────────────
/** プレイヤーキャラクターの8方向の向き。 */
export type Direction8 = "down" | "up" | "left" | "right" | "down_left" | "down_right" | "up_left" | "up_right";

// ─── ItemId の再エクスポート ──────────────────────────────────────────────────
// アイテム ID の正規定義は engine/ItemDefs.ts。サブエージェントはここから取得する。
export type { ItemId } from "../engine/ItemDefs";
// ─── 座標型の再エクスポート ──────────────────────────────────────────────────
// サブエージェントはここから import すればよく、lib/ を直接参照しなくてよい
export type { Pos2D, Pos3D } from "../lib/VoxelMap";

// ─── 境界を越えるデータ型（_boundary が正規定義） ─────────────────────────────
// view/ と engine/ の両方が使うシンプルなデータ型。
// engine/Inventory.ts からこちらへ移動済み。既存コードとの後方互換は
// engine/Inventory.ts 側で re-export して維持する。

/** インベントリスロットに格納されるアイテムスタック。 */
export type ItemStack = { itemId: ItemId; count: number };

/** スロットの参照先（ツールバーまたはインベントリグリッド）。 */
export type SlotArea = "toolbar" | "inventory";

/** スロット参照。getSlot / setSlot / swapSlots に渡す。 */
export type SlotRef = { area: SlotArea; index: number };

// ─── VoxelMap インターフェース ────────────────────────────────────────────────

/**
 * ボクセルマップの読み取りインターフェース。
 * view/ と engine/ がこれを通じて地形データを読む。
 * VoxelMap クラスはこのインターフェースを implements する。
 */
export interface IVoxelReader {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly horizonHeight: number;
    get(pos: Pos3D): bigint;
    getSurface(pos: Pos2D): bigint;
    getSurfacePosition(pos: Pos2D): Pos3D;
    /** 水タイルを無視して、最上層の地面（dirt/grass/soil 等）の位置を返す。 */
    getGroundSurfacePosition(pos: Pos2D): Pos3D;
}

/**
 * ボクセルマップの書き込みインターフェース。
 * engine/ のみが使う。view/ は IVoxelReader に留めること。
 */
export interface IVoxelWriter extends IVoxelReader {
    set(voxel: bigint, pos: Pos3D): void;
    remove(pos: Pos3D): void;
}

// ─── Inventory インターフェース ──────────────────────────────────────────────

/**
 * インベントリの読み取りインターフェース。
 * view/ が tick() で参照する。Inventory クラスはこのインターフェースを implements する。
 */
export interface IInventoryReader {
    readonly toolbarSlots: ReadonlyArray<ItemStack | null>;
    readonly inventorySlots: ReadonlyArray<ItemStack | null>;
    readonly selectedIndex: number;
    readonly selectedTool: ItemId | null;
}

/**
 * インベントリの書き込みインターフェース。
 * engine/ のみが使う。
 */
export interface IInventoryWriter extends IInventoryReader {
    addItems(items: ReadonlyArray<{ itemId: ItemId; count: number }>): boolean;
    selectSlot(index: number): void;
    getSlot(ref: SlotRef): ItemStack | null;
    setSlot(ref: SlotRef, stack: ItemStack | null): void;
    swapSlots(a: SlotRef, b: SlotRef): void;
    consumeSelectedItem(count: number): boolean;
    canConsumeSelectedItem(count: number): boolean;
}

// ─── PlayerState インターフェース ────────────────────────────────────────────

/**
 * プレイヤー状態の読み取りインターフェース。
 * view/ が tick() で参照する。PlayerState クラスはこのインターフェースを implements する。
 * 座標系は xz 平面（y は高さ方向で使わない）。
 */
export interface IPlayerStateReader {
    readonly posInWorld: Pos2D;
    readonly pointerPosInWorld: Pos2D;
    readonly zoomLevel: number;
    readonly worldSize: Size2D;
    readonly tilePerViewport: Size2D;
    readonly inventory: IInventoryReader;
    readonly facing: Direction8;
}

/**
 * プレイヤー状態の書き込みインターフェース。
 * engine/ のみが使う。
 */
export interface IPlayerStateWriter extends IPlayerStateReader {
    moveBy(dx: number, dz: number, deltaMS: number): void;
    adjustZoom(delta: number): void;
    setPointerPosInWorld(x: number, z: number): void;
    /** 指定ワールド座標に瞬時にワープする（水没救出など）。player_position_changed を発火する。 */
    teleportTo(pos: Pos2D): void;
}

// ─── GameTime インターフェース ────────────────────────────────────────────────

/**
 * ゲーム内時間の読み取りインターフェース。
 * view/ が tick() で参照する。GameTime クラスはこのインターフェースを implements する。
 */
export interface IGameTimeReader {
    /** 現在のゲーム内時刻を "HH:MM" 形式の文字列で返す（例: "05:00", "23:30"）。 */
    readonly currentTimeString: string;
    /** 経過した日数（ゲーム開始を0日目とする）。 */
    readonly dayCount: number;
    /**
     * 現在の時刻に基づいた世界の明るさ（0.45〜1.0）。
     * 昼（05:00〜19:00）= 1.0、夜（20:00〜04:00）= 0.45、
     * 薄暮（19:00〜20:00）と夜明け（04:00〜05:00）はその間を線形補間。
     */
    readonly worldBrightness: number;
}

// ─── CraftSystem インターフェース ────────────────────────────────────────────

/** クラフトの作成場所。hand = 素手、workbench = 作業台。 */
export type CraftStation = "hand" | "workbench";

/** レシピの素材1種。 */
export type RecipeIngredient = { readonly itemId: ItemId; readonly count: number };

/** 作業時に消費せず参照だけする利用ツール。 */
export type RecipeTool = { readonly itemId: ItemId };

/** クラフトレシピ定義。engine/RecipeDefs.ts で具体値を保持する。 */
export interface RecipeDef {
    readonly id: string;
    readonly station: CraftStation;
    readonly ingredients: readonly RecipeIngredient[];
    readonly requiredTool?: RecipeTool;
    readonly result: { readonly itemId: ItemId; readonly count: number };
}

/**
 * クラフトシステムの読み取りインターフェース。
 * view/ が tick() でレシピ一覧とクラフト可否を参照する。
 */
export interface ICraftSystemReader {
    /** 指定ステーションで利用可能なレシピ一覧を返す。
     *  hand → 素手レシピのみ、workbench → 全レシピ。 */
    getAvailableRecipes(station: CraftStation): readonly RecipeDef[];
    /** 現在セットされている利用ツールを返す。 */
    getToolSlot(): ItemStack | null;
    /** 指定レシピの素材と利用ツール条件が満たされているか判定する。 */
    canCraft(recipe: RecipeDef): boolean;
}

/**
 * クラフトシステムの書き込みインターフェース。
 * view/ がクラフト実行時に呼ぶ。
 */
export interface ICraftSystem extends ICraftSystemReader {
    /** 利用ツールスロットを更新する。null で空にする。 */
    setToolSlot(stack: ItemStack | null): void;
    /** レシピを実行する。素材をインベントリから消費し、成果物を追加する。
     *  成功時 true、素材不足またはインベントリ満杯時 false。 */
    craft(recipe: RecipeDef): boolean;
}

// ─── ReputationSystem / Tier インターフェース ────────────────────────────────

/**
 * Tier の識別子。アンロック進行の段階を表す。
 * 22_REPUTATION_SYSTEM.md の §3 アンロックチェーンと対応する。
 */
export type TierId =
    | "tier1"
    | "tier2"
    | "tier3a"
    | "tier3b"
    | "tier4"
    | "tier5"
    | "tier6a"
    | "tier6b"
    // 発酵軸（doc/26 §6.1）。大豆（tier2）から分岐する。麹は中間素材のため Tier 化しない
    | "tier_salt"
    | "tier_miso"
    | "tier_soy_sauce"
    | "tier_shochu"
    | "tier_vinegar";

/** Tier の表示状態。 */
export type TierStatus = "unlocked" | "in_progress" | "locked";

/**
 * Tier 定義（不変なメタデータ）。engine/TierDefs.ts で具体値を保持する。
 */
export interface TierDef {
    readonly id: TierId;
    /** UI に表示するラベル（例: "Tier 1"、"Tier 3a"）。 */
    readonly label: string;
    /** この Tier がアンロックする品目。 */
    readonly itemId: ItemId;
    /** アンロックした品目の1個あたりのスコア。 */
    readonly baseScore: number;
    /** UI 上の表示行（0 起点）。同じ displayRow を持つ Tier は横並びに表示される。 */
    readonly displayRow: number;
    /**
     * アンロック条件。null は「ゲーム開始時から解放済」を意味する（Tier 1）。
     * sourceItemId の累積出荷数が threshold 以上で解放される。
     */
    readonly unlock: { readonly sourceItemId: ItemId; readonly threshold: number } | null;
    /** 現スコープの最終ゴール（醤油＝発酵軸の価格ピナクル）を示すフラグ。袋詰め大豆は第一の集大成だが最終ゴール演出は醤油に移設（doc/25・doc/26）。 */
    readonly isGoal?: boolean;
}

/** Tier の現在の進行状況。view が tick で読む。 */
export interface TierProgress {
    readonly tier: TierDef;
    readonly status: TierStatus;
    /** unlock.sourceItemId の累積出荷数（unlock が null の場合は 0）。 */
    readonly cumulativeShipped: number;
    /** 解放閾値（unlock が null の場合は 0）。 */
    readonly threshold: number;
}

/**
 * 評価システムの読み取りインターフェース。
 * view/ が tick() で参照する。ReputationSystem クラスはこれを implements する。
 */
export interface IReputationSystemReader {
    /** 現在の累計評価値。 */
    getPoints(): number;
    /** 単一アイテムスタックの評価値（出荷プレビュー用）。 */
    calculateStackPoints(itemId: ItemId, count: number): number;
    /** 全 Tier の進行状況を displayRow 昇順で返す。並行 Tier は同じ displayRow を持つ。 */
    getAllTierProgress(): readonly TierProgress[];
}

// ─── Cart インターフェース（移動層エンティティ） ─────────────────────────────

/**
 * 台車（Cart）の読み取りインターフェース。
 * view が tick で参照する。Cart クラスはこれを implements する。
 *
 * 座標系: posInWorld はプレイヤーと同じ浮動小数の世界座標（xz 平面）。
 * facing は描画用に毎フレーム CartStorage が voxel から動的算出する。
 */
export interface ICartReader {
    readonly id: number;
    readonly posInWorld: Pos2D;
    readonly facing: Direction8;
    readonly inventorySlots: ReadonlyArray<ItemStack | null>;
    readonly attachmentSlot: ItemStack | null;
}

/**
 * 台車の書き込みインターフェース。
 * engine / UI（CartPanel）が使う。インベントリ操作のみ可能で、posInWorld / facing は
 * エンジン内部（CartStorage.tickAll）からのみ更新する。
 */
export interface ICartWriter extends ICartReader {
    /** インベントリスロットの内容を設定する。 */
    setInventorySlot(index: number, stack: ItemStack | null): void;
    /** インベントリ全体が空かどうか（撤去可否判定に使う）。 */
    isInventoryEmpty(): boolean;
}

/**
 * CartStorage の読み取りインターフェース。
 * view（CartView）と input（InteractionSystem の右クリック判定）が使う。
 */
export interface ICartStorageReader {
    /** 全カートの反復処理（描画用）。 */
    getAll(): Iterable<ICartReader>;
    /** ワールド座標 worldPos の半径 radius 以内にいるカートを返す。なければ null。 */
    findAt(worldPos: Pos2D, radius: number): ICartReader | null;
    /** ID 指定でカートを取得する。 */
    getById(id: number): ICartReader | undefined;
}

/**
 * CartStorage の書き込みインターフェース。
 * engine のみが使う。生成・撤去・毎フレーム移動更新を行う。
 */
export interface ICartStorageWriter extends ICartStorageReader {
    /** 指定位置に台車を新規生成する。ID は内部で採番。 */
    spawn(pos: Pos2D): ICartWriter;
    /** ID 指定で台車を撤去する。撤去に成功すれば true。 */
    remove(id: number): boolean;
    /** ID 指定で書き込み可能なカート参照を返す。 */
    getByIdWritable(id: number): ICartWriter | undefined;
    /** 全カートに対して移動ロジックを 1 フレーム分実行する。
     *  新タイルに踏み込んだ瞬間に CartActionSystem を呼ぶため、書き込み可能な voxelMap と
     *  eventBroker（収穫等の通知発行用）が必要。 */
    tickAll(voxelMap: IVoxelWriter, deltaMS: number, eventBroker: IEventBroker): void;
}

// ─── EventBroker インターフェース ────────────────────────────────────────────

/**
 * イベントバスのインターフェース。
 * 全モジュールがこれを通じてイベントを publish/subscribe する。
 * lib/Event.ts の EventBroker<GameEventMap> と同一。
 */
export type IEventBroker = EventBroker<GameEventMap>;
