import { ENTITY_TYPES, getCropGrowthStageFromVoxel, setCropGrowthStageInVoxel, setEntityTypeInVoxel } from "../../engine/TerrainDefs";
import { type DailyTickContext, type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility } from "../facilityUtil";
import { registerItem, registerItemAlias } from "../ItemRegistry";

// ── 稼働中アニメーション用スプライトテーブル ──

const BURNING_SPRITES: EntitySpriteInfo[][] = [[["ss_sprite_078_1.png", 0, 0]], [["ss_sprite_078_2.png", 0, 0]], [["ss_sprite_078_3.png", 0, 0]]];
const ANIM_FRAME_MS = 300;

/** 消火状態になるまでの日数 */
const BURN_DAYS = 4;

// ── 炭焼き窯（稼働中）──

registerEntity({
    entityType: ENTITY_TYPES.kiln_burning,

    getSprites(): EntitySpriteInfo[] {
        const frame = Math.floor(Date.now() / ANIM_FRAME_MS) % 3;
        return BURNING_SPRITES[frame];
    },

    onDailyTick(ctx: DailyTickContext): void {
        const stage = getCropGrowthStageFromVoxel(ctx.voxel);
        if (stage >= BURN_DAYS - 1) {
            // 4日経過: 消火状態へ遷移
            ctx.voxelMap.set(setEntityTypeInVoxel(ctx.voxel, ENTITY_TYPES.kiln), ctx.pos);
        } else {
            ctx.voxelMap.set(setCropGrowthStageInVoxel(ctx.voxel, stage + 1), ctx.pos);
        }
    },
    // 稼働中は操作不可
});

// ── 炭焼き窯（消火状態）──

registerEntity({
    entityType: ENTITY_TYPES.kiln,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_077.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // スコップで窯を崩し、木炭を回収（窯は消滅、使い捨て）
        if (ctx.tool !== "shovel") return false;

        // facility_part タイルからでも正しくアンカー座標を解決する
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (!anchor) return false;
        if (
            !ctx.inventory.addItems([
                { itemId: "charcoal", count: 12 },
                { itemId: "dirt", count: 2 },
            ])
        )
            return false;
        // 2x2 の全タイルのエンティティビットをクリアする
        for (let dz = 0; dz < 2; dz++) {
            for (let dx = 0; dx < 2; dx++) {
                const pos = ctx.voxelMap.getSurfacePosition({ x: anchor.anchorX + dx, y: 0, z: anchor.anchorZ + dz });
                ctx.voxelMap.set(ctx.voxelMap.get(pos) & 0xffn, pos);
            }
        }
        return true;
    },
});

// ── アイテム登録（配置すると即稼働中になる）──

registerItem({
    itemId: "kiln",
    displayName: "炭焼き窯",
    spriteName: "ss_sprite_068.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.kiln_burning,
        entitySize: { w: 2, h: 2 },
        fieldSpriteName: "ss_sprite_078_1.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.kiln_burning, { w: 2, h: 2 });
        },
    },
});

// 消火状態（kiln）でも findFacilityAnchor がアンカーを解決できるように登録する
registerItemAlias(ENTITY_TYPES.kiln, "kiln");
