import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";
import { createStorage, registerStorage, removeStorage } from "../StorageRegistry";

const WARP_SPRITES: EntitySpriteInfo[][] = [[["ss_sprite_105_1.png", 0, 0]], [["ss_sprite_105_2.png", 0, 0]], [["ss_sprite_105_3.png", 0, 0]]];
const ANIM_FRAME_MS = 100;

function resolveAnchorPos(ctx: InteractionContext): { x: number; z: number } {
    const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
    return { x: anchor.anchorX, z: anchor.anchorZ };
}

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
            const pos = resolveAnchorPos(ctx);
            const result = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, pos.x, pos.z, ENTITY_TYPES.warp_gate);
            if (result) {
                removeStorage("warp_gate", pos);
            }
            return result;
        }
        return false;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const pos = resolveAnchorPos(ctx);
        ctx.eventBroker.publish("open_warp_gate_ui", { pos });
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
