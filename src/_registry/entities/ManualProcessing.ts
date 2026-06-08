/**
 * カテゴリ2（手動処理）施設のエンティティ登録。
 *
 * 対象: threshing_machine / screw_presses / scutching_board / spinning_wheel / loom / anvil
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_processing_manual_ui を発行（UI起動）
 *  - 左クリック (onInteract) + axe → 撤去（ストレージが空のときのみ）
 */
import type { ItemId, Pos2D } from "../../_boundary/interfaces";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility } from "../facilityUtil";
import { getItemDef, registerItem } from "../ItemRegistry";
import { findRecipeForInput, getManualProcessingDef, isAcceptableInputItem, type ManualProcessingDef, type ProcessingRecipe } from "../ProcessingRecipes";
import {
    createStorage,
    getStorageNumberValue,
    getStorageSlot,
    registerStorage,
    removeFacilityAndReturnItemsToInventory,
    type StorageId,
    setStorageSlot,
    storageNumberValueOf,
} from "../StorageRegistry";

interface ManualProcessingEntityOptions {
    entityType: number;
    itemId: ItemId;
    displayName: string;
    fieldSpriteName: string;
    inventorySpriteName?: string;
    entitySize: { w: number; h: number };
}

/** カテゴリ2施設を1つ登録する。 */
export function registerManualProcessingEntity(opts: ManualProcessingEntityOptions): void {
    const { entityType, itemId, displayName, fieldSpriteName, inventorySpriteName, entitySize } = opts;

    registerEntity({
        entityType,

        getEntitySize() {
            return entitySize;
        },

        getSprites(): EntitySpriteInfo[] {
            return [[fieldSpriteName, 0, 0]];
        },

        // 左クリック: axe による撤去（中身は一緒にインベントリへ回収）
        onInteract(ctx: InteractionContext): boolean {
            if (ctx.tool !== "axe") return false;
            return removeFacilityAndReturnItemsToInventory(itemId, ctx);
        },

        // 右クリック: 処理 UI を開く
        onOpenFacilityUI(ctx: InteractionContext): boolean {
            ctx.eventBroker.publish("open_processing_manual_ui", { pos: ctx.anchorPos });
            return true;
        },
    });

    registerItem({
        itemId,
        displayName,
        spriteName: inventorySpriteName ?? fieldSpriteName,
        maxStack: 64,
        placement: {
            entityType,
            fieldSpriteName,
            onPlace(voxelMap, pos) {
                placeFacility(voxelMap, pos, entityType, entitySize);
                createStorage(itemId, pos);
            },
        },
    });

    registerStorage(
        itemId,
        {
            input: [null],
            output: [null, null],
            recipe: [storageNumberValueOf(0)],
        },
        undefined,
        (_kind, _index, stack) => {
            const def = getManualProcessingDef(entityType);
            if (!def) return false;
            return isAcceptableInputItem(def, stack?.itemId ?? "none");
        },
    );
}

// ── 移行済みエンティティの登録 ──
// 同一 entityType を facilities.ts と本ファイルで二重登録すると後勝ちで上書きされるため、
// 本ファイルで登録するエンティティは facilities.ts 側から必ず削除すること。

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.threshing_machine,
    itemId: "threshing_machine",
    displayName: "脱穀機",
    fieldSpriteName: "ss_sprite_054.png",
    inventorySpriteName: "ss_sprite_063.png",
    entitySize: { w: 2, h: 1 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.screw_presses,
    itemId: "screw_presses",
    displayName: "搾油機",
    fieldSpriteName: "ss_sprite_055.png",
    inventorySpriteName: "ss_sprite_064.png",
    entitySize: { w: 2, h: 2 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.scutching_board,
    itemId: "scutching_board",
    displayName: "叩き台",
    fieldSpriteName: "ss_sprite_057.png",
    inventorySpriteName: "ss_sprite_057.png",
    entitySize: { w: 1, h: 1 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.spinning_wheel,
    itemId: "spinning_wheel",
    displayName: "紡ぎ車",
    fieldSpriteName: "ss_sprite_058.png",
    inventorySpriteName: "ss_sprite_066.png",
    entitySize: { w: 2, h: 1 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.loom,
    itemId: "loom",
    displayName: "織機",
    fieldSpriteName: "ss_sprite_059.png",
    inventorySpriteName: "ss_sprite_067.png",
    entitySize: { w: 2, h: 2 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.anvil,
    itemId: "anvil",
    displayName: "金床",
    fieldSpriteName: "ss_sprite_079.png",
    inventorySpriteName: "ss_sprite_079.png",
    entitySize: { w: 1, h: 1 },
});

export function manualProcessingCanProcess(entityType: number, storageId: StorageId, pos: Pos2D): boolean {
    if (entityType === ENTITY_TYPES.none) return false;
    const def = getManualProcessingDef(entityType);
    if (!def) return false;
    return findApplicableRecipe(def, storageId, pos) !== null;
}

function findApplicableRecipe(def: ManualProcessingDef, storageId: StorageId, pos: Pos2D): ProcessingRecipe | null {
    const input = getStorageSlot(storageId, pos, "input", 0);
    if (!input) return null;
    const recipeIndex = getStorageNumberValue(storageId, pos, "recipe");
    if (recipeIndex === null) return null;
    const recipe = findRecipeForInput(def, input.itemId, recipeIndex);
    if (!recipe) return null;
    if (input.count < recipe.inputCountPerCycle) return null;
    for (let i = 0; i < recipe.outputs.length; i++) {
        const out = recipe.outputs[i];
        const slot = getStorageSlot(storageId, pos, "output", i);
        if (slot === null) continue;
        if (slot.itemId !== out.itemId) return null;
        const max = getItemDef(out.itemId)?.maxStack ?? 64;
        if (slot.count + out.count > max) return null;
    }
    return recipe;
}

export function manualProcessingTryProcessOnce(def: ManualProcessingDef, storageId: StorageId, pos: Pos2D): boolean {
    const recipe = findApplicableRecipe(def, storageId, pos);
    if (!recipe) return false;

    // 入力消費
    const input = getStorageSlot(storageId, pos, "input", 0);
    if (!input) return false;
    input.count -= recipe.inputCountPerCycle;
    setStorageSlot(storageId, pos, "input", 0, input.count < 0 ? null : input);

    // 出力加算
    for (let i = 0; i < recipe.outputs.length; i++) {
        const out = recipe.outputs[i];
        const slot = getStorageSlot(storageId, pos, "output", i);
        if (slot === null) {
            setStorageSlot(storageId, pos, "output", i, { itemId: out.itemId, count: out.count });
        } else {
            setStorageSlot(storageId, pos, "output", i, { itemId: out.itemId, count: out.count + slot.count });
        }
    }

    return true;
}
