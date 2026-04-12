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
    setFatigueInVoxel,
    setFertilizerTypeInVoxel,
    setLastCropInVoxel,
    TERRAIN_TYPES,
} from "../../engine/TerrainDefs";
import { type DailyTickContext, type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

// ── スプライト定義 ──

const seedSprite: EntitySpriteInfo[] = [["ss_sprite_008.png", 0, -2]];
const starSprite: EntitySpriteInfo[] = [["ss_sprite_060.png", 0, -4]];

function cropPositionOf(sprite: string): EntitySpriteInfo {
    return [sprite, 0, -8];
}

const sprites: EntitySpriteInfo[][] = [
    seedSprite,
    [cropPositionOf("ss_sprite_018.png")],
    [cropPositionOf("ss_sprite_019.png")],
    [cropPositionOf("ss_sprite_020.png"), ...starSprite],
    [cropPositionOf("ss_sprite_020.png"), ...starSprite],
    [cropPositionOf("ss_sprite_020.png")],
    [cropPositionOf("ss_sprite_020.png")],
    [cropPositionOf("ss_sprite_061.png")],
];

// ── 登録 ──

registerEntity({
    entityType: ENTITY_TYPES.soy,

    getSprites(voxel: number): EntitySpriteInfo[] {
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        const visualStage = getVisualStage(ENTITY_TYPES.soy, dayCounter);
        return sprites[visualStage] ?? sprites[0];
    },

    onDailyTick(ctx: DailyTickContext): void {
        applyCropDailyTick(ctx, CROP_DEFS[ENTITY_TYPES.soy]);
    },

    onInteract(ctx: InteractionContext): boolean {
        // 収穫: sickle で成熟した soy を右クリック
        if (ctx.tool !== "sickle") return false;

        const voxel = ctx.voxel;
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        const cropDef = CROP_DEFS[ENTITY_TYPES.soy];
        if (dayCounter < cropDef.maturityDay || dayCounter >= cropDef.witherDay) return false;

        const baseCount = 2 + Math.floor(Math.random() * 3); // 2-4
        const fertType = getFertilizerTypeFromVoxel(voxel);
        const fertMultiplier = getFertilizerYieldMultiplier(ENTITY_TYPES.soy, fertType);
        const fatigue = getFatigueFromVoxel(voxel);
        const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
        const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * fatigueMultiplier));

        if (
            !ctx.inventory.addItems([
                { itemId: "soybeans", count: harvestCount },
                { itemId: "stem", count: harvestCount },
            ])
        )
            return false;

        let afterVoxel: number = TERRAIN_TYPES.soil;
        afterVoxel = setLastCropInVoxel(afterVoxel, ENTITY_TYPES.soy);
        afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
        ctx.voxelMap.set(afterVoxel, ctx.surfacePos);

        ctx.eventBroker.publish("crop_harvested", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            itemId: "soy",
            count: harvestCount,
        });
        return true;
    },
});

registerItem({
    itemId: "soybeans",
    spriteName: "ss_sprite_015.png",
    maxStack: 64,
    onItemUse(ctx: InteractionContext): boolean {
        const voxel = ctx.voxel;
        const terrainType = getTerrainTypeFromVoxel(voxel);
        if ((terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) || getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) {
            return false;
        }

        const cropDef = CROP_DEFS[ENTITY_TYPES.soy];
        const lastCrop = getLastCropFromVoxel(voxel);
        let fatigue = getFatigueFromVoxel(voxel);
        if (lastCrop === ENTITY_TYPES.soy) {
            fatigue += 1;
        } else if (lastCrop !== ENTITY_TYPES.none) {
            fatigue = Math.max(0, fatigue - 1);
        }
        if (fatigue >= cropDef.fatigueThreshold) return false;
        if (!ctx.inventory.consumeSelectedItem(1)) return false;

        let newVoxel = terrainType | (ENTITY_TYPES.soy << 8);
        newVoxel = setFatigueInVoxel(newVoxel, fatigue);
        newVoxel = setLastCropInVoxel(newVoxel, ENTITY_TYPES.soy);
        newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
        ctx.voxelMap.set(newVoxel, ctx.surfacePos);

        ctx.eventBroker.publish("crop_planted", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            cropType: "soy",
        });
        return true;
    },
});
