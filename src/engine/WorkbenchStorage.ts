import type { ItemId, ItemStack, Pos2D } from "../_boundary/interfaces";

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
export class WorkbenchStorage {
    private workbenches = new Map<string, WorkbenchSlots>();

    private key(pos: Pos2D): string {
        return `${pos.x},${pos.z}`;
    }

    /** 指定座標に作業台ストレージを作成する（既に存在する場合は何もしない）。 */
    create(pos: Pos2D): void {
        const k = this.key(pos);
        if (!this.workbenches.has(k)) {
            this.workbenches.set(k, { tool: null });
        }
    }

    /** 指定座標の作業台ストレージを削除する。 */
    remove(pos: Pos2D): void {
        this.workbenches.delete(this.key(pos));
    }

    /** 指定座標の作業台が空かどうかを返す。存在しない場合は true。 */
    isEmpty(pos: Pos2D): boolean {
        const slots = this.workbenches.get(this.key(pos));
        if (!slots) return true;
        return slots.tool === null;
    }

    /** 指定座標の利用ツールを返す。存在しない場合は null。 */
    getTool(pos: Pos2D): ItemStack | null {
        const slots = this.workbenches.get(this.key(pos));
        if (!slots?.tool) return null;
        return { ...slots.tool };
    }

    /** 指定座標の全スロットを返す。存在しない場合は undefined。 */
    getSlots(pos: Pos2D): WorkbenchSlots | undefined {
        const slots = this.workbenches.get(this.key(pos));
        if (!slots) return undefined;
        return {
            tool: slots.tool ? { ...slots.tool } : null,
        };
    }

    /**
     * 指定座標の利用ツールスロットを設定する。
     * 許可されていない itemId や count !== 1 は console.warn して no-op にする。
     */
    setTool(pos: Pos2D, stack: ItemStack | null): void {
        const slots = this.workbenches.get(this.key(pos));
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

    /** 全作業台データをシリアライズ可能な形式で返す（セーブ用）。 */
    toSaveData(): Array<{ key: string; slots: WorkbenchSlots }> {
        const result: Array<{ key: string; slots: WorkbenchSlots }> = [];
        for (const [key, slots] of this.workbenches) {
            result.push({
                key,
                slots: {
                    tool: slots.tool ? { ...slots.tool } : null,
                },
            });
        }
        return result;
    }

    /** セーブデータから作業台ストレージを復元する（ロード用）。 */
    loadSaveData(data: Array<{ key: string; slots: WorkbenchSlots }>): void {
        this.workbenches.clear();
        for (const { key, slots } of data) {
            this.workbenches.set(key, {
                tool: slots.tool ? { ...slots.tool } : null,
            });
        }
    }
}