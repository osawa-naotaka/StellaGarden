import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { BONFIRE_FUEL_DEF, BONFIRE_MATERIAL_DEF, findAllRecipesForInput, isAcceptableInputItem, type ProcessingRecipe } from "../_registry/ProcessingRecipes";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import type { NamedSlots } from "./SlotStorage";
import { setEnabledInVoxel, setRotatedInVoxel } from "./VoxelDefs";

/**
 * 焚き火（bonfire）のスロット種別（doc/26 §3.2）。
 * - fuel: 燃料（木材・茎）。燃やすと草木灰を生む
 * - material: 素材（大豆・麦）。火で蒸す/炒る
 * - outputAsh: 草木灰（燃料の燃焼副産物）
 * - outputSteamed: 蒸し系（蒸し大豆 / 蒸麦 / 炒り麦）
 */
export type BonfireSlotKind = "fuel" | "material" | "outputAsh" | "outputSteamed";

/** アイテムスロットの kind（recipe は metadata 用なので含めない）。 */
const ITEM_KINDS: readonly BonfireSlotKind[] = ["fuel", "material", "outputAsh", "outputSteamed"];

function canStackInto(slot: ItemStack | null, out: { itemId: string; count: number }): boolean {
    if (slot === null) return true;
    if (slot.itemId !== out.itemId) return false;
    const max = getItemDef(out.itemId)?.maxStack ?? 64;
    return slot.count + out.count <= max;
}

function addToSlot(slot: ItemStack | null, out: { itemId: string; count: number }): ItemStack {
    if (slot === null) return { itemId: out.itemId as ItemStack["itemId"], count: out.count };
    return { itemId: slot.itemId, count: slot.count + out.count };
}

/**
 * 焚き火のスロット状態を座標ベースで管理するストレージ。
 * StorageVault に載せるため slots は NamedSlots（Record<kind, slot[]>）形を採る。
 * 4つのアイテムスロット（fuel/material/outputAsh/outputSteamed）はいずれも1スロット配列、
 * 素材レシピ選択 index はスカラーを `recipe` スロットに `{ itemId: "none", count: index }` で encode する。
 * day_changed のたびに「燃料 → 草木灰」「素材 → 蒸し系」を同時処理する。
 */
export class BonfireStorage extends KeyedSlotStorage<NamedSlots> {
    protected createDefaultSlots(): NamedSlots {
        return { fuel: [null], material: [null], outputAsh: [null], outputSteamed: [null], recipe: [null] };
    }

    protected isSlotsEmpty(slots: NamedSlots): boolean {
        // recipe は metadata なので空判定から除外する。
        return ITEM_KINDS.every((kind) => (slots[kind]?.[0] ?? null) === null);
    }

    protected cloneSlots(slots: NamedSlots): NamedSlots {
        const result: NamedSlots = {};
        for (const [kind, arr] of Object.entries(slots)) result[kind] = arr.map((s) => (s ? { ...s } : null));
        return result;
    }

    protected toItemStacks(slots: NamedSlots): ItemStack[] {
        // recipe（metadata）は回収対象に含めない。
        const result: ItemStack[] = [];
        for (const kind of ITEM_KINDS) {
            const s = slots[kind]?.[0];
            if (s) result.push({ ...s });
        }
        return result;
    }

    /** 1日の燃焼に必要な量（燃料レシピの inputCountPerCycle）以上の燃料があれば燃焼中（点火状態）。 */
    isBurning(pos: Pos2D): boolean {
        const fuel = this.getRaw(pos)?.fuel[0] ?? null;
        if (fuel === null) return false;
        const recipe = this.matchFuelRecipe(fuel.itemId);
        return recipe !== null && fuel.count >= recipe.inputCountPerCycle;
    }

    /** 取り出し可能な草木灰があるか（消火時のスプライト出し分けに使う）。 */
    hasAsh(pos: Pos2D): boolean {
        return (this.getRaw(pos)?.outputAsh[0] ?? null) != null;
    }

    getSlot(pos: Pos2D, kind: BonfireSlotKind): ItemStack | null {
        return this.getRaw(pos)?.[kind]?.[0] ?? null;
    }

    getSelectedRecipeIndex(pos: Pos2D): number {
        return this.getRaw(pos)?.recipe?.[0]?.count ?? 0;
    }

    setSelectedRecipeIndex(pos: Pos2D, index: number): void {
        const slots = this.getRaw(pos);
        if (slots) slots.recipe[0] = { itemId: "none", count: index };
    }

    /** fuel スロットがこの itemId を受け入れ可能か（既存と同一 or 燃料レシピに存在）。 */
    canAcceptFuel(itemId: string): boolean {
        return isAcceptableInputItem(BONFIRE_FUEL_DEF, itemId as never);
    }

    /** material スロットがこの itemId を受け入れ可能か。 */
    canAcceptMaterial(itemId: string): boolean {
        return isAcceptableInputItem(BONFIRE_MATERIAL_DEF, itemId as never);
    }

    /**
     * スロットを設定する。fuel / material は受理可能 itemId を検証する。
     * 出力スロットは取り出し（null 設定）・戻し入れ用にそのまま設定する。
     * 設定後、voxel の enabled ビット（点火状態）を更新する。
     */
    setSlot(pos: Pos2D, kind: BonfireSlotKind, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;

        if (stack !== null) {
            if (kind === "fuel" && !this.canAcceptFuel(stack.itemId)) return;
            if (kind === "material" && !this.canAcceptMaterial(stack.itemId)) return;
        }

        slots[kind][0] = stack;
        this.updateVoxelSpriteState(pos, voxelMap);
    }

    /**
     * fuel / material スロットに itemId を count 個までマージ加算する。実際に追加できた個数を返す。
     * 容量・単一 itemId 制約・enabled 更新を内包するため、呼び出し側（ステーション）はマージ計算不要。
     * 0 を返すケース: ストレージ未生成／受理不可 itemId／既存スタックと itemId 不一致／満杯。
     */
    addToInputSlot(pos: Pos2D, kind: "fuel" | "material", itemId: string, count: number, voxelMap: IVoxelWriter): number {
        const slots = this.getRaw(pos);
        if (!slots) return 0;
        if (count <= 0) return 0;
        if (kind === "fuel" && !this.canAcceptFuel(itemId)) return 0;
        if (kind === "material" && !this.canAcceptMaterial(itemId)) return 0;

        const existing = slots[kind][0];
        if (existing !== null && existing.itemId !== itemId) return 0;

        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        const existingCount = existing?.count ?? 0;
        const space = maxStack - existingCount;
        if (space <= 0) return 0;

        const moved = Math.min(space, count);
        slots[kind][0] = { itemId: itemId as ItemStack["itemId"], count: existingCount + moved };
        this.updateVoxelSpriteState(pos, voxelMap);
        return moved;
    }

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const pos of this.getPositions()) {
            const slots = this.getRaw(pos);
            if (!slots) continue;

            const fuel = slots.fuel[0];
            const fuelRecipe = fuel != null ? this.matchFuelRecipe(fuel.itemId) : null;
            // 1日の燃焼に必要な量に満たない（または燃料ゼロ）なら消火＝何も処理しない。
            const lit = fuel != null && fuelRecipe != null && fuel.count >= fuelRecipe.inputCountPerCycle;

            if (lit && fuelRecipe != null && fuel != null) {
                // 燃料 → 草木灰（燃焼副産物）
                const ashOut = fuelRecipe.outputs[0];
                if (canStackInto(slots.outputAsh[0], ashOut)) {
                    fuel.count -= fuelRecipe.inputCountPerCycle;
                    slots.outputAsh[0] = addToSlot(slots.outputAsh[0], ashOut);
                    if (fuel.count <= 0) slots.fuel[0] = null;
                }

                // 素材 → 蒸し系（火に掛けて加工）
                const material = slots.material[0];
                if (material != null) {
                    const recipe = this.matchMaterialRecipe(material.itemId, this.getSelectedRecipeIndex(pos));
                    if (recipe && material.count >= recipe.inputCountPerCycle) {
                        const steamOut = recipe.outputs[0];
                        if (canStackInto(slots.outputSteamed[0], steamOut)) {
                            material.count -= recipe.inputCountPerCycle;
                            slots.outputSteamed[0] = addToSlot(slots.outputSteamed[0], steamOut);
                            if (material.count <= 0) slots.material[0] = null;
                        }
                    }
                }
            }

            this.updateVoxelSpriteState(pos, voxelMap);
        }
    }

    private matchFuelRecipe(itemId: string): ProcessingRecipe | null {
        const matches = findAllRecipesForInput(BONFIRE_FUEL_DEF, itemId as never);
        return matches[0] ?? null;
    }

    private matchMaterialRecipe(itemId: string, selectedIndex: number): ProcessingRecipe | null {
        const matches = findAllRecipesForInput(BONFIRE_MATERIAL_DEF, itemId as never);
        if (matches.length === 0) return null;
        const idx = selectedIndex >= 0 && selectedIndex < matches.length ? selectedIndex : 0;
        return matches[idx];
    }

    /**
     * スプライト切替用の状態を voxel に反映する。
     * enabled ビット = 点火状態（燃料が1日分以上）、rotated ビット = 草木灰の有無。
     */
    private updateVoxelSpriteState(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition(pos);
        const voxel = voxelMap.get(surface);
        const updated = setRotatedInVoxel(setEnabledInVoxel(voxel, this.isBurning(pos)), this.hasAsh(pos));
        voxelMap.set(updated, surface);
    }
}
