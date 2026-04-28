import { BitmapText } from "pixi.js";
import type { IGameTimeReader, IPlayerStateReader, IVoxelReader } from "../_boundary/interfaces";
import { CROP_DEFS, getFertilizerYieldMultiplier } from "../engine/CropDefs";
import {
    ENTITY_TYPES,
    FERTILIZER_TYPES,
    getCropGrowthStageFromVoxel,
    getDroughtCounterFromVoxel,
    getEntityTypeFromVoxel,
    getFatigueFromVoxel,
    getFertilizerTypeFromVoxel,
    getLastCropFromVoxel,
} from "../engine/TerrainDefs";
import { ENTITY_NAMES } from "./DebugText";
import { findFacilityAnchor } from "../_registry/facilityUtil";

const FERTILIZER_NAMES: Record<number, string> = {
    [FERTILIZER_TYPES.none]: "-",
    [FERTILIZER_TYPES.compost]: "compost",
    [FERTILIZER_TYPES.plant_ashes]: "plant_ashes",
    [FERTILIZER_TYPES.oil_cake]: "oil_cake",
};

export class PropertyView {
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
        const base =
            `Day ${this.gameTime.dayCount}  ${this.gameTime.currentTimeString}`;

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
        let voxel = this.voxelMap.get(pos);

        let entity = getEntityTypeFromVoxel(voxel);
        if (entity == ENTITY_TYPES.facility_part) {
            const anchor = findFacilityAnchor(this.voxelMap, px, pz);
            if (anchor) {
                entity = anchor.entityType;
                voxel = this.voxelMap.get(this.voxelMap.getSurfacePosition({ x: anchor.anchorX, y: 0, z: anchor.anchorZ }));
            }
        }
        const dayCounter = getCropGrowthStageFromVoxel(voxel);
        const fertType = getFertilizerTypeFromVoxel(voxel);
        const drought = getDroughtCounterFromVoxel(voxel);
        const lastCrop = getLastCropFromVoxel(voxel);
        const fatigue = getFatigueFromVoxel(voxel);

        let info = `Tile (${px}, ${pos.y}, ${pz})`;
        info += `\nEntity: ${ENTITY_NAMES[entity] ?? entity}`;

        if (entity !== ENTITY_TYPES.none) {
            const cropDef = CROP_DEFS[entity];
            if (cropDef) {
                const mature = dayCounter >= cropDef.maturityDay;
                const withered = dayCounter >= cropDef.witherDay;
                const status = withered ? "WITHERED" : mature ? "MATURE" : "growing";
                info += `\nDay: ${dayCounter}/${cropDef.witherDay} (${status})`;
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
            info += `\nFertilizerYield: ${getFertilizerYieldMultiplier(entity, fertType).toFixed(2)}`;
        }
        if (lastCrop !== 0 || fatigue !== 0) {
            info += `\nLastCrop: ${ENTITY_NAMES[lastCrop] ?? lastCrop}`;
            info += `\nFatigue: ${fatigue}`;
        }

        return info;
    }
}
