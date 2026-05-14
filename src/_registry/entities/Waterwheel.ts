/**
 * 水車（動力源）のエンティティ登録。
 *
 * - サイズ: 3x3（48x48）固定。縦方向(variant=0)・横方向(variant=1)の2向きを variant ビットで保持。
 * - 配置条件: 中央列（縦方向）または中央行（横方向）が waterSource、その左右（または上下）の
 *   少なくとも一方の列／行が grass/dirt の上に乗ること。全タイルの surface y が同一であること。
 * - アニメーション: 3フレームループ。forge_burning / bonfire_lit と同じ Date.now() ベース。
 * - 操作: 左クリック + axe で撤去（インベントリに回収）。
 */
import type { IVoxelReader, Pos2D } from "../../_boundary/interfaces";
import {
    ENTITY_TYPES,
    getEntityTypeFromVoxel,
    getTerrainTypeFromVoxel,
    getVariantFromVoxel,
    setVariantInVoxel,
    TERRAIN_TYPES,
} from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

const ENTITY_W = 3;
const ENTITY_H = 3;

const ANIM_FRAME_MS = 300;

const FRAMES_VERTICAL = ["ss_sprite_137_1.png", "ss_sprite_137_2.png", "ss_sprite_137_3.png"];
const FRAMES_HORIZONTAL = ["ss_sprite_139_1.png", "ss_sprite_139_2.png", "ss_sprite_139_3.png"];

function waterwheelFrame(variant: number): string {
    const frames = variant === 1 ? FRAMES_HORIZONTAL : FRAMES_VERTICAL;
    return frames[Math.floor(Date.now() / ANIM_FRAME_MS) % frames.length];
}

const LAND_TERRAINS: ReadonlySet<number> = new Set([TERRAIN_TYPES.grass, TERRAIN_TYPES.dirt]);

/** (x,z) の surface が land (grass/dirt) かつ entity none かどうか。 */
function isFreeLandAt(map: IVoxelReader, x: number, z: number): boolean {
    const voxel = map.getSurface({ x, y: 0, z });
    if (!LAND_TERRAINS.has(getTerrainTypeFromVoxel(voxel))) return false;
    if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) return false;
    return true;
}

/** waterSource タイルが空エンティティかどうか。 */
function isFreeWaterAt(map: IVoxelReader, x: number, z: number): boolean {
    const voxel = map.getSurface({ x, y: 0, z });
    const terrainType = getTerrainTypeFromVoxel(voxel);
    if (!(terrainType === TERRAIN_TYPES.waterSource || terrainType === TERRAIN_TYPES.water)) return false;
    if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) return false;
    return true;
}

/** 水車の配置可否を判定する。 */
function canPlaceWaterwheel(map: IVoxelReader, pos: Pos2D, variant: PlacementVariant): boolean {
    const { x, z } = pos;
    if (x < 0 || x + ENTITY_W > map.width || z < 0 || z + ENTITY_H > map.depth) return false;

    // 全9タイルが horizonHeight にあること（waterSource も horizonHeight）
    for (let dz = 0; dz < ENTITY_H; dz++) {
        for (let dx = 0; dx < ENTITY_W; dx++) {
            const surfacePos = map.getSurfacePosition({ x: x + dx, y: 0, z: z + dz });
            if (surfacePos.y !== map.horizonHeight) return false;
        }
    }

    if (variant === 0) {
        // 縦方向: 中央列 x+1 が waterSource、左列 x または右列 x+2 のどちらか1列が land
        for (let dz = 0; dz < ENTITY_H; dz++) {
            if (!isFreeWaterAt(map, x + 1, z + dz)) return false;
        }
        const leftIsLand = isFreeLandAt(map, x, z) && isFreeLandAt(map, x, z + 1) && isFreeLandAt(map, x, z + 2);
        const rightIsLand = isFreeLandAt(map, x + 2, z) && isFreeLandAt(map, x + 2, z + 1) && isFreeLandAt(map, x + 2, z + 2);
        if (!leftIsLand && !rightIsLand) return false;
        // land でない側は waterSource（空）であること
        if (!leftIsLand) {
            if (!(isFreeWaterAt(map, x, z) && isFreeWaterAt(map, x, z + 1) && isFreeWaterAt(map, x, z + 2))) return false;
        }
        if (!rightIsLand) {
            if (!(isFreeWaterAt(map, x + 2, z) && isFreeWaterAt(map, x + 2, z + 1) && isFreeWaterAt(map, x + 2, z + 2))) return false;
        }
        return true;
    }

    // 横方向 (variant=1): 全てがwaterSource
    for (let dx = 0; dx < ENTITY_W; dx++) {
        for (let dz = 0; dz < ENTITY_H; dz++) {
            if (!isFreeWaterAt(map, x + dx, z + dz)) {
                return false;
            }
        }
    }
    return true;
}

registerEntity({
    entityType: ENTITY_TYPES.waterwheel,
    entitySize: { w: ENTITY_W, h: ENTITY_H },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        const variant = getVariantFromVoxel(voxel);
        return [[waterwheelFrame(variant), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.waterwheel);
    },
});

registerItem({
    itemId: "waterwheel",
    displayName: "水車",
    spriteName: "ss_sprite_137_1.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.waterwheel,
        defaultVariant: 0,
        maxVariant: 1,
        getFieldSpriteName(variant: PlacementVariant) {
            return variant === 1 ? FRAMES_HORIZONTAL[0] : FRAMES_VERTICAL[0];
        },
        canPlace(voxelMap, pos, variant) {
            return canPlaceWaterwheel(voxelMap, pos, variant);
        },
        onPlace(voxelMap, pos, variant) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.waterwheel, { w: ENTITY_W, h: ENTITY_H });
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
        },
    },
});
