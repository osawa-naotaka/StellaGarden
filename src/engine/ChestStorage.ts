import type { ItemStack, Pos2D } from "../_boundary/interfaces";

const CHEST_SLOT_COUNT = 64;

/** チェストの中身を座標ベースで管理するストレージ。 */
export class ChestStorage {
    private chests = new Map<string, (ItemStack | null)[]>();

    private key(pos: Pos2D): string {
        return `${pos.x},${pos.z}`;
    }

    /** 指定座標にチェストストレージを作成する（既に存在する場合は何もしない）。 */
    create(pos: Pos2D): void {
        const k = this.key(pos);
        if (!this.chests.has(k)) {
            this.chests.set(k, new Array<ItemStack | null>(CHEST_SLOT_COUNT).fill(null));
        }
    }

    /** 指定座標のチェストストレージを削除する。 */
    remove(pos: Pos2D): void {
        this.chests.delete(this.key(pos));
    }

    /** 指定座標のチェストが空かどうかを返す。存在しない場合は true。 */
    isEmpty(pos: Pos2D): boolean {
        const slots = this.chests.get(this.key(pos));
        if (!slots) return true;
        return slots.every((s) => s === null);
    }

    /** 指定座標のチェストの全スロットを返す。存在しない場合は undefined。 */
    getSlots(pos: Pos2D): readonly (ItemStack | null)[] | undefined {
        return this.chests.get(this.key(pos));
    }

    /** 指定座標のチェストの指定スロットを返す。 */
    getSlot(pos: Pos2D, index: number): ItemStack | null {
        const slots = this.chests.get(this.key(pos));
        return slots?.[index] ?? null;
    }

    /** 指定座標のチェストの指定スロットを設定する。 */
    setSlot(pos: Pos2D, index: number, stack: ItemStack | null): void {
        const slots = this.chests.get(this.key(pos));
        if (slots) {
            slots[index] = stack;
        }
    }
}
