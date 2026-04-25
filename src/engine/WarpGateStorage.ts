import type { ItemStack } from "../_boundary/interfaces";

const WARP_GATE_SLOT_COUNT = 64;

/** warp gate の地球側インベントリを管理するストレージ。 */
export class WarpGateStorage {
    private slots: (ItemStack | null)[] = new Array<ItemStack | null>(WARP_GATE_SLOT_COUNT).fill(null);

    /** 全スロットを読み取り専用で返す。 */
    getSlots(): readonly (ItemStack | null)[] {
        return this.slots;
    }

    /** 指定スロットの内容を返す。 */
    getSlot(index: number): ItemStack | null {
        return this.slots[index] ?? null;
    }

    /** 指定スロットの内容を設定する。 */
    setSlot(index: number, stack: ItemStack | null): void {
        this.slots[index] = stack;
    }

    /** 全スロットが空かどうかを返す。 */
    isEmpty(): boolean {
        return this.slots.every((slot) => slot === null);
    }

    /** 全スロットを空にする。 */
    clear(): void {
        this.slots.fill(null);
    }

    /** セーブ用にシリアライズ可能な形式で返す。 */
    toSaveData(): { slots: (ItemStack | null)[] } {
        return {
            slots: [...this.slots],
        };
    }

    /** セーブデータから復元する。 */
    loadSaveData(data: { slots: (ItemStack | null)[] }): void {
        this.slots = new Array<ItemStack | null>(WARP_GATE_SLOT_COUNT).fill(null);
        for (let i = 0; i < Math.min(WARP_GATE_SLOT_COUNT, data.slots.length); i++) {
            this.slots[i] = data.slots[i];
        }
    }
}
