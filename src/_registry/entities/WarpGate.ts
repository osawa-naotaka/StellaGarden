import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";
import { createStorage, registerStorage, removeFacilityAndReturnItemsToInventory, removeStorage } from "../StorageRegistry";

const WARP_SPRITES: EntitySpriteInfo[][] = [[["ss_sprite_105_1.png", 0, 0]], [["ss_sprite_105_2.png", 0, 0]], [["ss_sprite_105_3.png", 0, 0]]];
const ANIM_FRAME_MS = 100;

registerEntity({
    entityType: ENTITY_TYPES.warp_gate,

    getEntitySize() {
        return { w: 2, h: 3 };
    },

    getSprites(): EntitySpriteInfo[] {
        const frame = Math.floor(Date.now() / ANIM_FRAME_MS) % 3;
        return WARP_SPRITES[frame];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去
        if (ctx.tool === "axe") {
            const result = removeFacilityAndReturnItemsToInventory("warp_gate", ctx);
            if (result) {
                removeStorage("warp_gate", ctx.anchorPos);
            }
            return result;
        }
        return false;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_warp_gate_ui", { pos: ctx.anchorPos });
        return true;
    },
});

// ── アイテム登録（点火前の焚き火を配置するアイテム）──

registerItem({
    itemId: "warp_gate",
    displayName: "転移ゲート",
    spriteName: "ss_sprite_104.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.warp_gate,
        fieldSpriteName: "ss_sprite_105_1.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.warp_gate, { w: 2, h: 3 });
            createStorage("warp_gate", pos);
        },
    },
});

export const WARP_GATE_SLOT_COUNT = 32;

registerStorage("warp_gate", { main: new Array(WARP_GATE_SLOT_COUNT).fill(null) });
