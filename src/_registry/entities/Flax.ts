import { CROP_DEFS, getFertilizerYieldMultiplier, getVisualStage } from "../../engine/CropDefs";
import { applyCropDailyTick } from "../../engine/CropSystem";
import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getEntityTypeFromVoxel,
    getFatigueFromVoxel,
    getFertilizerTypeFromVoxel,
    getLastCropFromVoxel,
    getTerrainTypeFromVoxel,
    initializeVoxel,
    setEntityTypeInVoxel,
    setFatigueInVoxel,
    setFertilizerTypeInVoxel,
    setLastCropInVoxel,
    TERRAIN_TYPES,
} from "../../engine/TerrainDefs";
import { type DailyTickContext, type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

// ── スプライト定義 ──

const seedSprite: EntitySpriteInfo[] = [["ss_sprite_008.png", 0, -4]];
const starSprite: EntitySpriteInfo[] = [["ss_sprite_060.png", 0, -8]];

function cropPositionOf(sprite: string): EntitySpriteInfo {
    return [sprite, 0, -16];
}

const sprites: EntitySpriteInfo[][] = [
    seedSprite,
    [cropPositionOf("ss_sprite_029.png")],
    [cropPositionOf("ss_sprite_030.png")],
    [cropPositionOf("ss_sprite_031.png"), ...starSprite],
    [cropPositionOf("ss_sprite_031.png"), ...starSprite],
    [cropPositionOf("ss_sprite_031.png")],
    [cropPositionOf("ss_sprite_031.png")],
    [cropPositionOf("ss_sprite_061.png")],
];

// ── 登録 ──

registerEntity({
    entityType: ENTITY_TYPES.flax,

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        const visualStage = getVisualStage(ENTITY_TYPES.flax, dayCounter);
        return sprites[visualStage] ?? sprites[0];
    },

    onDailyTick(ctx: DailyTickContext): void {
        applyCropDailyTick(ctx, CROP_DEFS[ENTITY_TYPES.flax]);
    },

    onInteract(ctx: InteractionContext): boolean {
        // 収穫: shovel で成熟した flax を右クリック
        if (ctx.tool !== "shovel") return false;

        const voxel = ctx.voxel;
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        const cropDef = CROP_DEFS[ENTITY_TYPES.flax];
        if (dayCounter < cropDef.maturityDay || dayCounter >= cropDef.witherDay) return false;

        const baseCount = 2 + Math.floor(Math.random() * 3); // 2-4
        const fertType = getFertilizerTypeFromVoxel(voxel);
        const fertMultiplier = getFertilizerYieldMultiplier(ENTITY_TYPES.flax, fertType);
        const fatigue = getFatigueFromVoxel(voxel);
        const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
        const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * fatigueMultiplier));

        if (
            !ctx.inventory.addItems([
                { itemId: "flaxseed", count: harvestCount },
                { itemId: "flax_stalk", count: harvestCount },
            ])
        )
            return false;

        let afterVoxel = initializeVoxel(TERRAIN_TYPES.soil);
        afterVoxel = setLastCropInVoxel(afterVoxel, ENTITY_TYPES.flax);
        afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
        ctx.voxelMap.set(afterVoxel, ctx.surfacePos);

        ctx.eventBroker.publish("crop_harvested", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            itemId: "flax",
            count: harvestCount,
        });
        return true;
    },
});

registerItem({
    itemId: "flaxseed",
    spriteName: "ss_sprite_021.png",
    maxStack: 64,
    onItemUse(ctx: InteractionContext): boolean {
        if (ctx.entityType === ENTITY_TYPES.screw_presses) {
            if (
                !ctx.inventory.addItems([
                    { itemId: "flaxseed_oil", count: 1 },
                    { itemId: "oil_cake", count: 1 },
                ])
            )
                return false;
            ctx.inventory.consumeSelectedItem(1);
            return true;
        }

        const voxel = ctx.voxel;
        const terrainType = getTerrainTypeFromVoxel(voxel);
        if ((terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) || getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) {
            return false;
        }

        const cropDef = CROP_DEFS[ENTITY_TYPES.flax];
        const lastCrop = getLastCropFromVoxel(voxel);
        let fatigue = getFatigueFromVoxel(voxel);
        if (lastCrop === ENTITY_TYPES.flax) {
            fatigue += 1;
        } else if (lastCrop !== ENTITY_TYPES.none) {
            fatigue = Math.max(0, fatigue - 1);
        }
        if (fatigue >= cropDef.fatigueThreshold) return false;
        if (!ctx.inventory.consumeSelectedItem(1)) return false;

        let newVoxel = initializeVoxel(terrainType);
        newVoxel = setEntityTypeInVoxel(newVoxel, ENTITY_TYPES.flax);
        newVoxel = setFatigueInVoxel(newVoxel, fatigue);
        newVoxel = setLastCropInVoxel(newVoxel, ENTITY_TYPES.flax);
        newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
        ctx.voxelMap.set(newVoxel, ctx.surfacePos);

        ctx.eventBroker.publish("crop_planted", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            cropType: "flax",
        });
        return true;
    },
});
