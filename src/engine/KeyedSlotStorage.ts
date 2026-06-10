import type { IEventBroker, ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";

/**
 * 座標ベースの施設ストレージ群（Chest/Forge/Workbench 等）に共通する骨格を提供する抽象基底クラス。
 *
 * 派生クラスは以下の3つの protected 抽象メソッドだけ実装すれば、create/remove/isEmpty/getSlots/
 * toSaveData/loadSaveData が自動的に得られる。
 *  - createDefaultSlots(): 新規 create 時のスロット初期値
 *  - isSlotsEmpty(slots): 全スロットが空かどうか
 *  - cloneSlots(slots): セーブ用ディープコピー
 *
 * 日次処理が必要な施設は onDailyTick(voxelMap) を override する。デフォルトは no-op。
 */
export interface KeyedSlotSaveEntry<TSlots> {
    key: string;
    slots: TSlots;
}

export abstract class KeyedSlotStorage<TSlots> {
    private storage = new Map<string, TSlots>();

    protected key(pos: Pos2D): string {
        return `${pos.x},${pos.z}`;
    }

    protected posFromKey(key: string): Pos2D {
        const [x, z] = key.split(",").map(Number);
        return { x, z };
    }

    protected abstract createDefaultSlots(): TSlots;
    protected abstract isSlotsEmpty(slots: TSlots): boolean;
    protected abstract cloneSlots(slots: TSlots): TSlots;
    /** スロットの中身を ItemStack の配列として返す（撤去時の中身回収用）。空スロットは含めない。 */
    protected abstract toItemStacks(slots: TSlots): ItemStack[];

    /** 指定座標にストレージを作成する（既に存在する場合は何もしない）。 */
    create(pos: Pos2D): void {
        const k = this.key(pos);
        if (!this.storage.has(k)) {
            this.storage.set(k, this.createDefaultSlots());
        }
    }

    /** 指定座標のストレージを削除する。 */
    remove(pos: Pos2D): void {
        this.storage.delete(this.key(pos));
    }

    /** 指定座標のストレージが空かどうかを返す。存在しない場合は true。 */
    isEmpty(pos: Pos2D): boolean {
        const slots = this.storage.get(this.key(pos));
        if (!slots) return true;
        return this.isSlotsEmpty(slots);
    }

    /** 指定座標のスロット群を返す。存在しない場合は undefined。内部参照を直接返すため、書き換えは派生クラスの set 系メソッド経由で行うこと。 */
    getSlots(pos: Pos2D): TSlots | undefined {
        return this.storage.get(this.key(pos));
    }

    /** 生成済みストレージの全座標を返す（全施設を走査する処理用。例: warp_gate の日次出荷）。 */
    getPositions(): Pos2D[] {
        return Array.from(this.storage.keys(), (key) => this.posFromKey(key));
    }

    /**
     * 指定座標のスロット中身を ItemStack の配列として返す（施設撤去時の中身回収用）。
     * 該当ストレージが無い・スロットが空の場合は空配列を返す。
     * このメソッドはコピーを返すため、呼び出し側で安全に保持できる。
     */
    collectAllStacks(pos: Pos2D): ItemStack[] {
        const slots = this.storage.get(this.key(pos));
        if (!slots) return [];
        return this.toItemStacks(slots);
    }

    /** 全エントリをシリアライズ可能な形式で返す（セーブ用）。 */
    toSaveData(): Array<KeyedSlotSaveEntry<TSlots>> {
        const result: Array<KeyedSlotSaveEntry<TSlots>> = [];
        for (const [key, slots] of this.storage) {
            result.push({ key, slots: this.cloneSlots(slots) });
        }
        return result;
    }

    /** セーブデータから内部状態を復元する（ロード用）。 */
    loadSaveData(data: Array<KeyedSlotSaveEntry<TSlots>>): void {
        this.storage.clear();
        for (const { key, slots } of data) {
            this.storage.set(key, this.cloneSlots(slots));
        }
    }

    /** day_changed イベントで呼ばれる日次処理。デフォルトは no-op。
     *  eventBroker は処理結果をミッションシステム等へ通知したい施設（例: AutoProcessingStorage）向けの任意引数。 */
    onDailyTick(_voxelMap: IVoxelWriter, _eventBroker?: IEventBroker): void {}

    /** 派生クラスから内部 Map のエントリを走査するための protected ヘルパー。 */
    protected entries(): IterableIterator<[string, TSlots]> {
        return this.storage.entries();
    }

    /** 派生クラスから内部 Map の生スロットを取得するための protected ヘルパー。 */
    protected getRaw(pos: Pos2D): TSlots | undefined {
        return this.storage.get(this.key(pos));
    }
}
