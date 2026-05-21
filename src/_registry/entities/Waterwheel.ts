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
import { recomputeAllShaftPowerFlow } from "../../engine/ShaftPowerFlow";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, getVariantFromVoxel, setVariantInVoxel, TERRAIN_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { type PlacementVariant, registerItem } from "../ItemRegistry";

const ENTITY_H_W = 3;
const ENTITY_H_H = 3;
const ENTITY_V_W = 1;
const ENTITY_V_H = 3;

const ANIM_FRAME_MS = 300;

const FRAMES_VERTICAL = ["ss_sprite_137_1.png", "ss_sprite_137_2.png", "ss_sprite_137_3.png"];
const FRAMES_HORIZONTAL = ["ss_sprite_139_1.png", "ss_sprite_139_2.png", "ss_sprite_139_3.png"];

function waterwheelFrame(variant: number): string {
    const frames = variant === 1 ? FRAMES_HORIZONTAL : FRAMES_VERTICAL;
    return frames[Math.floor(Date.now() / ANIM_FRAME_MS) % frames.length];
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
    if (x < 0 || x + ENTITY_H_W > map.width || z < 0 || z + ENTITY_H_H > map.depth) return false;

    if (variant === 0) {
        // 全3タイルが horizonHeight にあること（waterSource も horizonHeight）
        for (let dz = 0; dz < ENTITY_V_H; dz++) {
            const surfacePos = map.getSurfacePosition({ x: x, y: 0, z: z + dz });
            if (surfacePos.y !== map.horizonHeight) return false;
        }
        // 縦方向: 列 x が waterSource
        for (let dz = 0; dz < ENTITY_V_H; dz++) {
            if (!isFreeWaterAt(map, x, z + dz)) return false;
        }
        return true;
    }

    // 横方向：全9タイルが horizonHeight にあること（waterSource も horizonHeight）
    for (let dz = 0; dz < ENTITY_H_H; dz++) {
        for (let dx = 0; dx < ENTITY_H_W; dx++) {
            const surfacePos = map.getSurfacePosition({ x: x + dx, y: 0, z: z + dz });
            if (surfacePos.y !== map.horizonHeight) return false;
        }
    }

    // 横方向 (variant=1): 全てがwaterSource
    for (let dx = 0; dx < ENTITY_H_W; dx++) {
        for (let dz = 0; dz < ENTITY_H_H; dz++) {
            if (!isFreeWaterAt(map, x + dx, z + dz)) {
                return false;
            }
        }
    }
    return true;
}

registerEntity({
    entityType: ENTITY_TYPES.waterwheel,

    getEntitySize(variant: PlacementVariant) {
        switch (variant) {
            case 0:
                return { w: ENTITY_V_W, h: ENTITY_V_H };
            case 1:
                return { w: ENTITY_H_W, h: ENTITY_H_H };
            default:
                return { w: ENTITY_H_W, h: ENTITY_H_H };
        }
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        const variant = getVariantFromVoxel(voxel);
        return [[waterwheelFrame(variant), 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const removed = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.waterwheel);
        if (removed) {
            recomputeAllShaftPowerFlow(ctx.voxelMap);
        }
        return removed;
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
            if (variant === 1) {
                placeFacility(voxelMap, pos, ENTITY_TYPES.waterwheel, { w: ENTITY_H_W, h: ENTITY_H_H });
            } else {
                placeFacility(voxelMap, pos, ENTITY_TYPES.waterwheel, { w: ENTITY_V_W, h: ENTITY_V_H });
            }
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            voxelMap.set(setVariantInVoxel(voxel, variant), surfacePos);
            recomputeAllShaftPowerFlow(voxelMap);
        },
    },
});
