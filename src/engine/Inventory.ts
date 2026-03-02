import type { IEventBroker, IInventoryWriter, ItemStack, SlotRef } from "../_boundary/interfaces";
import { ITEM_DEFS, type ItemId } from "./ItemDefs";

const TOOLBAR_SLOT_COUNT = 10;
const INVENTORY_SLOT_COUNT = 64; // 8×8

type DefaultItem = { itemId: ItemId; count: number };
const DEFAULT_TOOLBAR_ITEMS: readonly (DefaultItem | null)[] = [
    { itemId: "hand", count: 1 },
    { itemId: "watering_can", count: 1 },
    { itemId: "pickaxe", count: 1 },
    { itemId: "axe", count: 1 },
    { itemId: "sickle", count: 1 },
    { itemId: "shovel", count: 1 },
    { itemId: "hoes", count: 1 },
    { itemId: "potato", count: 64 },
    null,
    null,
];

/** プレイヤーのツールバーと 8×8 インベントリグリッドを管理する。 */
export class Inventory implements IInventoryWriter {
    private toolbarSlots_: (ItemStack | null)[];
    private inventorySlots_: (ItemStack | null)[];
    private selectedIndex_ = 0;
    private broker: IEventBroker | null = null;

    /** ゲームプレイ開始後に EventBroker を注入する。 */
    setEventBroker(broker: IEventBroker): void {
        this.broker = broker;
    }

    constructor() {
        this.toolbarSlots_ = DEFAULT_TOOLBAR_ITEMS.map((item) => (item ? { itemId: item.itemId, count: item.count } : null));
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
        this.broker?.publish("inventory_changed", {
            slotIndex: ref.index,
            isToolbar: ref.area === "toolbar",
            stack: stack ? { itemId: stack.itemId, count: stack.count } : null,
        });
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
        this.broker?.publish("inventory_changed", {
            slotIndex: this.selectedIndex_,
            isToolbar: true,
            stack: this.toolbarSlots_[this.selectedIndex_],
        });
        return true;
    }
}
