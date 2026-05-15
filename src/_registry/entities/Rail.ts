import { ENTITY_TYPES, getVariantFromVoxel, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

function getRailPreviewSpriteName(variant: PlacementVariant): string {
    switch (variant) {
        case 0:
            return "rail_h";
        case 1:
            return "rail_v";
        case 2:
            return "rail_r_1";
        case 3:
            return "rail_r_2";
        case 4:
            return "rail_r_3";
        case 5:
            return "rail_r_4";
        default:
            return "rail_h";
    }
}

registerEntity({
    entityType: ENTITY_TYPES.rail,

    getEntitySize() { return { w: 1, h: 1 }; },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[getRailPreviewSpriteName(getVariantFromVoxel(voxel)), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;

        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.rail);
    },
});

registerItem({
    itemId: "rail",
    spriteName: "rail_h",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.rail,
        defaultVariant: 0,
        maxVariant: 5,
        getFieldSpriteName(variant: PlacementVariant) {
            return getRailPreviewSpriteName(variant);
        },
        onPlace(voxelMap, pos, variant: PlacementVariant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.rail, { w: 1, h: 1 });
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
        },
    },
});
