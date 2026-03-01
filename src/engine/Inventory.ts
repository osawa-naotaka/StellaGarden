import { ITEM_DEFS, type ItemId } from "./ItemDefs";
import type { IInventoryWriter, ItemStack, SlotRef } from "../_boundary/interfaces";

// 後方互換のための re-export。既存コードの import 先を変えなくてよい。
export type { ItemStack, SlotRef, SlotArea } from "../_boundary/interfaces";

const TOOLBAR_SLOT_COUNT = 9;
const INVENTORY_SLOT_COUNT = 64; // 8×8

const DEFAULT_TOOLBAR_ITEMS: readonly (ItemId | null)[] = ["watering_can", "pickaxe", "axe", "sickle", "shovel", "hoes", "potato", null, null];

/** プレイヤーのツールバーと 8×8 インベントリグリッドを管理する。 */
export class Inventory implements IInventoryWriter {
    private toolbarSlots_: (ItemStack | null)[];
    private inventorySlots_: (ItemStack | null)[];
    private selectedIndex_ = 0;

    constructor() {
        this.toolbarSlots_ = DEFAULT_TOOLBAR_ITEMS.map((id) => (id ? { itemId: id, count: 1 } : null));
        this.inventorySlots_ = Array<ItemStack | null>(INVENTORY_SLOT_COUNT).fill(null);
    }

    /** ツールバーの全スロット（readonly）。 */
    get toolbarSlots(): readonly (ItemStack | null)[] {
        return this.toolbarSlots_;
    }

    /** インベントリグリッドの全スロット（readonly）。 */
    get inventorySlots(): readonly (ItemStack | null)[] {
        return this.inventorySlots_;
    }

    /** 現在選択中のスロットインデックス。 */
    get selectedIndex(): number {
        return this.selectedIndex_;
    }

    /** 現在選択中のアイテム ID。空スロットの場合は null。 */
    get selectedTool(): ItemId | null {
        return this.toolbarSlots_[this.selectedIndex_]?.itemId ?? null;
    }

    /** スロットを選択する。範囲外のインデックスは無視される。 */
    selectSlot(index: number): void {
        if (index >= 0 && index < TOOLBAR_SLOT_COUNT) {
            this.selectedIndex_ = index;
        }
    }

    /** スロットの内容を取得する。 */
    getSlot(ref: SlotRef): ItemStack | null {
        const slots = ref.area === "toolbar" ? this.toolbarSlots_ : this.inventorySlots_;
        return slots[ref.index] ?? null;
    }

    /** スロットに内容をセットする。 */
    setSlot(ref: SlotRef, stack: ItemStack | null): void {
        if (ref.area === "toolbar") {
            this.toolbarSlots_[ref.index] = stack;
        } else {
            this.inventorySlots_[ref.index] = stack;
        }
    }

    /** 2 スロット間でアイテムスタックを完全に入れ替える。 */
    swapSlots(a: SlotRef, b: SlotRef): void {
        const slotA = this.getSlot(a);
        const slotB = this.getSlot(b);
        this.setSlot(a, slotB);
        this.setSlot(b, slotA);
    }

    /** アイテムをインベントリに追加する。
     *  既存スタックに積み（インベントリ→ツールバーの順）、満杯なら空きスロットに新規作成する。
     *  全数追加できた場合は true、インベントリが満杯で追加しきれなかった場合は false を返す。 */
    addItem(itemId: ItemId, count: number): boolean {
        const maxStack = ITEM_DEFS[itemId].maxStack;
        let remaining = count;

        // Phase 1: 既存スタックに積む（インベントリ→ツールバーの順）
        for (const slots of [this.inventorySlots_, this.toolbarSlots_]) {
            for (const slot of slots) {
                if (slot && slot.itemId === itemId && slot.count < maxStack) {
                    const canAdd = maxStack - slot.count;
                    const adding = Math.min(canAdd, remaining);
                    slot.count += adding;
                    remaining -= adding;
                    if (remaining === 0) return true;
                }
            }
        }

        // Phase 2: 空きスロットに新規作成（インベントリ→ツールバーの順）
        for (const slots of [this.inventorySlots_, this.toolbarSlots_]) {
            for (let i = 0; i < slots.length && remaining > 0; i++) {
                if (!slots[i]) {
                    const adding = Math.min(maxStack, remaining);
                    slots[i] = { itemId, count: adding };
                    remaining -= adding;
                }
            }
        }

        return remaining === 0;
    }

    /** 現在選択中のツールバースロットからアイテムを count 個消費する。
     *  残数が足りない場合は何もせず false を返す。 */
    consumeSelectedItem(count: number): boolean {
        const slot = this.toolbarSlots_[this.selectedIndex_];
        if (!slot || slot.count < count) return false;
        slot.count -= count;
        if (slot.count === 0) {
            this.toolbarSlots_[this.selectedIndex_] = null;
        }
        return true;
    }
}
