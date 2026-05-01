import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import type { WarpGateStorage } from "../../engine/WarpGateStorage";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

/** App.tsx から WarpGateStorage を注入する。 */
export function setWarpGateStorage(_storage: WarpGateStorage): void {}

const WARP_SPRITES: EntitySpriteInfo[][] = [[["ss_sprite_105_1.png", 0, 0]], [["ss_sprite_105_2.png", 0, 0]], [["ss_sprite_105_3.png", 0, 0]]];
const ANIM_FRAME_MS = 100;

registerEntity({
    entityType: ENTITY_TYPES.warp_gate,

    getSprites(): EntitySpriteInfo[] {
        const frame = Math.floor(Date.now() / ANIM_FRAME_MS) % 3;
        return WARP_SPRITES[frame];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去
        if (ctx.tool === "axe") {
            return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.warp_gate);
        }
        return false;
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_warp_gate_ui", { pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z } });
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
        entitySize: { w: 2, h: 3 },
        fieldSpriteName: "ss_sprite_105_1.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.warp_gate, { w: 2, h: 3 });
        },
    },
});
