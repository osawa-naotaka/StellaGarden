import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getEntityTypeFromVoxel,
    getTerrainTypeFromVoxel,
    TERRAIN_TYPES,
} from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";

// ── スプライト定義 ──

const sprites: EntitySpriteInfo[][] = [
    [["ss_sprite_008.png", 0, -2]], // seed
    [["ss_sprite_038.png", 0, 0]],
    [["ss_sprite_039.png", 0, -16]],
    [
        ["ss_sprite_040.png", -8, -16],
        ["ss_sprite_041.png", 0, 8],
    ],
];

// ── 登録 ──

registerEntity({
    entityType: ENTITY_TYPES.tree,
    itemId: "nuts",

    getSprites(voxel: number): EntitySpriteInfo[] {
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        if (dayCounter >= 3) {
            return sprites[3];
        }
        return sprites[dayCounter] ?? sprites[0];
    },

    onInteract(ctx: InteractionContext): boolean {
        // 伐採: axe で tree を右クリック
        if (ctx.tool !== "axe") return false;

        if (!ctx.inventory.addItem("trunk", 1)) return false;
        ctx.inventory.addItem("leaves", 2 + Math.floor(Math.random() * 3)); // 2-4
        ctx.voxelMap.set(ctx.voxel & 0x000000ff, ctx.surfacePos);
        return true;
    },

    onItemUse(ctx: InteractionContext): boolean {
        // 植え付け: nuts アイテムを soil/wetSoil に使用
        const voxel = ctx.voxel;
        const terrainType = getTerrainTypeFromVoxel(voxel);
        if (
            (terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) ||
            getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none
        ) {
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
