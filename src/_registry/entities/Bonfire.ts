import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

// ── 点火中アニメーション用スプライトテーブル ──

const LIT_SPRITES: EntitySpriteInfo[][] = [
    [["ss_sprite_074_1.png", 0, 0]],
    [["ss_sprite_074_2.png", 0, 0]],
    [["ss_sprite_074_3.png", 0, 0]],
];
const ANIM_FRAME_MS = 300;

// ── 焚き火（点火前）──

registerEntity({
    entityType: ENTITY_TYPES.bonfire,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_076.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // trunk 4 つを消費して点火
        if (ctx.tool === "trunk") {
            if (!ctx.inventory.consumeSelectedItem(4)) return false;
            const newVoxel = (ctx.voxel & 0xff) | (ENTITY_TYPES.bonfire_lit << 8);
            ctx.voxelMap.set(newVoxel, ctx.surfacePos);
            return true;
        }
        // axe で撤去
        if (ctx.tool === "axe") {
            return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.bonfire);
        }
        return false;
    },
});

// ── 焚き火（点火中）──

registerEntity({
    entityType: ENTITY_TYPES.bonfire_lit,

    getSprites(): EntitySpriteInfo[] {
        const frame = Math.floor(Date.now() / ANIM_FRAME_MS) % 3;
        return LIT_SPRITES[frame];
    },
    // 点火中は操作不可
});

// ── 焚き火（消火中）──

registerEntity({
    entityType: ENTITY_TYPES.bonfire_done,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_075.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // 素手で草木灰を回収し、点火前に戻す
        if (ctx.tool !== "hand") return false;
        if (!ctx.inventory.addItems([{ itemId: "plant_ashes", count: 4 }])) return false;
        const newVoxel = (ctx.voxel & 0xff) | (ENTITY_TYPES.bonfire << 8);
        ctx.voxelMap.set(newVoxel, ctx.surfacePos);
        return true;
    },
});

// ── アイテム登録（点火前の焚き火を配置するアイテム）──

registerItem({
    itemId: "bonfire",
    spriteName: "ss_sprite_076.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.bonfire,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: "ss_sprite_076.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.bonfire, { w: 1, h: 1 });
        },
    },
});
