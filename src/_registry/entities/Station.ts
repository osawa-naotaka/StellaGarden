import { PIXEL_PER_TILE } from "../../_boundary/constants";
import { ENTITY_TYPES, getVariantFromVoxel, setVariantInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

const STATION_SIZE = { w: 1, h: 1 } as const;

// 専用スプライト（doc/09 ID 170/171）が未作図のため、暫定的に既存スプライトを流用する。
// 向き（variant）は voxel に保持され搬送ロジックは正しく動作する。
const STATION_PLACEHOLDER_SPRITE = "ss_sprite_047.png";
const FORK_PLACEHOLDER_SPRITE = "ss_sprite_051.png";

// フォーク休止辺（= 向き）を常時表示するためのオフセット（タイル単位 16px）。
// variant 0=up, 1=down, 2=left, 3=right。隣接タイル上にフォークを描いて向きを示す。
// （StationForkView の搬送アニメ開始位置 restCenter と同じ位置）
const FORK_REST_OFFSETS: ReadonlyArray<readonly [number, number]> = [
    [0, -PIXEL_PER_TILE], // up
    [0, PIXEL_PER_TILE], // down
    [-PIXEL_PER_TILE, 0], // left
    [PIXEL_PER_TILE, 0], // right
];

registerEntity({
    entityType: ENTITY_TYPES.station,

    getEntitySize() {
        return STATION_SIZE;
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        const variant = getVariantFromVoxel(voxel);
        const [fx, fy] = FORK_REST_OFFSETS[variant] ?? FORK_REST_OFFSETS[0];
        // 本体 + 休止位置のフォーク（向きの可視化）
        return [
            [STATION_PLACEHOLDER_SPRITE, 0, 0],
            [FORK_PLACEHOLDER_SPRITE, fx, fy],
        ];
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
            const surfacePos = voxelMap.getSurfacePosition(pos);
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
        },
    },
});
