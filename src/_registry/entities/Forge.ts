import type { ItemStack, IVoxelWriter } from "../../_boundary/interfaces";
import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import { ENTITY_TYPES, setEntityTypeInVoxel } from "../../engine/VoxelDefs";
import type { Pos2D } from "../../lib/VoxelMap";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { registerItem, registerItemAlias } from "../ItemRegistry";

// ── 燃焼中アニメーション用スプライトテーブル ──

const BURNING_SPRITES: EntitySpriteInfo[][] = [[["ss_sprite_070_1.png", 0, 0]], [["ss_sprite_070_2.png", 0, 0]], [["ss_sprite_070_3.png", 0, 0]]];
const ANIM_FRAME_MS = 300;

export type ForgeSlotKind = "ingredient" | "fuel" | "output";

// ── 炉（消火中）──

registerEntity({
    entityType: ENTITY_TYPES.forge,

    getEntitySize() {
        return { w: 2, h: 2 };
    },

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_069.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        const forge = ctx.storageVault.get<ForgeStorage>("forge");
        const extraItems = forge.collectAllStacks(ctx.anchorPos);
        const removed = removeFacilityByContext(ctx, extraItems);
        if (removed) forge.remove(ctx.anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_forge_ui", { pos: ctx.anchorPos });
        return true;
    },
});

// ── 炉（燃焼中）──

registerEntity({
    entityType: ENTITY_TYPES.forge_burning,

    getEntitySize() {
        return { w: 2, h: 2 };
    },

    getSprites(): EntitySpriteInfo[] {
        const frame = Math.floor(Date.now() / ANIM_FRAME_MS) % 3;
        return BURNING_SPRITES[frame];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        const forge = ctx.storageVault.get<ForgeStorage>("forge");
        const extraItems = forge.collectAllStacks(ctx.anchorPos);
        const removed = removeFacilityByContext(ctx, extraItems);
        if (removed) forge.remove(ctx.anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_forge_ui", { pos: ctx.anchorPos });
        return true;
    },
});

// ── アイテム登録（配置時は消火中）──

registerItem({
    itemId: "forge",
    displayName: "炉",
    spriteName: "ss_sprite_052.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.forge,
        fieldSpriteName: "ss_sprite_069.png",
        onPlace(voxelMap, pos, _variant, storageVault) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.forge, { w: 2, h: 2 });
            storageVault.get<ForgeStorage>("forge").create(pos);
        },
    },
});

// 燃焼中状態でも findFacilityAnchor がアンカーを解決できるように登録する
registerItemAlias(ENTITY_TYPES.forge_burning, "forge");

const OUTPUT_STACK_MAX = 64;

const ALLOWED_ITEM_IDS: Record<ForgeSlotKind, string | null> = {
    ingredient: "meteoric_iron",
    fuel: "charcoal",
    output: "hot_meteoric_iron",
};

/**
 * 炉のストレージ。ingredient + fuel を1日で消費して hot_meteoric_iron を精錬する。
 * 稼働状態は voxel の entityType（forge / forge_burning）で表現しスプライトを切り替える。
 */
export class ForgeStorage extends SlotStorage {
    constructor() {
        super({ ingredient: 1, fuel: 1, output: 1 });
    }

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const pos of this.getPositions()) {
            const ingredient = this.getSlot(pos, "ingredient", 0);
            const fuel = this.getSlot(pos, "fuel", 0);
            const output = this.getSlot(pos, "output", 0);
            if (ingredient === null || ingredient.count < 1) continue;
            if (fuel === null || fuel.count < 1) continue;

            // output が満杯または想定外の itemId ならスキップ
            if (output !== null) {
                if (output.itemId !== "hot_meteoric_iron") continue;
                if (output.count >= OUTPUT_STACK_MAX) continue;
            }

            const newIngredient = ingredient.count - 1 > 0 ? { itemId: ingredient.itemId, count: ingredient.count - 1 } : null;
            const newFuel = fuel.count - 1 > 0 ? { itemId: fuel.itemId, count: fuel.count - 1 } : null;
            const newOutput: ItemStack = output === null ? { itemId: "hot_meteoric_iron", count: 1 } : { itemId: output.itemId, count: output.count + 1 };

            this.setSlot(pos, "ingredient", 0, newIngredient);
            this.setSlot(pos, "fuel", 0, newFuel);
            this.setSlot(pos, "output", 0, newOutput);

            // voxelMap のアンカー entityType を再判定して書き戻す
            this.updateVoxelEntityType(pos, voxelMap);
        }
    }

    /** ingredient と fuel が両方1個以上あれば燃焼中。 */
    isBurning(pos: Pos2D): boolean {
        const ingredient = this.getSlot(pos, "ingredient", 0);
        const fuel = this.getSlot(pos, "fuel", 0);
        return ingredient !== null && ingredient.count >= 1 && fuel !== null && fuel.count >= 1;
    }

    /** 受理可能 itemId を検証してスロットを設定し、稼働状態(voxel entityType)を更新する。 */
    setForgeSlot(pos: Pos2D, kind: ForgeSlotKind, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        if (stack !== null) {
            const allowed = ALLOWED_ITEM_IDS[kind];
            if (stack.itemId !== allowed) {
                console.warn(`[ForgeStorage] setSlot: slot "${kind}" は itemId="${allowed}" のみ受け入れます。 渡された itemId="${stack.itemId}" は無効です。`);
                return;
            }
        }
        this.setSlot(pos, kind, 0, stack);
        this.updateVoxelEntityType(pos, voxelMap);
    }

    private updateVoxelEntityType(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition(pos);
        const voxel = voxelMap.get(surface);
        const newEntityType = this.isBurning(pos) ? ENTITY_TYPES.forge_burning : ENTITY_TYPES.forge;
        voxelMap.set(setEntityTypeInVoxel(voxel, newEntityType), surface);
    }
}

registerStorageFactory("forge", () => new ForgeStorage());
