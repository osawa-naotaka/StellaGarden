import { ENTITY_TYPES, setEntityTypeInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, registerMultiTileEntitySize } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const METEORIC_IRON_SIZE = { w: 2, h: 2 } as const;

registerMultiTileEntitySize(ENTITY_TYPES.meteoric_iron, METEORIC_IRON_SIZE);

registerEntity({
    entityType: ENTITY_TYPES.meteoric_iron,

    getEntitySize() {
        return METEORIC_IRON_SIZE;
    },

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_087.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;

        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (anchor.entityType !== ENTITY_TYPES.meteoric_iron) throw new Error("anchor entity type mismatch");

        if (!ctx.inventory.addItems([{ itemId: "meteoric_iron", count: 8 }])) return false;

        // 2x2 の全タイルのエンティティビットをクリアする
        for (let dz = 0; dz < anchor.size.h; dz++) {
            for (let dx = 0; dx < anchor.size.w; dx++) {
                const pos = ctx.voxelMap.getSurfacePosition({ x: anchor.anchorX + dx, z: anchor.anchorZ + dz });
                const v = ctx.voxelMap.get(pos);
                ctx.voxelMap.set(setEntityTypeInVoxel(v, ENTITY_TYPES.none), pos);
            }
        }
        return true;
    },
});

registerItem({ itemId: "meteoric_iron", displayName: "隕鉄", spriteName: "ss_sprite_081.png", maxStack: 64 });
