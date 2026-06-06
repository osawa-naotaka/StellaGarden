import { BitmapText } from "pixi.js";
import type { IGameTimeReader, IPlayerStateReader, IVoxelReader } from "../_boundary/interfaces";
import { CROP_DEFS, getFertilizerYieldMultiplier, getVisualStage } from "../engine/CropDefs";
import {
    ENTITY_TYPES,
    FERTILIZER_TYPES,
    getDaysElapsedFromVoxel,
    getDroughtCounterFromVoxel,
    getEntityTypeFromVoxel,
    getFatigueFromVoxel,
    getFertilizerTypeFromVoxel,
    getLastCropFromVoxel,
    getTerrainTypeFromVoxel,
    getVariantFromVoxel,
    TERRAIN_TYPES,
} from "../engine/VoxelDefs";

const TERRAIN_NAMES: Record<number, string> = {
    [TERRAIN_TYPES.empty]: "empty",
    [TERRAIN_TYPES.water]: "water",
    [TERRAIN_TYPES.grass]: "grass",
    [TERRAIN_TYPES.soil]: "soil",
    [TERRAIN_TYPES.wetSoil]: "wetSoil",
    [TERRAIN_TYPES.dirt]: "dirt",
    [TERRAIN_TYPES.waterSource]: "waterSource",
    [TERRAIN_TYPES.disorderedSoil]: "disorderedSoil",
};

export const ENTITY_NAMES: Record<number, string> = {
    [ENTITY_TYPES.none]: "-",
    [ENTITY_TYPES.tree]: "木",
    [ENTITY_TYPES.potato]: "じゃがいも",
    [ENTITY_TYPES.soy]: "大豆",
    [ENTITY_TYPES.flax]: "亜麻",
    [ENTITY_TYPES.wheat]: "小麦",
    [ENTITY_TYPES.sunflower]: "ひまわり",
    [ENTITY_TYPES.workbench]: "作業台",
    [ENTITY_TYPES.facility_part]: "facility_part",
    [ENTITY_TYPES.forge]: "炉",
    [ENTITY_TYPES.compost_bin]: "堆肥場",
    [ENTITY_TYPES.threshing_machine]: "千歯扱き",
    [ENTITY_TYPES.screw_presses]: "搾油機",
    [ENTITY_TYPES.soaking_basket]: "浸漬槽",
    [ENTITY_TYPES.scutching_board]: "叩き台",
    [ENTITY_TYPES.spinning_wheel]: "紡ぎ車",
    [ENTITY_TYPES.loom]: "織機",
    [ENTITY_TYPES.stone]: "石",
    [ENTITY_TYPES.chest]: "チェスト",
    [ENTITY_TYPES.bonfire]: "焚き火",
    [ENTITY_TYPES.kiln]: "炭焼き窯",
    [ENTITY_TYPES.clay]: "粘土",
    [ENTITY_TYPES.meteoric_iron]: "隕鉄",
    [ENTITY_TYPES.anvil]: "金床",
    [ENTITY_TYPES.forge_burning]: "炉（点火中）",
    [ENTITY_TYPES.furrow_canal]: "畝間水路",
    [ENTITY_TYPES.warp_gate]: "転移ゲート",
    [ENTITY_TYPES.rail]: "レール",
    [ENTITY_TYPES.shaft]: "シャフト",
    [ENTITY_TYPES.waterwheel]: "水車",
};

const FERTILIZER_NAMES: Record<number, string> = {
    [FERTILIZER_TYPES.none]: "-",
    [FERTILIZER_TYPES.compost]: "堆肥",
    [FERTILIZER_TYPES.plant_ashes]: "草木灰",
    [FERTILIZER_TYPES.oil_cake]: "油粕",
};

export class DebugText {
    private textObject: BitmapText;
    private playerState: IPlayerStateReader;
    private gameTime: IGameTimeReader;
    private voxelMap: IVoxelReader;

    constructor(playerState: IPlayerStateReader, gameTime: IGameTimeReader, voxelMap: IVoxelReader) {
        this.playerState = playerState;
        this.gameTime = gameTime;
        this.voxelMap = voxelMap;
        this.textObject = new BitmapText({
            text: this.getText(),
            style: {
                fontFamily: "Roboto",
                fontSize: 32,
                fill: 0xffffff,
            },
        });
        this.textObject.x = 10;
        this.textObject.y = 10;
    }

    get textView() {
        return this.textObject;
    }

    update() {
        this.textObject.text = this.getText();
    }

    private getText() {
        const ps = this.playerState;
        const base =
            `X: ${ps.posInWorld.x.toFixed(1)}, Z: ${ps.posInWorld.z.toFixed(1)}` +
            `\nZoom: ${ps.zoomLevel.toFixed(2)}` +
            `\nPointer: (${ps.pointerPosInWorld.x.toFixed(1)}, ${ps.pointerPosInWorld.z.toFixed(1)})` +
            `\nDay ${this.gameTime.dayCount}  ${this.gameTime.currentTimeString}`;

        const tileInfo = this.getTileInfo();
        return tileInfo ? `${base}\n---\n${tileInfo}` : base;
    }

    private getTileInfo(): string | null {
        const px = Math.floor(this.playerState.pointerPosInWorld.x);
        const pz = Math.floor(this.playerState.pointerPosInWorld.z);

        if (px < 0 || px >= this.voxelMap.width || pz < 0 || pz >= this.voxelMap.depth) {
            return null;
        }

        const pos = this.voxelMap.getSurfacePosition({ x: px, y: 0, z: pz });
        const voxel = this.voxelMap.get(pos);

        const terrain = getTerrainTypeFromVoxel(voxel);
        const entity = getEntityTypeFromVoxel(voxel);
        const dayCounter = getDaysElapsedFromVoxel(voxel);
        const fertType = getFertilizerTypeFromVoxel(voxel);
        const drought = getDroughtCounterFromVoxel(voxel);
        const lastCrop = getLastCropFromVoxel(voxel);
        const fatigue = getFatigueFromVoxel(voxel);
        const variant = getVariantFromVoxel(voxel);

        let info = `Tile (${px}, ${pos.y}, ${pz})`;
        info += `\nTerrain: ${TERRAIN_NAMES[terrain] ?? terrain}`;
        info += `\nEntity: ${ENTITY_NAMES[entity] ?? entity}`;
        info += `\nVariant: ${variant}`;

        if (entity !== ENTITY_TYPES.none) {
            const cropDef = CROP_DEFS[entity];
            if (cropDef) {
                const vis = getVisualStage(entity, dayCounter);
                const mature = dayCounter >= cropDef.maturityDay;
                const withered = dayCounter >= cropDef.witherDay;
                const status = withered ? "WITHERED" : mature ? "MATURE" : "growing";
                info += `\nDay: ${dayCounter}/${cropDef.witherDay} (${status})`;
                info += `\nVisual: ${vis}`;
                if (cropDef.needsWater) {
                    info += `\nDrought: ${drought}/3`;
                } else {
                    info += `\nWatered: ${drought}x`;
                }
            } else {
                info += `\nStage: ${dayCounter}`;
            }
        }

        if (fertType !== 0) {
            info += `\nFertilizer: ${FERTILIZER_NAMES[fertType] ?? fertType}`;
            info += `\nFertilizerYield: ${getFertilizerYieldMultiplier(entity, fertType)}`;
        }
        if (lastCrop !== 0 || fatigue !== 0) {
            info += `\nLastCrop: ${ENTITY_NAMES[lastCrop] ?? lastCrop}`;
            info += `\nFatigue: ${fatigue}`;
        }

        return info;
    }
}
