import { refreshFurrowCanalConnectionsAround } from "../../engine/FurrowCanalConnection";
import { getFurrowCanalSpriteName } from "../../engine/FurrowCanalShape";
import { recomputeAllFullowCanalWaterFlow } from "../../engine/FurrowCanalWaterFlow";
import { ENTITY_TYPES, getEnabledFromVoxel, getVariantFromVoxel, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacility } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

function getFullowCanalPreviewSpriteName(variant: PlacementVariant): string {
    return `pipe1_${variant === 1 ? "v" : "h"}`;
}

registerEntity({
    entityType: ENTITY_TYPES.furrow_canal,

    getEntitySize() {
        return { w: 1, h: 1 };
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[getFurrowCanalSpriteName(voxel, getEnabledFromVoxel(voxel)), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const removed = removeFacility(ctx.voxelMap, ctx.inventory, ctx.interactPos, ENTITY_TYPES.furrow_canal, getVariantFromVoxel(ctx.voxel));
        if (removed) {
            refreshFurrowCanalConnectionsAround(ctx.voxelMap, {
                x: ctx.interactPos.x,
                z: ctx.interactPos.z,
            });
            recomputeAllFullowCanalWaterFlow(ctx.voxelMap);
        }
        return removed;
    },
});

registerItem({
    itemId: "furrow_canal",
    displayName: "畝間水路",
    spriteName: "pipe1_h",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.furrow_canal,
        defaultVariant: 0,
        maxVariant: 1,
        getFieldSpriteName(variant: PlacementVariant) {
            return getFullowCanalPreviewSpriteName(variant);
        },
        onPlace(voxelMap, pos, variant: PlacementVariant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.furrow_canal, {
                w: 1,
                h: 1,
            });
            const surfacePos = voxelMap.getSurfacePosition(pos);
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
            refreshFurrowCanalConnectionsAround(voxelMap, pos);
            recomputeAllFullowCanalWaterFlow(voxelMap);
        },
    },
});
