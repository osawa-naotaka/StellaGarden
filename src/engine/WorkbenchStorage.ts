import type { ItemId, ItemStack, Pos2D } from "../_boundary/interfaces";
import { KeyedSlotStorage } from "./KeyedSlotStorage";

export interface WorkbenchSlots {
    tool: ItemStack | null;
}

const ALLOWED_TOOL_ITEM_IDS: ReadonlySet<ItemId> = new Set([
    "hand",
    "pickaxe",
    "axe",
    "sickle",
    "shovel",
    "hoes",
    "watering_can",
    "tongs",
    "stone_hammer",
    "froe",
    "chisel",
    "stone_pickaxe",
    "stone_axe",
    "stone_sickle",
    "wooden_shovel",
    "wooden_hoes",
    "clay_watering_can",
]);

/** 作業台ごとの利用ツールスロットを座標ベースで管理するストレージ。 */
export class WorkbenchStorage extends KeyedSlotStorage<WorkbenchSlots> {
    protected createDefaultSlots(): WorkbenchSlots {
        return { tool: null };
    }

    protected isSlotsEmpty(slots: WorkbenchSlots): boolean {
        return slots.tool === null;
    }

    protected cloneSlots(slots: WorkbenchSlots): WorkbenchSlots {
        return { tool: slots.tool ? { ...slots.tool } : null };
    }

    protected toItemStacks(slots: WorkbenchSlots): ItemStack[] {
        return slots.tool ? [{ ...slots.tool }] : [];
    }

    /** 指定座標の利用ツールを返す。存在しない場合は null。 */
    getTool(pos: Pos2D): ItemStack | null {
        const slots = this.getRaw(pos);
        if (!slots?.tool) return null;
        return { ...slots.tool };
    }

    /**
     * 指定座標の利用ツールスロットを設定する。
     * 許可されていない itemId や count !== 1 は console.warn して no-op にする。
     */
    setTool(pos: Pos2D, stack: ItemStack | null): void {
        const slots = this.getRaw(pos);
        if (!slots) return;

        if (stack !== null) {
            if (!ALLOWED_TOOL_ITEM_IDS.has(stack.itemId)) {
                console.warn(`[WorkbenchStorage] setTool: itemId="${stack.itemId}" は利用ツールスロットに設定できません。`);
                return;
            }
            if (stack.count !== 1) {
                console.warn(`[WorkbenchStorage] setTool: 利用ツールスロットの count は 1 固定です。渡された count=${stack.count} は無効です。`);
                return;
            }
        }

        slots.tool = stack ? { ...stack } : null;
    }
}
