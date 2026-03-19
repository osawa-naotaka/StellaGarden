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
    get(pos: Pos3D): number;
    getSurface(pos: Pos3D): number;
    getSurfacePosition(pos: Pos3D): Pos3D;
    /** 水タイルを無視して、最上層の地面（dirt/grass/soil 等）の位置を返す。 */
    getGroundSurfacePosition(pos: Pos3D): Pos3D;
}

/**
 * ボクセルマップの書き込みインターフェース。
 * engine/ のみが使う。view/ は IVoxelReader に留めること。
 */
export interface IVoxelWriter extends IVoxelReader {
    set(voxel: number, pos: Pos3D): void;
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
    addItem(itemId: ItemId, count: number): boolean;
    selectSlot(index: number): void;
    getSlot(ref: SlotRef): ItemStack | null;
    setSlot(ref: SlotRef, stack: ItemStack | null): void;
    swapSlots(a: SlotRef, b: SlotRef): void;
    consumeSelectedItem(count: number): boolean;
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
}

/**
 * プレイヤー状態の書き込みインターフェース。
 * engine/ のみが使う。
 */
export interface IPlayerStateWriter extends IPlayerStateReader {
    moveBy(dx: number, dz: number, deltaMS: number): void;
    adjustZoom(delta: number): void;
    setPointerPosInWorld(x: number, z: number): void;
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
}

// ─── EventBroker インターフェース ────────────────────────────────────────────

/**
 * イベントバスのインターフェース。
 * 全モジュールがこれを通じてイベントを publish/subscribe する。
 * lib/Event.ts の EventBroker<GameEventMap> と同一。
 */
export type IEventBroker = EventBroker<GameEventMap>;
