import type { ItemStack, Pos2D } from "../_boundary/interfaces";
import { KeyedSlotStorage } from "./KeyedSlotStorage";

/** kind ごとに固定長スロット配列を持つだけの汎用スロット状態。 */
export type NamedSlots = Record<string, (ItemStack | null)[]>;

/**
 * 「名前付き kind ごとに N 個のスロットを持つだけ」の単純な収納を1クラスで賄う汎用ストレージ。
 * チェストのようにドメインロジックを持たない収納は、専用サブクラスを作らず
 * `new SlotStorage({ main: 64 })` のように shape を渡すだけで使える。
 * 発酵桶・焚き火のようにロジックを持つ設備は従来通り KeyedSlotStorage を直接継承する。
 */
export class SlotStorage extends KeyedSlotStorage<NamedSlots> {
    private readonly shape: Record<string, number>;

    constructor(shape: Record<string, number>) {
        super();
        this.shape = shape;
    }

    protected createDefaultSlots(): NamedSlots {
        const slots: NamedSlots = {};
        for (const [kind, count] of Object.entries(this.shape)) slots[kind] = new Array(count).fill(null);
        return slots;
    }

    protected isSlotsEmpty(slots: NamedSlots): boolean {
        return Object.values(slots).every((arr) => arr.every((s) => s === null));
    }

    protected cloneSlots(slots: NamedSlots): NamedSlots {
        const result: NamedSlots = {};
        for (const [kind, arr] of Object.entries(slots)) result[kind] = arr.map((s) => (s ? { ...s } : null));
        return result;
    }

    protected toItemStacks(slots: NamedSlots): ItemStack[] {
        const result: ItemStack[] = [];
        for (const arr of Object.values(slots)) for (const s of arr) if (s) result.push({ ...s });
        return result;
    }

    getSlot(pos: Pos2D, kind: string, index: number): ItemStack | null {
        return this.getRaw(pos)?.[kind]?.[index] ?? null;
    }

    setSlot(pos: Pos2D, kind: string, index: number, stack: ItemStack | null): void {
        const slots = this.getRaw(pos);
        if (!slots?.[kind]) return;
        slots[kind][index] = stack;
    }
}
