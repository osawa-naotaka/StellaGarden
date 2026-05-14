import { ENTITY_TYPES, getVariantFromVoxel, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

const ANIM_FRAME_MS = 300;

const SHAFT_V_FRAMES = ["ss_sprite_132_v_4.png", "ss_sprite_132_v_3.png", "ss_sprite_132_v_2.png", "ss_sprite_132_v_1.png"];
const SHAFT_H_FRAMES = ["ss_sprite_132_h_4.png", "ss_sprite_132_h_3.png", "ss_sprite_132_h_2.png", "ss_sprite_132_h_1.png"];
function shaftFrame(variant: PlacementVariant): string {
    switch (variant) {
        case 0:
            return SHAFT_H_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % SHAFT_H_FRAMES.length];
        case 1:
            return SHAFT_V_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % SHAFT_V_FRAMES.length];
        default:
            return SHAFT_H_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % SHAFT_H_FRAMES.length];
    }
}


function getShaftPreviewSpriteName(variant: PlacementVariant): string {
    switch (variant) {
        case 0:
            return "ss_sprite_132_h_1.png";
        case 1:
            return "ss_sprite_132_v_1.png";
        default:
            return "ss_sprite_132_h_1.png";
    }
}

registerEntity({
    entityType: ENTITY_TYPES.shaft,
    entitySize: { w: 1, h: 1 },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[shaftFrame(getVariantFromVoxel(voxel)), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;

        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.shaft);
    },
});

registerItem({
    itemId: "shaft",
    spriteName: "ss_sprite_095.png",
    displayName: "シャフト",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.shaft,
        defaultVariant: 0,
        maxVariant: 1,
        getFieldSpriteName(variant: PlacementVariant) {
            return getShaftPreviewSpriteName(variant);
        },
        onPlace(voxelMap, pos, variant: PlacementVariant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.shaft, { w: 1, h: 1 });
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
        },
    },
});
