/**
 * 蒸留器（distiller）の独立エンティティ登録（doc/26 §3.5）。
 *
 * 焚き火と同じ「燃料スロット＋素材スロット」型で、麦もろみを蒸留して麦焼酎を産出する。
 * 状態管理は DistillerStorage が担い、稼働状態は voxel の enabled ビットで表す。
 * スプライトは未作成のため 2x2 の堆肥場スプライトを流用する。
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_distiller_ui を発行（DistillerPanel 起動）
 *  - 左クリック (onInteract) + axe → 撤去（中身は一緒にインベントリへ回収）
 */

import type { ItemStack, IVoxelWriter, Pos2D } from "../../_boundary/interfaces";
import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import { ENTITY_TYPES, getEnabledFromVoxel, setEnabledInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { getItemDef, registerItem } from "../ItemRegistry";
import {
    DISTILLER_FUEL_ITEMS,
    DISTILLER_FUEL_PER_CYCLE,
    DISTILLER_MATERIAL_DEF,
    findAllRecipesForInput,
    isAcceptableInputItem,
    type ProcessingRecipe,
} from "../ProcessingRecipes";

const ENTITY_SIZE = { w: 2, h: 2 };

export type DistillerSlotKind = "fuel" | "material" | "output";

registerEntity({
    entityType: ENTITY_TYPES.distiller,

    getEntitySize() {
        return ENTITY_SIZE;
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        // 稼働中（燃料＋素材あり）は発酵中、それ以外は空の堆肥場スプライトを流用。
        return getEnabledFromVoxel(voxel) ? [["ss_sprite_053_2.png", 0, 0]] : [["ss_sprite_071.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const distiller = ctx.storageVault.get<DistillerStorage>("distiller");
        const extraItems = distiller.collectAllStacks(ctx.anchorPos);
        const removed = removeFacilityByContext(ctx, extraItems);
        if (removed) distiller.remove(ctx.anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_distiller_ui", { pos: ctx.anchorPos });
        return true;
    },
});

registerItem({
    itemId: "distiller",
    displayName: "蒸留器",
    spriteName: "ss_sprite_062.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.distiller,
        fieldSpriteName: "ss_sprite_071.png",
        onPlace(voxelMap, pos, _variant, storageVault) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.distiller, ENTITY_SIZE);
            storageVault.get<DistillerStorage>("distiller").create(pos);
        },
    },
});

/**
 * 蒸留器のストレージ。fuel + material を1日で消費して output（麦焼酎等）を産出する。
 * recipe スロットに選択中レシピ index を数値として保持する。稼働状態は voxel の enabled ビット。
 */
export class DistillerStorage extends SlotStorage {
    constructor() {
        super({ fuel: 1, material: 1, output: 1, recipe: 1 });
    }

    /** 選択中レシピ index（recipe スロットの count に保持。未設定は 0）。 */
    getRecipeIndex(pos: Pos2D): number {
        return this.getSlot(pos, "recipe", 0)?.count ?? 0;
    }

    setRecipeIndex(pos: Pos2D, index: number): void {
        this.setSlot(pos, "recipe", 0, { itemId: "none", count: index });
    }

    /** 燃料と素材が両方1個以上あれば稼働中（蒸留中）。 */
    isBurning(pos: Pos2D): boolean {
        const fuel = this.getSlot(pos, "fuel", 0);
        const material = this.getSlot(pos, "material", 0);
        return fuel !== null && fuel.count >= 1 && material !== null && material.count >= 1;
    }

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const pos of this.getPositions()) {
            const fuel = this.getSlot(pos, "fuel", 0);
            const material = this.getSlot(pos, "material", 0);
            const output = this.getSlot(pos, "output", 0);

            const recipe = material ? matchMaterialRecipe(material.itemId, this.getRecipeIndex(pos)) : null;
            const hasEnoughFuel = fuel !== null && fuel.count >= DISTILLER_FUEL_PER_CYCLE;
            const hasEnoughMaterial = material !== null && recipe != null && material.count >= recipe.inputCountPerCycle;

            if (fuel !== null && hasEnoughFuel && material !== null && hasEnoughMaterial && recipe != null && canStackInto(output, recipe.outputs[0])) {
                const newFuelCount = fuel.count - DISTILLER_FUEL_PER_CYCLE;
                const newMaterialCount = material.count - recipe.inputCountPerCycle;
                this.setSlot(pos, "fuel", 0, newFuelCount > 0 ? { itemId: fuel.itemId, count: newFuelCount } : null);
                this.setSlot(pos, "material", 0, newMaterialCount > 0 ? { itemId: material.itemId, count: newMaterialCount } : null);
                this.setSlot(pos, "output", 0, addToSlot(output, recipe.outputs[0]));
            }

            this.updateVoxelEnabled(pos, voxelMap);
        }
    }

    private updateVoxelEnabled(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition(pos);
        const voxel = voxelMap.get(surface);
        voxelMap.set(setEnabledInVoxel(voxel, this.isBurning(pos)), surface);
    }
}

registerStorageFactory("distiller", () => new DistillerStorage());

export function distillerCanAcceptFuel(itemId: string): boolean {
    return DISTILLER_FUEL_ITEMS.includes(itemId as never);
}

export function distillerCanAcceptMaterial(itemId: string): boolean {
    return isAcceptableInputItem(DISTILLER_MATERIAL_DEF, itemId as never);
}

function matchMaterialRecipe(itemId: string, selectedIndex: number): ProcessingRecipe | null {
    const matches = findAllRecipesForInput(DISTILLER_MATERIAL_DEF, itemId as never);
    if (matches.length === 0) return null;
    const idx = selectedIndex >= 0 && selectedIndex < matches.length ? selectedIndex : 0;
    return matches[idx];
}

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
