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

const TREE_MAX_GROWTH_STAGE = 7;

// ── スプライト定義 ──

const sprites: EntitySpriteInfo[][] = [
    [["ss_sprite_008.png", 0, -2]], // seed
    [["ss_sprite_038.png", 0, 0]],
    [["ss_sprite_039.png", 0, -16]],
    [
        ["ss_sprite_040.png", -8, -16],
        // ["ss_sprite_041.png", 0, 8],
    ],
];

// ── 登録 ──

registerEntity({
    entityType: ENTITY_TYPES.tree,

    getSprites(voxel: number): EntitySpriteInfo[] {
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        if (dayCounter >= 3) {
            return sprites[3];
        }
        return sprites[dayCounter] ?? sprites[0];
    },

    onDailyTick(ctx: DailyTickContext): void {
        const { voxelMap, pos, isWet } = ctx;
        let voxel = ctx.voxel;
        const stage = getCropGrowthStageFromVoxel(voxel);
        if (stage < TREE_MAX_GROWTH_STAGE) {
            voxel = setCropGrowthStageInVoxel(voxel, stage + 1);
        }
        if (isWet) {
            voxel = (voxel & ~0xff) | TERRAIN_TYPES.soil;
        }
        voxelMap.set(voxel, pos);
    },

    onInteract(ctx: InteractionContext): boolean {
        // 伐採: axe で tree を右クリック
        if (ctx.tool !== "axe") return false;

        const leavesCount = 2 + Math.floor(Math.random() * 3); // 2-4
        if (
            !ctx.inventory.addItems([
                { itemId: "trunk", count: 1 },
                { itemId: "leaves", count: leavesCount },
            ])
        )
            return false;
        ctx.voxelMap.set(ctx.voxel & 0x000000ff, ctx.surfacePos);
        return true;
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

        ctx.voxelMap.set(terrainType | (ENTITY_TYPES.tree << 8), ctx.surfacePos);
        ctx.eventBroker.publish("crop_planted", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            cropType: "nuts",
        });
        return true;
    },
});
