import type { ItemStack, IVoxelWriter } from "../../_boundary/interfaces";
import { ENTITY_TYPES, setEntityTypeInVoxel } from "../../engine/VoxelDefs";
import type { Pos2D } from "../../lib/VoxelMap";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility } from "../facilityUtil";
import { registerItem, registerItemAlias } from "../ItemRegistry";
import { createStorage, getStorage, getStorageSet, posFromStorageKey, registerStorage, removeFacilityAndReturnItemsToInventory, setStorageSlot } from "../StorageRegistry";

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
        return removeFacilityAndReturnItemsToInventory("forge", ctx);
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
        return removeFacilityAndReturnItemsToInventory("forge", ctx);
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
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.forge, { w: 2, h: 2 });
            createStorage("forge", pos);
        },
    },
});

// 燃焼中状態でも findFacilityAnchor がアンカーを解決できるように登録する
registerItemAlias(ENTITY_TYPES.forge_burning, "forge");

const OUTPUT_STACK_MAX = 64;

registerStorage("forge", {
        ingredient: [null],
        fuel: [null],
        output: [null],
    },
    (voxelMap) => {
      for (const [key, slots] of Object.entries(getStorage("forge").value)) {
          if (slots.ingredient[0] === null || slots.ingredient[0].count < 1) continue;
          if (slots.fuel[0] === null || slots.fuel[0].count < 1) continue;

          // output が満杯または想定外の itemId ならスキップ
          if (slots.output[0] !== null) {
              if (slots.output[0].itemId !== "hot_meteoric_iron") continue;
              if (slots.output[0].count >= OUTPUT_STACK_MAX) continue;
          }

          // ingredient 消費
          slots.ingredient[0].count -= 1;
          if (slots.ingredient[0].count === 0) slots.ingredient[0] = null;

          // fuel 消費
          slots.fuel[0].count -= 1;
          if (slots.fuel[0].count === 0) slots.fuel[0] = null;

          // output 加算
          if (slots.output[0] === null) {
              slots.output[0] = { itemId: "hot_meteoric_iron", count: 1 };
          } else {
              slots.output[0].count += 1;
          }

          const pos = posFromStorageKey(key);
          setStorageSlot("forge", pos, "ingredient", 0, slots.ingredient[0]);
          setStorageSlot("forge", pos, "fuel", 0, slots.fuel[0]);
          setStorageSlot("forge", pos, "output", 0, slots.output[0]);

          // voxelMap のアンカー entityType を再判定して書き戻す
          updateVoxelEntityType(pos, voxelMap);
      }
    },
);

function updateVoxelEntityType(pos: Pos2D, voxelMap: IVoxelWriter): void {
    const surface = voxelMap.getSurfacePosition(pos);
    const voxel = voxelMap.get(surface);
    const newEntityType = isForgeBurning(pos) ? ENTITY_TYPES.forge_burning : ENTITY_TYPES.forge;
    voxelMap.set(setEntityTypeInVoxel(voxel, newEntityType), surface);
}

export function isForgeBurning(pos: Pos2D): boolean {
    const slots = getStorageSet("forge", pos);
    if (slots === undefined) return false;
    return slots.ingredient[0] !== null && slots.ingredient[0].count >= 1 && slots.fuel[0] !== null && slots.fuel[0].count >= 1;
}

export const ALLOWED_ITEM_IDS: Record<ForgeSlotKind, string | null> = {
    ingredient: "meteoric_iron",
    fuel: "charcoal",
    output: "hot_meteoric_iron",
};

export function setForgeSlot(pos: Pos2D, kind: ForgeSlotKind, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
    if (stack !== null) {
        const allowed = ALLOWED_ITEM_IDS[kind];
        if (stack.itemId !== allowed) {
            console.warn(
                `[ForgeStorage] setSlot: slot "${kind}" は itemId="${allowed}" のみ受け入れます。` + ` 渡された itemId="${stack.itemId}" は無効です。`,
            );
            return;
        }
    }

    setStorageSlot("forge", pos, kind, 0, stack);
    updateVoxelEntityType(pos, voxelMap);
}
