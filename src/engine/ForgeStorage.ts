import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { ENTITY_TYPES, setEntityTypeInVoxel } from "./TerrainDefs";

export type ForgeSlotKind = "ingredient" | "fuel" | "output";

export interface ForgeSlots {
    ingredient: ItemStack | null;
    fuel: ItemStack | null;
    output: ItemStack | null;
}

/** スロット種別ごとに受け入れ可能な itemId。 */
const ALLOWED_ITEM_IDS: Record<ForgeSlotKind, string | null> = {
    ingredient: "meteoric_iron",
    fuel: "charcoal",
    output: "hot_meteoric_iron",
};

const OUTPUT_STACK_MAX = 64;

/** 炉のスロット状態を座標ベースで管理するストレージ。 */
export class ForgeStorage {
    private forges = new Map<string, ForgeSlots>();

    private key(pos: Pos2D): string {
        return `${pos.x},${pos.z}`;
    }

    private posFromKey(key: string): Pos2D {
        const [x, z] = key.split(",").map(Number);
        return { x, z };
    }

    /** 指定座標に炉ストレージを作成する（既に存在する場合は何もしない）。 */
    create(pos: Pos2D): void {
        const k = this.key(pos);
        if (!this.forges.has(k)) {
            this.forges.set(k, { ingredient: null, fuel: null, output: null });
        }
    }

    /** 指定座標の炉ストレージを削除する。 */
    remove(pos: Pos2D): void {
        this.forges.delete(this.key(pos));
    }

    /** 指定座標の炉が空かどうかを返す（3スロット全て null）。存在しない場合は true。 */
    isEmpty(pos: Pos2D): boolean {
        const slots = this.forges.get(this.key(pos));
        if (!slots) return true;
        return slots.ingredient === null && slots.fuel === null && slots.output === null;
    }

    /** ingredient と fuel が両方 count>=1 であれば稼働中（burning）とみなす。 */
    isBurning(pos: Pos2D): boolean {
        const slots = this.forges.get(this.key(pos));
        if (!slots) return false;
        return (
            slots.ingredient !== null &&
            slots.ingredient.count >= 1 &&
            slots.fuel !== null &&
            slots.fuel.count >= 1
        );
    }

    /** 指定座標の炉の指定スロットを返す。 */
    getSlot(pos: Pos2D, kind: ForgeSlotKind): ItemStack | null {
        const slots = this.forges.get(this.key(pos));
        return slots ? (slots[kind] ?? null) : null;
    }

    /** 指定座標の炉の全スロットを返す。存在しない場合は undefined。 */
    getSlots(pos: Pos2D): ForgeSlots | undefined {
        return this.forges.get(this.key(pos));
    }

    /**
     * 指定座標の炉の指定スロットを設定する。
     * スロット種別ごとに受け入れ可能な itemId を検証し、違反時は console.warn して no-op にする。
     * 設定後、voxelMap のアンカーボクセルの entityType を forge / forge_burning に再判定して書き戻す。
     */
    setSlot(pos: Pos2D, kind: ForgeSlotKind, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.forges.get(this.key(pos));
        if (!slots) return;

        if (stack !== null) {
            const allowed = ALLOWED_ITEM_IDS[kind];
            if (stack.itemId !== allowed) {
                console.warn(
                    `[ForgeStorage] setSlot: slot "${kind}" は itemId="${allowed}" のみ受け入れます。` +
                        ` 渡された itemId="${stack.itemId}" は無効です。`
                );
                return;
            }
        }

        slots[kind] = stack;
        this.updateVoxelEntityType(pos, voxelMap);
    }

    /**
     * day_changed 時に全炉を走査し、ingredient と fuel に在庫があれば1個ずつ消費して output を加算する。
     * 消費後、アンカーボクセルの entityType を forge / forge_burning に再判定して書き戻す。
     */
    advanceDayAllForges(voxelMap: IVoxelWriter): void {
        for (const [key, slots] of this.forges) {
            if (slots.ingredient === null || slots.ingredient.count < 1) continue;
            if (slots.fuel === null || slots.fuel.count < 1) continue;

            // output が満杯または想定外の itemId ならスキップ
            if (slots.output !== null) {
                if (slots.output.itemId !== "hot_meteoric_iron") continue;
                if (slots.output.count >= OUTPUT_STACK_MAX) continue;
            }

            // ingredient 消費
            slots.ingredient.count -= 1;
            if (slots.ingredient.count === 0) slots.ingredient = null;

            // fuel 消費
            slots.fuel.count -= 1;
            if (slots.fuel.count === 0) slots.fuel = null;

            // output 加算
            if (slots.output === null) {
                slots.output = { itemId: "hot_meteoric_iron", count: 1 };
            } else {
                slots.output.count += 1;
            }

            // voxelMap のアンカー entityType を再判定して書き戻す
            const pos = this.posFromKey(key);
            this.updateVoxelEntityType(pos, voxelMap);
        }
    }

    /** 全炉データをシリアライズ可能な形式で返す（セーブ用）。 */
    toSaveData(): Array<{ key: string; slots: ForgeSlots }> {
        const result: Array<{ key: string; slots: ForgeSlots }> = [];
        for (const [key, slots] of this.forges) {
            result.push({ key, slots: { ...slots } });
        }
        return result;
    }

    /** セーブデータから炉ストレージを復元する（ロード用）。 */
    loadSaveData(data: Array<{ key: string; slots: ForgeSlots }>): void {
        this.forges.clear();
        for (const { key, slots } of data) {
            this.forges.set(key, { ...slots });
        }
    }

    /** アンカーボクセルの entityType を burning 状態に合わせて書き戻す。 */
    private updateVoxelEntityType(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surface);
        const newEntityType = this.isBurning(pos) ? ENTITY_TYPES.forge_burning : ENTITY_TYPES.forge;
        voxelMap.set(setEntityTypeInVoxel(voxel, newEntityType), surface);
    }
}
