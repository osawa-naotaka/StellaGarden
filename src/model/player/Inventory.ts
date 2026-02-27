/** ツールバーに配置できるアイテム名の型。 */
export type ToolName = "watering_can" | "pickaxe" | "axe" | "sickle" | "shovel" | "hoes" | "potato_icon";

const DEFAULT_SLOTS: readonly (ToolName | null)[] = [
    "watering_can", "pickaxe", "axe", "sickle", "shovel", "hoes", "potato_icon", null, null,
];

/** プレイヤーのツールバースロットと選択状態を管理する。
 *  将来のインベントリグリッド・クラフトシステムもここに追加する。 */
export class Inventory {
    private readonly m_slots: readonly (ToolName | null)[];
    private m_selectedIndex = 0;

    constructor(slots: readonly (ToolName | null)[] = DEFAULT_SLOTS) {
        this.m_slots = slots;
    }

    /** スロットの一覧（読み取り専用）。 */
    get slots(): readonly (ToolName | null)[] {
        return this.m_slots;
    }

    /** 現在選択中のスロットインデックス。 */
    get selectedIndex(): number {
        return this.m_selectedIndex;
    }

    /** 現在選択中のツール。空スロットの場合は null。 */
    get selectedTool(): ToolName | null {
        return this.m_slots[this.m_selectedIndex] ?? null;
    }

    /** スロットを選択する。範囲外のインデックスは無視される。 */
    selectSlot(index: number): void {
        if (index >= 0 && index < this.m_slots.length) {
            this.m_selectedIndex = index;
        }
    }
}
