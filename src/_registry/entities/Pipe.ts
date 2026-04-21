import { refreshPipeConnectionsAround } from "../../engine/ChannelConnection";
import { ENTITY_TYPES, getPipeConnectionsFromVoxel, getPipeVariantFromVoxel, setPipeVariantInVoxel } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

function getPipeSpriteName(variant: PlacementVariant): string {
    return variant === "vertical" ? "pipe1_v" : "pipe1_h";
}

function getPipeSpriteNameFromMask(voxel: bigint): string {
    const mask = getPipeConnectionsFromVoxel(voxel);

    switch (mask) {
        case 0:
            return getPipeVariantFromVoxel(voxel) ? "pipe1_v" : "pipe1_h";
        case 1:
            return "pipe1_end_d";
        case 2:
            return "pipe1_end_u";
        case 4:
            return "pipe1_end_r";
        case 8:
            return "pipe1_end_l";
        case 3:
            return "pipe1_v";
        case 12:
            return "pipe1_h";
        case 9:
            return "pipe1_corner_ld";
        case 5:
            return "pipe1_corner_rd";
        case 10:
            return "pipe1_corner_lu";
        case 6:
            return "pipe1_corner_ru";
        case 13:
            return "pipe1_t_u";
        case 14:
            return "pipe1_t_d";
        case 7:
            return "pipe1_t_l";
        case 11:
            return "pipe1_t_r";
        case 15:
            return "pipe1_cross";
        default:
            return getPipeVariantFromVoxel(voxel) ? "pipe1_v" : "pipe1_h";
    }
}

registerEntity({
    entityType: ENTITY_TYPES.pipe1,

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[getPipeSpriteNameFromMask(voxel), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const removed = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.pipe1);
        if (removed) {
            refreshPipeConnectionsAround(ctx.voxelMap, { x: ctx.surfacePos.x, z: ctx.surfacePos.z });
        }
        return removed;
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "hot_meteoric_iron") return false;
        if (!ctx.inventory.addItems([{ itemId: "blade", count: 1 }])) return false;
        ctx.inventory.consumeSelectedItem(1);
        return true;
    },
});

registerItem({
    itemId: "pipe",
    spriteName: "pipe1_h",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.pipe1,
        entitySize: { w: 1, h: 1 },
        defaultVariant: "horizontal",
        getFieldSpriteName(variant: PlacementVariant) {
            return getPipeSpriteName(variant);
        },
        onPlace(voxelMap, pos, variant: PlacementVariant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.pipe1, { w: 1, h: 1 });
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setPipeVariantInVoxel(voxel, variant === "vertical"), surfacePos);
            refreshPipeConnectionsAround(voxelMap, pos);
        },
    },
});
