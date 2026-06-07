import { refreshRailConnectionsAround } from "../../engine/RailConnection";
import { getRailSpriteName } from "../../engine/RailShape";
import { recomputeAllRailTractionFlow } from "../../engine/RailTractionFlow";
import { ENTITY_TYPES, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

function getRailPreviewSpriteName(variant: PlacementVariant): string {
    switch (variant) {
        case 0:
            return "rail_h";
        case 1:
            return "rail_v";
        default:
            return "rail_h";
    }
}

registerEntity({
    entityType: ENTITY_TYPES.rail,

    getEntitySize() {
        return { w: 1, h: 1 };
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[getRailSpriteName(voxel), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;

        const result = removeFacilityByContext(ctx);
        if (result) {
            refreshRailConnectionsAround(ctx.voxelMap, ctx.interactPos);
            recomputeAllRailTractionFlow(ctx.voxelMap);
        }

        return result;
    },
});

registerItem({
    itemId: "rail",
    displayName: "レール",
    spriteName: "rail_h",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.rail,
        defaultVariant: 0,
        maxVariant: 1,
        getFieldSpriteName(variant: PlacementVariant) {
            return getRailPreviewSpriteName(variant);
        },
        onPlace(voxelMap, pos, variant: PlacementVariant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.rail, { w: 1, h: 1 });
            const surfacePos = voxelMap.getSurfacePosition(pos);
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
            refreshRailConnectionsAround(voxelMap, pos);
            recomputeAllRailTractionFlow(voxelMap);
        },
    },
});
