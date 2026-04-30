import { ENTITY_TYPES, setEntityTypeInVoxel } from "../../engine/TerrainDefs";
import { type DailyTickContext, type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

// ── 点火中アニメーション用スプライトテーブル ──

const LIT_SPRITES: EntitySpriteInfo[][] = [[["ss_sprite_074_1.png", 0, 0]], [["ss_sprite_074_2.png", 0, 0]], [["ss_sprite_074_3.png", 0, 0]]];
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
            ctx.voxelMap.set(setEntityTypeInVoxel(ctx.voxel, ENTITY_TYPES.bonfire_lit), ctx.surfacePos);
            return true;
        }

        // trunk 4 つを消費して点火
        if (ctx.tool === "stem") {
            if (!ctx.inventory.consumeSelectedItem(20)) return false;
            ctx.voxelMap.set(setEntityTypeInVoxel(ctx.voxel, ENTITY_TYPES.bonfire_lit), ctx.surfacePos);
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

    onDailyTick(ctx: DailyTickContext): void {
        // 1日後に消火中へ遷移
        ctx.voxelMap.set(setEntityTypeInVoxel(ctx.voxel, ENTITY_TYPES.bonfire_done), ctx.pos);
    },
    // 右クリック操作不可（点火中のため）
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
        ctx.voxelMap.set(setEntityTypeInVoxel(ctx.voxel, ENTITY_TYPES.bonfire), ctx.surfacePos);
        return true;
    },
});

// ── アイテム登録（点火前の焚き火を配置するアイテム）──

registerItem({
    itemId: "bonfire",
    spriteName: "ss_sprite_076.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.bonfire,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: "ss_sprite_076.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.bonfire, { w: 1, h: 1 });
        },
    },
});
