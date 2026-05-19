import type { IEventBroker, IInventoryWriter, ItemStack, SlotRef } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import type { ItemId } from "./ItemDefs";

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
];
const DEFAULT_INVENTORY_ITEMS: readonly (DefaultItem | null)[] = [
    { itemId: "warp_gate", count: 1 },
    { itemId: "potato", count: 64 },
    { itemId: "soybeans", count: 64 },
    { itemId: "flaxseed", count: 64 },
    { itemId: "sunflower_seed", count: 64 },
    { itemId: "waterwheel", count: 8 },
    { itemId: "shaft", count: 64 },
    { itemId: "pods", count: 64 },
    { itemId: "rail", count: 64 },
    { itemId: "winch", count: 64 },
    // { itemId: "compost_bin", count: 64 },
    // { itemId: "threshing_machine", count: 64 },
    // { itemId: "screw_presses", count: 64 },
    // { itemId: "soaking_basket", count: 64 },
    // { itemId: "spinning_wheel", count: 64 },
    // { itemId: "loom", count: 64 },
    // { itemId: "kiln", count: 64 },
    // { itemId: "forge", count: 64 },
    // { itemId: "bonfire", count: 64 },
    // { itemId: "anvil", count: 64 },
    // { itemId: "clay", count: 64 },
    // { itemId: "meteoric_iron", count: 64 },
    // { itemId: "hot_meteoric_iron", count: 64 },
    // { itemId: "charcoal", count: 64 },
    // { itemId: "blade", count: 64 },
    // { itemId: "board", count: 64 },
    // { itemId: "stone_hammer", count: 64 },
    // { itemId: "froe", count: 64 },
    // { itemId: "tongs", count: 64 },
    // { itemId: "chisel", count: 64 },
    // { itemId: "hardwood_teeth", count: 64 },
    // { itemId: "screw_rod", count: 64 },
    // { itemId: "shaft", count: 64 },
    // { itemId: "frame", count: 64 },
    // { itemId: "processed_flax", count: 64 },
    // { itemId: "stone_pickaxe", count: 1 },
    // { itemId: "stone_axe", count: 1 },
    // { itemId: "stone_sickle", count: 1 },
    // { itemId: "wooden_shovel", count: 1 },
    // { itemId: "wooden_hoes", count: 1 },
    // { itemId: "clay_watering_can", count: 1 },
    // { itemId: "warp_gate", count: 1 },
    // { itemId: "ingot", count: 64 },
    // { itemId: "flax_stalk", count: 64 },

    // { itemId: "workbench", count: 1 },
    // { itemId: "trunk", count: 64 },
    // { itemId: "stone", count: 64 },
    // { itemId: "dirt", count: 64 },
    // { itemId: "clay", count: 64 },

    // { itemId: "stem", count: 64 },
    // { itemId: "leaves", count: 64 },
    // { itemId: "crop_residue", count: 64 },
    // { itemId: "pods", count: 64 },
    // { itemId: "soybean_oil", count: 64 },
    // { itemId: "bagged_soybeans", count: 64 },
    // { itemId: "flax_stalk", count: 64 },
    // { itemId: "flax_fiber", count: 64 },
    // { itemId: "thread", count: 64 },
    // { itemId: "rope", count: 64 },
    // { itemId: "cloth", count: 64 },
    // { itemId: "bag", count: 64 },
    // { itemId: "flaxseed_oil", count: 64 },
    // { itemId: "nuts", count: 64 },
    // { itemId: "compost", count: 64 },
    // { itemId: "plant_ashes", count: 64 },
    // { itemId: "oil_cake", count: 64 },
    // { itemId: "forge", count: 1 },
    // { itemId: "compost_bin", count: 1 },
    // { itemId: "threshing_machine", count: 1 },
    // { itemId: "screw_presses", count: 1 },
    // { itemId: "soaking_basket", count: 1 },
    // { itemId: "scutching_board", count: 1 },
    // { itemId: "spinning_wheel", count: 1 },
    // { itemId: "loom", count: 1 },
    // { itemId: "chest", count: 64 },
    // { itemId: "kiln", count: 64 },
    // { itemId: "bonfire", count: 64 },
    // { itemId: "meteoric_iron", count: 64 },
    // { itemId: "hot_meteoric_iron", count: 64 },
    // { itemId: "anvil", count: 1 },
    // { itemId: "charcoal", count: 64 },
    // { itemId: "blade", count: 64 },
    // { itemId: "board", count: 64 },
    // { itemId: "pipe", count: 64 },
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

    constructor(
        toolbarItems: readonly (DefaultItem | null)[] = DEFAULT_TOOLBAR_ITEMS,
        inventoryItems: readonly (DefaultItem | null)[] = DEFAULT_INVENTORY_ITEMS,
    ) {
        this.toolbarSlots_ = Array.from({ length: TOOLBAR_SLOT_COUNT }, (_, i) => {
            const item = toolbarItems[i] ?? null;
            return item ? { itemId: item.itemId, count: item.count } : null;
        });
        this.inventorySlots_ = Array.from({ length: INVENTORY_SLOT_COUNT }, (_, i) => {
            const item = inventoryItems[i] ?? null;
            return item ? { itemId: item.itemId, count: item.count } : null;
        });
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

    /** 初期選択インデックスを設定する（セーブデータ復元用）。 */
    setSelectedIndex(index: number): void {
        if (index >= 0 && index < TOOLBAR_SLOT_COUNT) {
            this.selectedIndex_ = index;
        }
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

    /** 複数種類のアイテムをアトミックに追加する。
     *  全アイテムが追加可能な場合のみ追加し true を返す。
     *  1つでも入りきらない場合は何も変更せず false を返す。 */
    addItems(items: ReadonlyArray<{ itemId: ItemId; count: number }>): boolean {
        // スナップショットを作成してシミュレーション
        const tbSnapshot = this.toolbarSlots_.map((s) => (s ? { ...s } : null));
        const invSnapshot = this.inventorySlots_.map((s) => (s ? { ...s } : null));

        for (const { itemId, count } of items) {
            if (!Inventory.tryAdd(invSnapshot, tbSnapshot, itemId, count)) {
                return false; // シミュレーション失敗 → 何も変更しない
            }
        }

        // シミュレーション成功 → スナップショットを実スロットに適用
        for (let i = 0; i < tbSnapshot.length; i++) this.toolbarSlots_[i] = tbSnapshot[i];
        for (let i = 0; i < invSnapshot.length; i++) this.inventorySlots_[i] = invSnapshot[i];
        return true;
    }

    /** スナップショット上でアイテム追加を試行する。成功時 true（スナップショットを変更）。 */
    private static tryAdd(invSlots: (ItemStack | null)[], tbSlots: (ItemStack | null)[], itemId: ItemId, count: number): boolean {
        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        let remaining = count;

        // Phase 1: 既存スタックに積む
        for (const slots of [tbSlots, invSlots]) {
            for (const slot of slots) {
                if (slot && slot.itemId === itemId && slot.count < maxStack) {
                    const adding = Math.min(maxStack - slot.count, remaining);
                    slot.count += adding;
                    remaining -= adding;
                    if (remaining === 0) return true;
                }
            }
        }

        // Phase 2: 空きスロットに新規作成
        for (const slots of [tbSlots, invSlots]) {
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

    canConsumeSelectedItem(count: number): boolean {
        const slot = this.toolbarSlots_[this.selectedIndex_];
        return slot !== null && slot.count >= count;
    }
}
