import { refreshPipeConnectionsAround } from "../../engine/ChannelConnection";
import { getPipeSpriteName } from "../../engine/PipeShape";
import { recomputeAllPipeWaterFlow } from "../../engine/PipeWaterFlow";
import { ENTITY_TYPES, getPipeFilledFromVoxel, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

function getPipePreviewSpriteName(variant: PlacementVariant): string {
    return `pipe1_${variant === 1 ? "v" : "h"}`;
}

registerEntity({
    entityType: ENTITY_TYPES.pipe1,
    entitySize: { w: 1, h: 1 },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[getPipeSpriteName(voxel, getPipeFilledFromVoxel(voxel)), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const removed = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.pipe1);
        if (removed) {
            refreshPipeConnectionsAround(ctx.voxelMap, { x: ctx.surfacePos.x, z: ctx.surfacePos.z });
            recomputeAllPipeWaterFlow(ctx.voxelMap);
        }
        return removed;
    },
});

registerItem({
    itemId: "pipe",
    displayName: "畝間水路",
    spriteName: "pipe1_h",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.pipe1,
        defaultVariant: 0,
        maxVariant: 1,
        getFieldSpriteName(variant: PlacementVariant) {
            return getPipePreviewSpriteName(variant);
        },
        onPlace(voxelMap, pos, variant: PlacementVariant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.pipe1, { w: 1, h: 1 });
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
            refreshPipeConnectionsAround(voxelMap, pos);
            recomputeAllPipeWaterFlow(voxelMap);
        },
    },
});
