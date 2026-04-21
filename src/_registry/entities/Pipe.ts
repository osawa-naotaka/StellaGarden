import { ENTITY_TYPES, getPipeVariantFromVoxel, setPipeVariantInVoxel } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

function getPipeSpriteName(variant: PlacementVariant): string {
    return variant === "vertical" ? "pipe1_v" : "pipe1_h";
}

registerEntity({
    entityType: ENTITY_TYPES.pipe1,

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        return [[getPipeVariantFromVoxel(voxel) ? "pipe1_v" : "pipe1_h", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.pipe1);
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
        },
    },
});
