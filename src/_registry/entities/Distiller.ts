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
import { ENTITY_TYPES, getEnabledFromVoxel, setEnabledInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility } from "../facilityUtil";
import { getItemDef, registerItem } from "../ItemRegistry";
import {
    DISTILLER_FUEL_ITEMS,
    DISTILLER_FUEL_PER_CYCLE,
    DISTILLER_MATERIAL_DEF,
    findAllRecipesForInput,
    isAcceptableInputItem,
    type ProcessingRecipe,
} from "../ProcessingRecipes";
import {
    createStorage,
    getStorage,
    getStorageSlot,
    posFromStorageKey,
    registerStorage,
    removeFacilityAndReturnItemsToInventory,
    setStorageSlot,
    storageNumberValueOf,
} from "../StorageRegistry";

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
        return removeFacilityAndReturnItemsToInventory("distiller", ctx);
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
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.distiller, ENTITY_SIZE);
            createStorage("distiller", pos);
        },
    },
});

registerStorage(
    "distiller",
    {
        fuel: [null],
        material: [null],
        output: [null],
        recipe: [storageNumberValueOf(0)],
    },
    (voxelMap) => {
        for (const [key, slots] of Object.entries(getStorage("distiller").value)) {
            const pos = posFromStorageKey(key);

            const recipe = slots.material[0] ? matchMaterialRecipe(slots.material[0].itemId, slots.recipe[0]?.count ?? 0) : null;
            const hasEnoughFuel = slots.fuel[0] !== null && slots.fuel[0].count >= DISTILLER_FUEL_PER_CYCLE;
            const hasEnoughMaterial = slots.material[0] !== null && recipe != null && slots.material[0].count >= recipe.inputCountPerCycle;

            if (
                slots.fuel[0] !== null &&
                hasEnoughFuel &&
                slots.material[0] !== null &&
                hasEnoughMaterial &&
                recipe != null &&
                canStackInto(slots.output[0], recipe.outputs[0])
            ) {
                slots.fuel[0].count -= DISTILLER_FUEL_PER_CYCLE;
                slots.material[0].count -= recipe.inputCountPerCycle;
                slots.output[0] = addToSlot(slots.output[0], recipe.outputs[0]);
                if (slots.fuel[0].count <= 0) slots.fuel[0] = null;
                if (slots.material[0].count <= 0) slots.material[0] = null;
                setStorageSlot("distiller", pos, "fuel", 0, slots.fuel[0]);
                setStorageSlot("distiller", pos, "material", 0, slots.material[0]);
                setStorageSlot("distiller", pos, "output", 0, slots.output[0]);
            }

            updateVoxelEnabled(pos, voxelMap);
        }
    },
);

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

function updateVoxelEnabled(pos: Pos2D, voxelMap: IVoxelWriter): void {
    const surface = voxelMap.getSurfacePosition(pos);
    const voxel = voxelMap.get(surface);
    voxelMap.set(setEnabledInVoxel(voxel, isBurning(pos)), surface);
}

/** 燃料と素材が両方揃っていれば稼働中（蒸留中）とみなす。 */
function isBurning(pos: Pos2D): boolean {
    const fuel = getStorageSlot("distiller", pos, "fuel", 0);
    const material = getStorageSlot("distiller", pos, "material", 0);
    return fuel !== null && fuel.count >= 1 && material !== null && material.count >= 1;
}
