import {
    ENTITY_TYPES,
    getDaysElapsedFromVoxel,
    getEntityTypeFromVoxel,
    getTerrainTypeFromVoxel,
    setDaysElapsedInVoxel,
    setEntityTypeInVoxel,
    TERRAIN_TYPES,
} from "../../engine/VoxelDefs";
import { type DailyTickContext, type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

const TREE_MAX_GROWTH_STAGE = 15;
const LEAVES_STAGE = 15;

// ── スプライト定義 ──

const sprites: EntitySpriteInfo[][] = [
    [["ss_sprite_008.png", 0, -4]], // seed
    [["ss_sprite_038.png", 0, 0]],
    [["ss_sprite_039.png", 0, -32]],
    [["ss_sprite_040.png", -16, -32]],
];

/** 落ち葉あり（stage 15）: 成木 + 落ち葉を重ねて表示 */
const spritesWithLeaves: EntitySpriteInfo[] = [
    ["ss_sprite_040.png", -16, -32],
    ["ss_sprite_041.png", 0, 16],
];

// ── 登録 ──

registerEntity({
    entityType: ENTITY_TYPES.tree,

    getEntitySize() {
        return { w: 1, h: 1 };
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        const stage = getDaysElapsedFromVoxel(voxel);
        if (stage >= LEAVES_STAGE) return spritesWithLeaves;
        if (stage <= 0) {
            return sprites[0];
        } else if (stage <= 6) {
            return sprites[1];
        } else if (stage <= 10) {
            return sprites[2];
        }

        return sprites[3];
    },

    onDailyTick(ctx: DailyTickContext): void {
        const { voxelMap, pos, isWet } = ctx;
        let voxel = ctx.voxel;
        const stage = getDaysElapsedFromVoxel(voxel);
        if (stage < TREE_MAX_GROWTH_STAGE) {
            voxel = setDaysElapsedInVoxel(voxel, stage + 1);
        }
        if (isWet) {
            voxel = (voxel & ~0xffn) | BigInt(TERRAIN_TYPES.soil);
        }
        voxelMap.set(voxel, pos);
    },

    onInteract(ctx: InteractionContext): boolean {
        // 伐採: axe で tree
        if (ctx.tool === "axe") {
            const leavesCount = 2 + Math.floor(Math.random() * 3); // 2-4
            if (
                !ctx.inventory.addItems([
                    { itemId: "trunk", count: 1 },
                    { itemId: "leaves", count: leavesCount },
                ])
            )
                return false;
            ctx.voxelMap.set(ctx.voxel & 0x000000ffn, ctx.surfacePos);
            return true;
        }

        // 落ち葉収集: 素手 + stage 15
        if (ctx.tool === "hand") {
            const stage = getDaysElapsedFromVoxel(ctx.voxel);
            if (stage < LEAVES_STAGE) return false;
            const leavesCount = 2 + Math.floor(Math.random() * 3); // 2〜4個
            if (
                !ctx.inventory.addItems([
                    { itemId: "leaves", count: leavesCount },
                    { itemId: "nuts", count: 1 },
                ])
            )
                return false;
            // stage を 3 にリセットして再カウント開始
            ctx.voxelMap.set(setDaysElapsedInVoxel(ctx.voxel, 11), ctx.surfacePos);
            return true;
        }

        return false;
    },
});

registerItem({
    itemId: "nuts",
    displayName: "木の実",
    spriteName: "ss_sprite_037.png",
    maxStack: 64,
    onItemUse(ctx: InteractionContext): boolean {
        const voxel = ctx.voxel;
        const terrainType = getTerrainTypeFromVoxel(voxel);
        if ((terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) || getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) {
            return false;
        }
        if (!ctx.inventory.consumeSelectedItem(1)) return false;

        ctx.voxelMap.set(setEntityTypeInVoxel(voxel, ENTITY_TYPES.tree), ctx.surfacePos);
        ctx.eventBroker.publish("crop_planted", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            cropType: "nuts",
        });
        return true;
    },
});
