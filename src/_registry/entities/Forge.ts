import type { ForgeStorage } from "../../engine/ForgeStorage";
import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem, registerItemAlias } from "../ItemRegistry";

// ── 燃焼中アニメーション用スプライトテーブル ──

const BURNING_SPRITES: EntitySpriteInfo[][] = [
    [["ss_sprite_070_1.png", 0, 0]],
    [["ss_sprite_070_2.png", 0, 0]],
    [["ss_sprite_070_3.png", 0, 0]],
];
const ANIM_FRAME_MS = 300;

// ── ForgeStorage の注入 ──

let forgeStorage: ForgeStorage | null = null;

/** App.tsx から ForgeStorage を注入する。 */
export function setForgeStorage(storage: ForgeStorage): void {
    forgeStorage = storage;
}

// ── 炉（消火中）──

registerEntity({
    entityType: ENTITY_TYPES.forge,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_069.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        const pos = { x: ctx.surfacePos.x, z: ctx.surfacePos.z };
        if (!removeFacilityAtPos(ctx.voxelMap, ctx.inventory, pos.x, pos.z, ENTITY_TYPES.forge)) return false;
        forgeStorage?.remove(pos);
        return true;
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_forge_ui", { pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z } });
        return true;
    },
});

// ── 炉（燃焼中）──

registerEntity({
    entityType: ENTITY_TYPES.forge_burning,

    getSprites(): EntitySpriteInfo[] {
        const frame = Math.floor(Date.now() / ANIM_FRAME_MS) % 3;
        return BURNING_SPRITES[frame];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        const pos = { x: ctx.surfacePos.x, z: ctx.surfacePos.z };
        if (!removeFacilityAtPos(ctx.voxelMap, ctx.inventory, pos.x, pos.z, ENTITY_TYPES.forge_burning)) return false;
        forgeStorage?.remove(pos);
        return true;
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_forge_ui", { pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z } });
        return true;
    },
});

// ── アイテム登録（配置時は消火中）──

registerItem({
    itemId: "forge",
    spriteName: "ss_sprite_052.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.forge,
        entitySize: { w: 2, h: 2 },
        fieldSpriteName: "ss_sprite_069.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.forge, { w: 2, h: 2 });
            forgeStorage?.create(pos);
        },
    },
});

// 燃焼中状態でも findFacilityAnchor がアンカーを解決できるように登録する
registerItemAlias(ENTITY_TYPES.forge_burning, "forge");
