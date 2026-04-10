import { CROP_DEFS, getFertilizerYieldMultiplier, getVisualStage } from "../../engine/CropDefs";
import { applyCropDailyTick } from "../../engine/CropSystem";
import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getDroughtCounterFromVoxel,
    getEntityTypeFromVoxel,
    getFatigueFromVoxel,
    getFertilizerTypeFromVoxel,
    getLastCropFromVoxel,
    getTerrainTypeFromVoxel,
    setFatigueInVoxel,
    setFertilizerTypeInVoxel,
    setLastCropInVoxel,
    TERRAIN_TYPES,
} from "../../engine/TerrainDefs";
import { registerEntity, type DailyTickContext, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

// ── スプライト定義 ──

const seedSprite: EntitySpriteInfo[] = [["ss_sprite_008.png", 0, -2]];
const starSprite: EntitySpriteInfo[] = [["ss_sprite_060.png", 0, -4]];

function cropPositionOf(sprite: string): EntitySpriteInfo {
    return [sprite, 0, -8];
}

const sprites: EntitySpriteInfo[][] = [
    seedSprite,
    [cropPositionOf("ss_sprite_010.png")],
    [cropPositionOf("ss_sprite_011.png")],
    [cropPositionOf("ss_sprite_012.png"), ...starSprite],
    [cropPositionOf("ss_sprite_012.png"), ...starSprite],
    [cropPositionOf("ss_sprite_012.png")],
    [cropPositionOf("ss_sprite_012.png")],
    [cropPositionOf("ss_sprite_061.png")],
];

// ── 登録 ──

registerEntity({
    entityType: ENTITY_TYPES.potato,

    getSprites(voxel: number): EntitySpriteInfo[] {
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        const visualStage = getVisualStage(ENTITY_TYPES.potato, dayCounter);
        return sprites[visualStage] ?? sprites[0];
    },

    onDailyTick(ctx: DailyTickContext): void {
        applyCropDailyTick(ctx, CROP_DEFS[ENTITY_TYPES.potato]);
    },

    onInteract(ctx: InteractionContext): boolean {
        // 収穫: shovel で成熟した potato を右クリック
        if (ctx.tool !== "shovel") return false;

        const voxel = ctx.voxel;
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        const cropDef = CROP_DEFS[ENTITY_TYPES.potato];
        if (dayCounter < cropDef.maturityDay || dayCounter >= cropDef.witherDay) return false;

        const baseCount = 2 + Math.floor(Math.random() * 3); // 2-4
        const fertType = getFertilizerTypeFromVoxel(voxel);
        const fertMultiplier = getFertilizerYieldMultiplier(ENTITY_TYPES.potato, fertType);
        const wateredCount = getDroughtCounterFromVoxel(voxel);
        const waterBonus = 1.0 + wateredCount * 0.1;
        const fatigue = getFatigueFromVoxel(voxel);
        const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
        const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * waterBonus * fatigueMultiplier));

        if (!ctx.inventory.addItems([{ itemId: "potato", count: harvestCount }, { itemId: "stem", count: harvestCount }])) return false;

        let afterVoxel: number = TERRAIN_TYPES.soil;
        afterVoxel = setLastCropInVoxel(afterVoxel, ENTITY_TYPES.potato);
        afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
        ctx.voxelMap.set(afterVoxel, ctx.surfacePos);

        ctx.eventBroker.publish("crop_harvested", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            itemId: "potato",
            count: harvestCount,
        });
        return true;
    },

});

registerItem({
    itemId: "potato",
    spriteName: "ss_sprite_009.png",
    maxStack: 64,
    onItemUse(ctx: InteractionContext): boolean {
        // 植え付け: potato アイテムを soil/wetSoil に使用
        const voxel = ctx.voxel;
        const terrainType = getTerrainTypeFromVoxel(voxel);
        if (
            (terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) ||
            getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none
        ) {
            return false;
        }

        const cropDef = CROP_DEFS[ENTITY_TYPES.potato];
        const lastCrop = getLastCropFromVoxel(voxel);
        let fatigue = getFatigueFromVoxel(voxel);
        if (lastCrop === ENTITY_TYPES.potato) {
            fatigue += 1;
        } else if (lastCrop !== ENTITY_TYPES.none) {
            fatigue = Math.max(0, fatigue - 1);
        }
        if (fatigue >= cropDef.fatigueThreshold) return false;
        if (!ctx.inventory.consumeSelectedItem(1)) return false;

        let newVoxel = terrainType | (ENTITY_TYPES.potato << 8);
        newVoxel = setFatigueInVoxel(newVoxel, fatigue);
        newVoxel = setLastCropInVoxel(newVoxel, ENTITY_TYPES.potato);
        newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
        ctx.voxelMap.set(newVoxel, ctx.surfacePos);

        ctx.eventBroker.publish("crop_planted", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            cropType: "potato",
        });
        return true;
    },
});
