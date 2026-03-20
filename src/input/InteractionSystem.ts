import type { GameEventMap } from "../_boundary/events";
import type { IInventoryWriter, IVoxelWriter } from "../_boundary/interfaces";
import { CROP_DEFS, getFertilizerYieldMultiplier } from "../engine/CropDefs";
import { findFacilityAnchor, type ItemDef } from "../engine/ItemDefs";
import {
    ENTITY_TYPES,
    FERTILIZER_TYPES,
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
} from "../engine/TerrainDefs";
import { floodFillWater } from "../engine/WaterSystem";
import type { EventBroker } from "../lib/Event";

/** 中心座標を含む 3x3 範囲の表面 y がすべて同じかどうかを返す。範囲外タイルが含まれる場合は false。 */
function isFlat3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number, centerY: number): boolean {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            if (voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y !== centerY) {
                return false;
            }
        }
    }
    return true;
}

/** 中心を削った後（y - 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。
 *  範囲外タイルが含まれる場合は false。 */
function isSafeToRemove3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getGroundSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY - 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            const y = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y;
            if (Math.abs(newCenterY - y) > 1) return false;
        }
    }
    return true;
}

/** 中心に土を盛った後（y + 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。
 *  範囲外タイルが含まれる場合は false。 */
function isSafeToAdd3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getGroundSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY + 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            const y = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y;
            if (Math.abs(newCenterY - y) > 1) return false;
        }
    }
    return true;
}

/** (cx, cz) の高さ変化によって isFlat3x3 条件が崩れた近傍 soil/wetSoil タイルを dirt に戻す。 */
function revertNearbyInvalidTerrain(voxelMap: IVoxelWriter, cx: number, cz: number): void {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
            const pos = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz });
            const terrain = getTerrainTypeFromVoxel(voxelMap.get(pos));
            if (isFlat3x3(voxelMap, nx, nz, pos.y)) continue;
            if (terrain === TERRAIN_TYPES.soil || terrain === TERRAIN_TYPES.wetSoil) {
                voxelMap.set(TERRAIN_TYPES.dirt, pos);
            }
        }
    }
}

/** 施設を撤去してインベントリに回収する。成功時 true。 */
function removeFacility(voxelMap: IVoxelWriter, inventory: IInventoryWriter, anchorX: number, anchorZ: number, def: ItemDef): boolean {
    // インベントリに追加（満杯なら中止）
    if (!inventory.addItem(def.id, 1)) return false;

    const { w, h } = def.entitySize ?? { w: 1, h: 1 };
    // アンカーから entitySize の範囲を走査し、各タイルのエンティティビットをクリア
    for (let dz = 0; dz < h; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const pos = voxelMap.getSurfacePosition({ x: anchorX + dx, y: 0, z: anchorZ + dz });
            const v = voxelMap.get(pos);
            // 地形ビット（下位 8bit）のみ残し、エンティティビット以上をクリア
            voxelMap.set(v & 0xff, pos);
        }
    }
    return true;
}

/** 選択中のツールに応じてタイルを操作するハンドラを EventBroker に登録し、解除用の dispose 関数を返す。
 * onTerrainModified が指定された場合、地形変更操作（掘る・盛る）の後に呼び出される。 */
export function createInteractionHandler(
    voxelMap: IVoxelWriter,
    inventory: IInventoryWriter,
    eventBroker: EventBroker<GameEventMap>,
    onTerrainModified?: () => void,
): () => void {
    return eventBroker.subscribe("interact_world", (packet) => {
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const terrainType = getTerrainTypeFromVoxel(voxel);
        const tool = inventory.selectedTool;

        // 水源ブロックは操作対象外（破壊不能）
        if (terrainType === TERRAIN_TYPES.waterSource) return;

        // 作業台エンティティの検出: axe/pickaxe（撤去ツール）以外で作業台を右クリック → クラフトUI を開く
        const entityType = getEntityTypeFromVoxel(voxel);
        if (
            entityType === ENTITY_TYPES.workbench ||
            (entityType === ENTITY_TYPES.facility_part && findFacilityAnchor(voxelMap, packet.pos.x, packet.pos.z)?.def.id === "workbench")
        ) {
            if (tool !== "axe" && tool !== "pickaxe") {
                eventBroker.publish("open_craft_ui", { pos: packet.pos });
                return;
            }
        }

        switch (tool) {
            case "hand":
                break;
            case "watering_can":
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.soil) {
                    // エンティティビットと growthStage を保持したまま地形タイプのみ wetSoil に変更
                    voxelMap.set((voxel & ~0xff) | TERRAIN_TYPES.wetSoil, surfacePos);
                }
                break;
            case "shovel":
                if (
                    (terrainType === TERRAIN_TYPES.grass || terrainType === TERRAIN_TYPES.dirt) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    isSafeToRemove3x3(voxelMap, packet.pos.x, packet.pos.z)
                ) {
                    if (surfacePos.y >= 1) {
                        if (inventory.addItem("dirt", 1)) {
                            voxelMap.remove(surfacePos);
                            revertNearbyInvalidTerrain(voxelMap, packet.pos.x, packet.pos.z);
                            floodFillWater(voxelMap, packet.pos.x, packet.pos.z);
                            onTerrainModified?.();
                        }
                    }
                } else if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.flax) {
                    const dayCounter = getCropGrowthStageFromVoxel(voxel);
                    if (dayCounter >= CROP_DEFS[ENTITY_TYPES.flax].maturityDay && dayCounter < CROP_DEFS[ENTITY_TYPES.flax].witherDay) {
                        const baseCount = 2 + Math.floor(Math.random() * 3); // 2〜4個
                        const fertType = getFertilizerTypeFromVoxel(voxel);
                        const fertMultiplier = getFertilizerYieldMultiplier(ENTITY_TYPES.flax, fertType);
                        const fatigue = getFatigueFromVoxel(voxel);
                        const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
                        const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * fatigueMultiplier));
                        if (inventory.addItem("flaxseed", harvestCount)) {
                            inventory.addItem("flax_stalk", harvestCount);
                            inventory.addItem("stem", harvestCount);
                            let afterVoxel: number = TERRAIN_TYPES.soil;
                            afterVoxel = setLastCropInVoxel(afterVoxel, ENTITY_TYPES.flax);
                            afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
                            voxelMap.set(afterVoxel, surfacePos);
                            eventBroker.publish("crop_harvested", { pos: { x: packet.pos.x, z: packet.pos.z }, itemId: "flax", count: harvestCount });
                        }
                    }
                } else if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.potato) {
                    const dayCounter = getCropGrowthStageFromVoxel(voxel);
                    if (dayCounter >= CROP_DEFS[ENTITY_TYPES.potato].maturityDay && dayCounter < CROP_DEFS[ENTITY_TYPES.potato].witherDay) {
                        const baseCount = 2 + Math.floor(Math.random() * 3); // 2〜4個
                        const fertType = getFertilizerTypeFromVoxel(voxel);
                        const fertMultiplier = getFertilizerYieldMultiplier(ENTITY_TYPES.potato, fertType);
                        const wateredCount = getDroughtCounterFromVoxel(voxel);
                        const waterBonus = 1.0 + wateredCount * 0.1;
                        const fatigue = getFatigueFromVoxel(voxel);
                        const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
                        const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * waterBonus * fatigueMultiplier));
                        if (inventory.addItem("potato", harvestCount)) {
                            inventory.addItem("stem", harvestCount);
                            let afterVoxel: number = TERRAIN_TYPES.soil;
                            afterVoxel = setLastCropInVoxel(afterVoxel, ENTITY_TYPES.potato);
                            afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
                            voxelMap.set(afterVoxel, surfacePos);
                            eventBroker.publish("crop_harvested", { pos: { x: packet.pos.x, z: packet.pos.z }, itemId: "potato", count: harvestCount });
                        }
                    }
                }
                break;
            case "axe": {
                const entityType = getEntityTypeFromVoxel(voxel);
                if (entityType === ENTITY_TYPES.tree) {
                    // 既存の tree 伐採ロジック
                    if (inventory.addItem("trunk", 1)) {
                        inventory.addItem("leaves", 2 + Math.floor(Math.random() * 3)); // 2〜4個
                        voxelMap.set(voxel & 0x000000ff, surfacePos);
                    }
                } else {
                    // 施設撤去（forge 以外の施設 + facility_part）
                    const anchor = findFacilityAnchor(voxelMap, packet.pos.x, packet.pos.z);
                    if (anchor && anchor.def.entityType !== ENTITY_TYPES.forge) {
                        removeFacility(voxelMap, inventory, anchor.anchorX, anchor.anchorZ, anchor.def);
                    }
                }
                break;
            }
            case "pickaxe": {
                // forge の撤去
                const anchor = findFacilityAnchor(voxelMap, packet.pos.x, packet.pos.z);
                if (anchor && anchor.def.entityType === ENTITY_TYPES.forge) {
                    removeFacility(voxelMap, inventory, anchor.anchorX, anchor.anchorZ, anchor.def);
                } else if(getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.stone) {
                    const pos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
                    const afterVoxel = TERRAIN_TYPES.dirt;
                    voxelMap.set(afterVoxel, pos);
                    inventory.addItem("stone", 1);
                }
                break;
            }
            case "sickle": {
                if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.soy && getCropGrowthStageFromVoxel(voxel) >= 3 && getCropGrowthStageFromVoxel(voxel) < 7) {
                    const baseCount = 2 + Math.floor(Math.random() * 3); // 2〜4個
                    const fertType = getFertilizerTypeFromVoxel(voxel);
                    const fertMultiplier = getFertilizerYieldMultiplier(ENTITY_TYPES.soy, fertType);
                    const fatigue = getFatigueFromVoxel(voxel);
                    const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
                    const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * fatigueMultiplier));
                    if (inventory.addItem("soybeans", harvestCount)) {
                        inventory.addItem("stem", harvestCount);
                        let afterVoxel: number = TERRAIN_TYPES.dirt;
                        afterVoxel = setLastCropInVoxel(afterVoxel, ENTITY_TYPES.soy);
                        afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
                        voxelMap.set(afterVoxel, surfacePos);
                        eventBroker.publish("crop_harvested", { pos: { x: packet.pos.x, z: packet.pos.z }, itemId: "soy", count: harvestCount });
                    }
                } else if (
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.sunflower &&
                    getCropGrowthStageFromVoxel(voxel) >= 3 &&
                    getCropGrowthStageFromVoxel(voxel) < 7
                ) {
                    const baseCount = 2 + Math.floor(Math.random() * 3); // 2〜4個
                    const fertType = getFertilizerTypeFromVoxel(voxel);
                    const fertMultiplier = getFertilizerYieldMultiplier(ENTITY_TYPES.sunflower, fertType);
                    const fatigue = getFatigueFromVoxel(voxel);
                    const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
                    const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * fatigueMultiplier));
                    if (inventory.addItem("sunflower_seed", harvestCount)) {
                        inventory.addItem("stem", harvestCount);
                        let afterVoxel: number = TERRAIN_TYPES.dirt;
                        afterVoxel = setLastCropInVoxel(afterVoxel, ENTITY_TYPES.sunflower);
                        afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
                        voxelMap.set(afterVoxel, surfacePos);
                        eventBroker.publish("crop_harvested", { pos: { x: packet.pos.x, z: packet.pos.z }, itemId: "sunflower", count: harvestCount });
                    }
                }
                break;
            }
            case "hoes": {
                const terrainType = getTerrainTypeFromVoxel(voxel);
                const entityType = getEntityTypeFromVoxel(voxel);
                if ((terrainType === TERRAIN_TYPES.soil || terrainType === TERRAIN_TYPES.wetSoil) && entityType !== ENTITY_TYPES.none) {
                    // 作物エンティティを削除（虚空へ消滅、アイテム追加なし）
                    voxelMap.set(terrainType, surfacePos);
                } else if (
                    (terrainType === TERRAIN_TYPES.grass || terrainType === TERRAIN_TYPES.dirt) &&
                    entityType === ENTITY_TYPES.none &&
                    isFlat3x3(voxelMap, packet.pos.x, packet.pos.z, surfacePos.y)
                ) {
                    voxelMap.set(TERRAIN_TYPES.soil, surfacePos);
                }
                break;
            }
            case "potato": {
                const potatoTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (potatoTerrainType === TERRAIN_TYPES.soil || potatoTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none
                ) {
                    const cropDef = CROP_DEFS[ENTITY_TYPES.potato];
                    const lastCrop = getLastCropFromVoxel(voxel);
                    let fatigue = getFatigueFromVoxel(voxel);
                    if (lastCrop === ENTITY_TYPES.potato) {
                        fatigue += 1;
                    } else if (lastCrop !== ENTITY_TYPES.none) {
                        fatigue = Math.max(0, fatigue - 1);
                    }
                    if (fatigue >= cropDef.fatigueThreshold) break;
                    if (!inventory.consumeSelectedItem(1)) break;
                    // 地形タイプ（soil or wetSoil）・肥料・fatigue・last_crop を保持してエンティティを追加
                    let newVoxel = potatoTerrainType | (ENTITY_TYPES.potato << 8);
                    newVoxel = setFatigueInVoxel(newVoxel, fatigue);
                    newVoxel = setLastCropInVoxel(newVoxel, ENTITY_TYPES.potato);
                    newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
                    voxelMap.set(newVoxel, surfacePos);
                    eventBroker.publish("crop_planted", { pos: { x: packet.pos.x, z: packet.pos.z }, cropType: "potato" });
                }
                break;
            }
            case "soybeans": {
                const soyTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (soyTerrainType === TERRAIN_TYPES.soil || soyTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none
                ) {
                    const cropDef = CROP_DEFS[ENTITY_TYPES.soy];
                    const lastCrop = getLastCropFromVoxel(voxel);
                    let fatigue = getFatigueFromVoxel(voxel);
                    if (lastCrop === ENTITY_TYPES.soy) {
                        fatigue += 1;
                    } else if (lastCrop !== ENTITY_TYPES.none) {
                        fatigue = Math.max(0, fatigue - 1);
                    }
                    if (fatigue >= cropDef.fatigueThreshold) break;
                    if (!inventory.consumeSelectedItem(1)) break;
                    // 地形タイプ（soil or wetSoil）・肥料・fatigue・last_crop を保持してエンティティを追加
                    let newVoxel = soyTerrainType | (ENTITY_TYPES.soy << 8);
                    newVoxel = setFatigueInVoxel(newVoxel, fatigue);
                    newVoxel = setLastCropInVoxel(newVoxel, ENTITY_TYPES.soy);
                    newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
                    voxelMap.set(newVoxel, surfacePos);
                    eventBroker.publish("crop_planted", { pos: { x: packet.pos.x, z: packet.pos.z }, cropType: "soy" });
                }
                break;
            }
            case "flaxseed": {
                const flaxTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (flaxTerrainType === TERRAIN_TYPES.soil || flaxTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none
                ) {
                    const cropDef = CROP_DEFS[ENTITY_TYPES.flax];
                    const lastCrop = getLastCropFromVoxel(voxel);
                    let fatigue = getFatigueFromVoxel(voxel);
                    if (lastCrop === ENTITY_TYPES.flax) {
                        fatigue += 1;
                    } else if (lastCrop !== ENTITY_TYPES.none) {
                        fatigue = Math.max(0, fatigue - 1);
                    }
                    if (fatigue >= cropDef.fatigueThreshold) break;
                    if (!inventory.consumeSelectedItem(1)) break;
                    // 地形タイプ（soil or wetSoil）・肥料・fatigue・last_crop を保持してエンティティを追加
                    let newVoxel = flaxTerrainType | (ENTITY_TYPES.flax << 8);
                    newVoxel = setFatigueInVoxel(newVoxel, fatigue);
                    newVoxel = setLastCropInVoxel(newVoxel, ENTITY_TYPES.flax);
                    newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
                    voxelMap.set(newVoxel, surfacePos);
                    eventBroker.publish("crop_planted", { pos: { x: packet.pos.x, z: packet.pos.z }, cropType: "flax" });
                }
                break;
            }
            case "sunflower_seed": {
                const sunflowerTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (sunflowerTerrainType === TERRAIN_TYPES.soil || sunflowerTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none
                ) {
                    const cropDef = CROP_DEFS[ENTITY_TYPES.sunflower];
                    const lastCrop = getLastCropFromVoxel(voxel);
                    let fatigue = getFatigueFromVoxel(voxel);
                    if (lastCrop === ENTITY_TYPES.sunflower) {
                        fatigue += 1;
                    } else if (lastCrop !== ENTITY_TYPES.none) {
                        fatigue = Math.max(0, fatigue - 1);
                    }
                    if (fatigue >= cropDef.fatigueThreshold) break;
                    if (!inventory.consumeSelectedItem(1)) break;
                    // 地形タイプ（soil or wetSoil）・肥料・fatigue・last_crop を保持してエンティティを追加
                    let newVoxel = sunflowerTerrainType | (ENTITY_TYPES.sunflower << 8);
                    newVoxel = setFatigueInVoxel(newVoxel, fatigue);
                    newVoxel = setLastCropInVoxel(newVoxel, ENTITY_TYPES.sunflower);
                    newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
                    voxelMap.set(newVoxel, surfacePos);
                    eventBroker.publish("crop_planted", { pos: { x: packet.pos.x, z: packet.pos.z }, cropType: "sunflower" });
                }
                break;
            }
            case "nuts": {
                const nutsTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (nutsTerrainType === TERRAIN_TYPES.soil || nutsTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    inventory.consumeSelectedItem(1)
                ) {
                    // 地形タイプ（soil or wetSoil）を保持してエンティティを追加
                    voxelMap.set(nutsTerrainType | (ENTITY_TYPES.tree << 8), surfacePos);
                    eventBroker.publish("crop_planted", { pos: { x: packet.pos.x, z: packet.pos.z }, cropType: "nuts" });
                }
                break;
            }
            case "compost":
            case "plant_ashes":
            case "oil_cake": {
                const fertTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (fertTerrainType === TERRAIN_TYPES.soil || fertTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getFertilizerTypeFromVoxel(voxel) === 0 &&
                    inventory.consumeSelectedItem(1)
                ) {
                    const fertType =
                        tool === "compost" ? FERTILIZER_TYPES.compost : tool === "plant_ashes" ? FERTILIZER_TYPES.plant_ashes : FERTILIZER_TYPES.oil_cake;
                    voxelMap.set(setFertilizerTypeInVoxel(voxel, fertType), surfacePos);
                }
                break;
            }
            case "dirt": {
                // 水タイルを無視して地面の高さを取得し、地面の1つ上にdirtを配置する
                const groundPos = voxelMap.getGroundSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
                const groundVoxel = voxelMap.get(groundPos);
                const groundTerrainType = getTerrainTypeFromVoxel(groundVoxel);
                if (
                    (groundTerrainType === TERRAIN_TYPES.grass || groundTerrainType === TERRAIN_TYPES.dirt) &&
                    groundPos.y + 1 < voxelMap.height &&
                    isSafeToAdd3x3(voxelMap, packet.pos.x, packet.pos.z) &&
                    inventory.consumeSelectedItem(1)
                ) {
                    voxelMap.set(TERRAIN_TYPES.dirt, { x: groundPos.x, y: groundPos.y + 1, z: groundPos.z });
                    revertNearbyInvalidTerrain(voxelMap, packet.pos.x, packet.pos.z);
                    onTerrainModified?.();
                }
                break;
            }
        }
    });
}
