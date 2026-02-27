/** ツールバーに配置できるアイテム名の型。 */
export type ToolName = "watering_can" | "pickaxe" | "axe" | "sickle" | "shovel" | "hoes" | "potato_icon";

const DEFAULT_SLOTS: readonly (ToolName | null)[] = ["watering_can", "pickaxe", "axe", "sickle", "shovel", "hoes", "potato_icon", null, null];

/** プレイヤーのツールバースロットと選択状態を管理する。
 *  将来のインベントリグリッド・クラフトシステムもここに追加する。 */
export class Inventory {
    readonly slots: readonly (ToolName | null)[];
    private selectedIndex_ = 0;

    constructor(slots: readonly (ToolName | null)[] = DEFAULT_SLOTS) {
        this.slots = slots;
    }

    /** 現在選択中のスロットインデックス。 */
    get selectedIndex(): number {
        return this.selectedIndex_;
    }

    /** 現在選択中のツール。空スロットの場合は null。 */
    get selectedTool(): ToolName | null {
        return this.slots[this.selectedIndex_] ?? null;
    }

    /** スロットを選択する。範囲外のインデックスは無視される。 */
    selectSlot(index: number): void {
        if (index >= 0 && index < this.slots.length) {
            this.selectedIndex_ = index;
        }
    }
}
