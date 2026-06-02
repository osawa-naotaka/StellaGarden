import { refreshShaftConnectionsAround } from "../../engine/ShaftConnection";
import { recomputeAllShaftPowerFlow } from "../../engine/ShaftPowerFlow";
import { getShaftSpriteName } from "../../engine/ShaftShape";
import { ENTITY_TYPES, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

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

    getEntitySize() {
        return { w: 1, h: 1 };
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[getShaftSpriteName(voxel), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;

        const removed = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.shaft);
        if (removed) {
            refreshShaftConnectionsAround(ctx.voxelMap, { x: ctx.surfacePos.x, z: ctx.surfacePos.z });
            recomputeAllShaftPowerFlow(ctx.voxelMap);
        }
        return removed;
    },
});

registerItem({
    itemId: "shaft",
    spriteName: "ss_sprite_131.png",
    // spriteName: "ss_sprite_095.png",
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
            refreshShaftConnectionsAround(voxelMap, pos);
            recomputeAllShaftPowerFlow(voxelMap);
        },
    },
});
