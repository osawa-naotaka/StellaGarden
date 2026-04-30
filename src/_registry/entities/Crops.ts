import { CROP_DEFS, getFertilizerYieldMultiplier, getVisualStage } from "../../engine/CropDefs";
import { applyCropDailyTick } from "../../engine/CropSystem";
import type { ItemId } from "../../engine/ItemDefs";
import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getDroughtCounterFromVoxel,
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
    return [sprite, 0, -8];
}

const potetoSprites: EntitySpriteInfo[][] = [
    seedSprite,
    [cropPositionOf("ss_sprite_010.png")],
    [cropPositionOf("ss_sprite_011.png")],
    [cropPositionOf("ss_sprite_012.png"), ...starSprite],
    [cropPositionOf("ss_sprite_012.png"), ...starSprite],
    [cropPositionOf("ss_sprite_012.png")],
    [cropPositionOf("ss_sprite_012.png")],
    [cropPositionOf("ss_sprite_061.png")],
];

const flaxSprites: EntitySpriteInfo[][] = [
    seedSprite,
    [cropPositionOf("ss_sprite_029.png")],
    [cropPositionOf("ss_sprite_030.png")],
    [cropPositionOf("ss_sprite_031.png"), ...starSprite],
    [cropPositionOf("ss_sprite_031.png"), ...starSprite],
    [cropPositionOf("ss_sprite_031.png")],
    [cropPositionOf("ss_sprite_031.png")],
    [cropPositionOf("ss_sprite_061.png")],
];

const soySprites: EntitySpriteInfo[][] = [
    seedSprite,
    [cropPositionOf("ss_sprite_018.png")],
    [cropPositionOf("ss_sprite_019.png")],
    [cropPositionOf("ss_sprite_020.png"), ...starSprite],
    [cropPositionOf("ss_sprite_020.png"), ...starSprite],
    [cropPositionOf("ss_sprite_020.png")],
    [cropPositionOf("ss_sprite_020.png")],
    [cropPositionOf("ss_sprite_061.png")],
];

const sunflowerSprites: EntitySpriteInfo[][] = [
    seedSprite,
    [cropPositionOf("ss_sprite_033.png")],
    [cropPositionOf("ss_sprite_033.png")],
    [cropPositionOf("ss_sprite_034.png"), ...starSprite],
    [cropPositionOf("ss_sprite_034.png"), ...starSprite],
    [cropPositionOf("ss_sprite_035.png")],
    [cropPositionOf("ss_sprite_035.png")],
    [cropPositionOf("ss_sprite_061.png")],
];

type HarvestFn = (num: number) => { itemId: ItemId; count: number }[];

// ── 登録 ──
export function registerCrop(entityType: number, itemId: ItemId, sprites: EntitySpriteInfo[][], itemSprite: string, harvestFn: HarvestFn, oilItemId: ItemId | null = null): void {
    const cropDef = CROP_DEFS[entityType];
    if (!cropDef) throw new Error(`Crop entity type ${entityType} not found`);

    registerEntity({
        entityType: entityType,
    
        getSprites(voxel: bigint): EntitySpriteInfo[] {
            const dayCounter = getCropGrowthStageFromVoxel(voxel);
            const visualStage = getVisualStage(entityType, dayCounter);
            return sprites[visualStage] ?? sprites[0];
        },
    
        onDailyTick(ctx: DailyTickContext): void {
            applyCropDailyTick(ctx, cropDef);
        },
    
        onInteract(ctx: InteractionContext): boolean {
            // 収穫: sickel で成熟した crop を右クリック
            if (ctx.tool !== "sickle") return false;
    
            const voxel = ctx.voxel;
            const dayCounter = getCropGrowthStageFromVoxel(voxel);
            if (dayCounter < cropDef.maturityDay || dayCounter >= cropDef.witherDay) return false;
    
            const baseCount = 2 + Math.random() * 3; // 2-4
            const fertType = getFertilizerTypeFromVoxel(voxel);
            const fertMultiplier = getFertilizerYieldMultiplier(entityType, fertType);
            const wateredCount = getDroughtCounterFromVoxel(voxel);
            const waterBonus = 1.0 + wateredCount * 0.1;
            const fatigue = getFatigueFromVoxel(voxel);
            const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
            const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * waterBonus * fatigueMultiplier));
    
            if (!ctx.inventory.addItems(harvestFn(harvestCount))) return false;
    
            let afterVoxel: bigint = initializeVoxel(getTerrainTypeFromVoxel(voxel));
            afterVoxel = setLastCropInVoxel(afterVoxel, entityType);
            afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
            ctx.voxelMap.set(afterVoxel, ctx.surfacePos);
    
            ctx.eventBroker.publish("crop_harvested", {
                pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
                itemId,
                count: harvestCount,
            });
            return true;
        },
    });
    
    registerItem({
        itemId,
        spriteName: itemSprite,
        maxStack: 64,
        onItemUse(ctx: InteractionContext): boolean {
            // 油を絞れる場合
            if (oilItemId) {
                if (ctx.entityType === ENTITY_TYPES.screw_presses) {
                    const count = 8;
                    if (!ctx.inventory.canConsumeSelectedItem(count)) return false;
                    if (
                        !ctx.inventory.addItems([
                            { itemId: oilItemId, count: 1 },
                            { itemId: "oil_cake", count: 1 },
                        ])
                    )
                        return false;
                    ctx.inventory.consumeSelectedItem(count);
                    return true;
                }
            }
            
            // 植え付け: アイテムを soil/wetSoil に使用
            const voxel = ctx.voxel;
            const terrainType = getTerrainTypeFromVoxel(voxel);
            if ((terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) || getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) {
                return false;
            }
    
            const lastCrop = getLastCropFromVoxel(voxel);
            let fatigue = getFatigueFromVoxel(voxel);
            if (lastCrop === entityType) {
                fatigue += 1;
            } else if (lastCrop !== ENTITY_TYPES.none) {
                fatigue = Math.max(0, fatigue - 1);
            }
            if (fatigue >= cropDef.fatigueThreshold) return false;
            if (!ctx.inventory.consumeSelectedItem(1)) return false;
    
            let newVoxel = initializeVoxel(terrainType);
            newVoxel = setEntityTypeInVoxel(newVoxel, entityType);
            newVoxel = setFatigueInVoxel(newVoxel, fatigue);
            newVoxel = setLastCropInVoxel(newVoxel, entityType);
            newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
            ctx.voxelMap.set(newVoxel, ctx.surfacePos);
    
            ctx.eventBroker.publish("crop_planted", {
                pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
                cropType: itemId,
            });
            return true;
        },
    });
}

registerItem({ itemId: "stem", spriteName: "ss_sprite_005.png", maxStack: 64 });

// potato
registerCrop(ENTITY_TYPES.potato, "potato", potetoSprites, "ss_sprite_009.png", (num) => [{ itemId: "potato", count: num }, { itemId: "stem", count: num }]);

// flax
registerCrop(ENTITY_TYPES.flax, "flaxseed", flaxSprites, "ss_sprite_021.png", (num) => [{ itemId: "flaxseed", count: num }, { itemId: "flax_stalk", count: num }], "flaxseed_oil");
registerItem({ itemId: "flaxseed_oil", spriteName: "ss_sprite_028.png", maxStack: 64 });
registerItem({ itemId: "flax_stalk", spriteName: "ss_sprite_022.png", maxStack: 64 });
registerItem({
    itemId: "processed_flax",
    spriteName: "ss_sprite_097.png",
    maxStack: 64,
    onItemUse: (ctx: InteractionContext): boolean => {
        if (ctx.entityType === ENTITY_TYPES.scutching_board) {
            if (!ctx.inventory.addItems([{ itemId: "flax_fiber", count: 1 }])) return false;
            ctx.inventory.consumeSelectedItem(1);
            return true;
        }
        return false;
    },
});
registerItem({
    itemId: "flax_fiber",
    spriteName: "ss_sprite_023.png",
    maxStack: 64,
    onItemUse: (ctx: InteractionContext): boolean => {
        if (ctx.entityType === ENTITY_TYPES.spinning_wheel) {
            if (!ctx.inventory.addItems([{ itemId: "thread", count: 1 }])) return false;
            ctx.inventory.consumeSelectedItem(1);
            return true;
        }
        return false;
    },
});
registerItem({
    itemId: "thread",
    spriteName: "ss_sprite_024.png",
    maxStack: 64,
    onItemUse: (ctx: InteractionContext): boolean => {
        const num_consume = 8;
        if (ctx.entityType === ENTITY_TYPES.loom) {
            if (!ctx.inventory.canConsumeSelectedItem(num_consume)) return false;
            if (!ctx.inventory.addItems([{ itemId: "cloth", count: 1 }])) return false;
            ctx.inventory.consumeSelectedItem(num_consume);
            return true;
        }
        return false;
    },
});

// soy
registerCrop(ENTITY_TYPES.soy, "soybeans", soySprites, "ss_sprite_015.png", (num) => [{ itemId: "pods", count: num }, { itemId: "stem", count: num }], "soybean_oil");
registerItem({
    itemId: "pods",
    spriteName: "ss_sprite_014.png",
    maxStack: 64,
    onItemUse(ctx: InteractionContext): boolean {
        if (ctx.entityType !== ENTITY_TYPES.threshing_machine) return false;
        if (!ctx.inventory.addItems([{ itemId: "soybeans", count: 1 }])) return false;
        ctx.inventory.consumeSelectedItem(1);
        return true;
    },
});
registerItem({ itemId: "soybean_oil", spriteName: "ss_sprite_016.png", maxStack: 64 });
registerItem({ itemId: "bagged_soybeans", spriteName: "ss_sprite_017.png", maxStack: 64 });
registerItem({ itemId: "bagged_potatos", spriteName: "ss_sprite_017.png", maxStack: 64 });

// sunflower
registerCrop(ENTITY_TYPES.sunflower, "sunflower_seed", sunflowerSprites, "ss_sprite_032.png", (num) => [{ itemId: "sunflower_seed", count: num }, { itemId: "stem", count: num }]);
