import { ENTITY_TYPES, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

const STATION_SIZE = { w: 1, h: 1 } as const;

// 専用スプライト（doc/09 ID 170）が未作図のため、暫定的に ss_sprite_047 を全方向で流用する。
// 向き（variant）は voxel に保持され搬送ロジックは正しく動作するが、見た目は方向で変わらない。
const STATION_PLACEHOLDER_SPRITE = "ss_sprite_047.png";

registerEntity({
    entityType: ENTITY_TYPES.station,

    getEntitySize() {
        return STATION_SIZE;
    },

    getSprites(_voxel: bigint): EntitySpriteInfo[] {
        return [[STATION_PLACEHOLDER_SPRITE, 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去（ステーションはステートレスなので回収する中身はない）
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.station);
    },
});

registerItem({
    itemId: "station",
    displayName: "ステーション",
    spriteName: STATION_PLACEHOLDER_SPRITE,
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.station,
        defaultVariant: 0,
        maxVariant: 3,
        getFieldSpriteName(_variant: PlacementVariant) {
            return STATION_PLACEHOLDER_SPRITE;
        },
        onPlace(voxelMap, pos, variant: PlacementVariant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.station, STATION_SIZE);
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
        },
    },
});
