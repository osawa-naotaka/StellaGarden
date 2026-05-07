import type { ItemStack, Pos2D } from "../_boundary/interfaces";
import { KeyedSlotStorage } from "./KeyedSlotStorage";

const CHEST_SLOT_COUNT = 64;

type ChestSlots = (ItemStack | null)[];

/** チェストの中身を座標ベースで管理するストレージ。 */
export class ChestStorage extends KeyedSlotStorage<ChestSlots> {
    protected createDefaultSlots(): ChestSlots {
        return new Array<ItemStack | null>(CHEST_SLOT_COUNT).fill(null);
    }

    protected isSlotsEmpty(slots: ChestSlots): boolean {
        return slots.every((s) => s === null);
    }

    protected cloneSlots(slots: ChestSlots): ChestSlots {
        return [...slots];
    }

    /** 指定座標のチェストの指定スロットを返す。 */
    getSlot(pos: Pos2D, index: number): ItemStack | null {
        const slots = this.getRaw(pos);
        return slots?.[index] ?? null;
    }

    /** 指定座標のチェストの指定スロットを設定する。 */
    setSlot(pos: Pos2D, index: number, stack: ItemStack | null): void {
        const slots = this.getRaw(pos);
        if (slots) {
            slots[index] = stack;
        }
    }
}
