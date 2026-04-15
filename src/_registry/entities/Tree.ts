import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getEntityTypeFromVoxel,
    getTerrainTypeFromVoxel,
    setCropGrowthStageInVoxel,
    TERRAIN_TYPES,
} from "../../engine/TerrainDefs";
import { type DailyTickContext, type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

const TREE_MAX_GROWTH_STAGE = 4;
const LEAVES_STAGE = 4;

// ── スプライト定義 ──

const sprites: EntitySpriteInfo[][] = [
    [["ss_sprite_008.png", 0, -2]], // seed
    [["ss_sprite_038.png", 0, 0]],
    [["ss_sprite_039.png", 0, -16]],
    [
        ["ss_sprite_040.png", -8, -16],
    ],
];

/** 落ち葉あり（stage 15）: 成木 + 落ち葉を重ねて表示 */
const spritesWithLeaves: EntitySpriteInfo[] = [
    ["ss_sprite_040.png", -8, -16],
    ["ss_sprite_041.png", 0, 8],
];

// ── 登録 ──

registerEntity({
    entityType: ENTITY_TYPES.tree,

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        const stage = getCropGrowthStageFromVoxel(voxel);
        if (stage >= LEAVES_STAGE) return spritesWithLeaves;
        if (stage >= 3) return sprites[3];
        return sprites[stage] ?? sprites[0];
    },

    onDailyTick(ctx: DailyTickContext): void {
        const { voxelMap, pos, isWet } = ctx;
        let voxel = ctx.voxel;
        const stage = getCropGrowthStageFromVoxel(voxel);
        if (stage < TREE_MAX_GROWTH_STAGE) {
            voxel = setCropGrowthStageInVoxel(voxel, stage + 1);
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
                    { itemId: "nuts", count: leavesCount },
                ])
            )
                return false;
            ctx.voxelMap.set(ctx.voxel & 0x000000ffn, ctx.surfacePos);
            return true;
        }

        // 落ち葉収集: 素手 + stage 15
        if (ctx.tool === "hand") {
            const stage = getCropGrowthStageFromVoxel(ctx.voxel);
            if (stage < LEAVES_STAGE) return false;
            const leavesCount = 2 + Math.floor(Math.random() * 3); // 2〜4個
            if (!ctx.inventory.addItems([{ itemId: "leaves", count: leavesCount }])) return false;
            // stage を 3 にリセットして再カウント開始
            ctx.voxelMap.set(setCropGrowthStageInVoxel(ctx.voxel, 3), ctx.surfacePos);
            return true;
        }

        return false;
    },
});

registerItem({
    itemId: "nuts",
    spriteName: "ss_sprite_037.png",
    maxStack: 64,
    onItemUse(ctx: InteractionContext): boolean {
        const voxel = ctx.voxel;
        const terrainType = getTerrainTypeFromVoxel(voxel);
        if ((terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) || getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) {
            return false;
        }
        if (!ctx.inventory.consumeSelectedItem(1)) return false;

        ctx.voxelMap.set(BigInt(terrainType) | (BigInt(ENTITY_TYPES.tree) << 8n), ctx.surfacePos);
        ctx.eventBroker.publish("crop_planted", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            cropType: "nuts",
        });
        return true;
    },
});
