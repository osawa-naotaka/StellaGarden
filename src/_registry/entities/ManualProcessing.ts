/**
 * カテゴリ2（手動処理）施設のエンティティ登録。
 *
 * 対象: threshing_machine / screw_presses / scutching_board / spinning_wheel / loom / anvil
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_processing_manual_ui を発行（UI起動）
 *  - 左クリック (onInteract) + axe → 撤去（ストレージが空のときのみ）
 */
import type { ItemId, ItemStack, Pos2D } from "../../_boundary/interfaces";
import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { getItemDef, registerItem } from "../ItemRegistry";
import { findRecipeForInput, getManualProcessingDef, isAcceptableInputItem, type ProcessingRecipe } from "../ProcessingRecipes";

/**
 * カテゴリ2（手動処理）施設のストレージ。input 1 + output 2 + recipe(数値) を持つ。
 * 処理はUIの「処理」ボタンで tryProcessOnce を回す（日次処理なし）。
 * 受理アイテム判定・処理可否は entityType に紐づくレシピ定義から導出する。
 */
export class ManualProcessingStorage extends SlotStorage {
    private readonly entityType: number;

    constructor(entityType: number) {
        super({ input: 1, output: 2, recipe: 1 });
        this.entityType = entityType;
    }

    /** input スロットがこの itemId を受理可能か。 */
    canAccept(stack: ItemStack | null): boolean {
        const def = getManualProcessingDef(this.entityType);
        if (!def) return false;
        return isAcceptableInputItem(def, stack?.itemId ?? "none");
    }

    /** 選択中レシピ index（recipe スロットの count に保持。未設定は 0）。 */
    getRecipeIndex(pos: Pos2D): number {
        return this.getSlot(pos, "recipe", 0)?.count ?? 0;
    }

    setRecipeIndex(pos: Pos2D, index: number): void {
        this.setSlot(pos, "recipe", 0, { itemId: "none", count: index });
    }

    /** いま1サイクル処理可能か（入力充足・出力に空きあり）。 */
    canProcess(pos: Pos2D): boolean {
        return this.findApplicableRecipe(pos) !== null;
    }

    /** 1サイクル処理する。実行できたら true。 */
    tryProcessOnce(pos: Pos2D): boolean {
        const recipe = this.findApplicableRecipe(pos);
        if (!recipe) return false;

        const input = this.getSlot(pos, "input", 0);
        if (!input) return false;
        const newInputCount = input.count - recipe.inputCountPerCycle;
        this.setSlot(pos, "input", 0, newInputCount > 0 ? { itemId: input.itemId, count: newInputCount } : null);

        for (let i = 0; i < recipe.outputs.length; i++) {
            const out = recipe.outputs[i];
            const slot = this.getSlot(pos, "output", i);
            this.setSlot(pos, "output", i, slot === null ? { itemId: out.itemId, count: out.count } : { itemId: out.itemId, count: out.count + slot.count });
        }
        return true;
    }

    private findApplicableRecipe(pos: Pos2D): ProcessingRecipe | null {
        const def = getManualProcessingDef(this.entityType);
        if (!def) return null;
        const input = this.getSlot(pos, "input", 0);
        if (!input) return null;
        const recipe = findRecipeForInput(def, input.itemId, this.getRecipeIndex(pos));
        if (!recipe) return null;
        if (input.count < recipe.inputCountPerCycle) return null;
        for (let i = 0; i < recipe.outputs.length; i++) {
            const out = recipe.outputs[i];
            const slot = this.getSlot(pos, "output", i);
            if (slot === null) continue;
            if (slot.itemId !== out.itemId) return null;
            const max = getItemDef(out.itemId)?.maxStack ?? 64;
            if (slot.count + out.count > max) return null;
        }
        return recipe;
    }
}

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
            const storage = ctx.storageVault.get<SlotStorage>(itemId);
            const extraItems = storage.collectAllStacks(ctx.anchorPos);
            const removed = removeFacilityByContext(ctx, extraItems);
            if (removed) storage.remove(ctx.anchorPos);
            return removed;
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
            onPlace(voxelMap, pos, _variant, storageVault) {
                placeFacility(voxelMap, pos, entityType, entitySize);
                storageVault.get<SlotStorage>(itemId).create(pos);
            },
        },
    });

    registerStorageFactory(itemId, () => new ManualProcessingStorage(entityType));
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
