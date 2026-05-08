import type { IPlayerStateReader, IVoxelReader } from "../../_boundary/interfaces";
import { findFacilityAnchor } from "../../_registry/facilityUtil";
import { CROP_DEFS, getFertilizerYieldMultiplier } from "../../engine/CropDefs";
import {
    ENTITY_TYPES,
    FERTILIZER_TYPES,
    getDaysElapsedFromVoxel,
    getDroughtCounterFromVoxel,
    getEntityTypeFromVoxel,
    getFatigueFromVoxel,
    getFertilizerTypeFromVoxel,
    getLastCropFromVoxel,
} from "../../engine/TerrainDefs";
import { ENTITY_NAMES } from "../../view/DebugText";
import { useEngine } from "../EngineContext";
import { useFrameTick } from "../hooks/useFrameTick";

const FERTILIZER_LABELS: Record<number, string> = {
    [FERTILIZER_TYPES.none]: "-",
    [FERTILIZER_TYPES.compost]: "堆肥",
    [FERTILIZER_TYPES.plant_ashes]: "草木灰",
    [FERTILIZER_TYPES.oil_cake]: "油粕",
};

function buildTileLines(voxelMap: IVoxelReader, playerState: IPlayerStateReader): string[] | null {
    const px = Math.floor(playerState.pointerPosInWorld.x);
    const pz = Math.floor(playerState.pointerPosInWorld.z);
    if (px < 0 || px >= voxelMap.width || pz < 0 || pz >= voxelMap.depth) return null;

    const pos = voxelMap.getSurfacePosition({ x: px, y: 0, z: pz });
    let voxel = voxelMap.get(pos);

    let entity = getEntityTypeFromVoxel(voxel);
    if (entity === ENTITY_TYPES.facility_part) {
        const anchor = findFacilityAnchor(voxelMap, px, pz);
        if (anchor) {
            entity = anchor.entityType;
            voxel = voxelMap.get(voxelMap.getSurfacePosition({ x: anchor.anchorX, y: 0, z: anchor.anchorZ }));
        }
    }

    const dayCounter = getDaysElapsedFromVoxel(voxel);
    const fertType = getFertilizerTypeFromVoxel(voxel);
    const drought = getDroughtCounterFromVoxel(voxel);
    const lastCrop = getLastCropFromVoxel(voxel);
    const fatigue = getFatigueFromVoxel(voxel);

    const lines: string[] = [];
    if (entity !== ENTITY_TYPES.none) {
        lines.push(`エンティティ: ${ENTITY_NAMES[entity] ?? entity}`);
        const cropDef = CROP_DEFS[entity];
        if (cropDef) {
            const mature = dayCounter >= cropDef.maturityDay;
            const withered = dayCounter >= cropDef.witherDay;
            const status = withered ? "枯死" : mature ? "収穫期" : "成長中";
            lines.push(`成長: ${dayCounter}日/${cropDef.maturityDay}日 (${status})`);
            if (cropDef.needsWater) {
                lines.push(`干ばつまで: ${drought}/3`);
            }
            if (fertType !== 0) {
                lines.push(`肥料: ${FERTILIZER_LABELS[fertType] ?? fertType}`);
            }
            lines.push(`収量倍率: ${getFertilizerYieldMultiplier(entity, fertType).toFixed(2)}`);
        }
    }

    if (lastCrop !== 0 || fatigue !== 0) {
        lines.push(`前回作物: ${ENTITY_NAMES[lastCrop] ?? lastCrop}`);
        lines.push(`土地疲弊: ${fatigue}`);
    }

    return lines;
}

const PANEL_STYLE: React.CSSProperties = {
    position: "fixed",
    top: 10,
    left: 10,
    pointerEvents: "none",
    color: "#ffffff",
    fontSize: 23,
    fontFamily: "monospace",
    lineHeight: 1.7,
    textShadow: "1px 1px 2px #000, -1px -1px 2px #000",
    userSelect: "none",
};

const DIVIDER_STYLE: React.CSSProperties = {
    borderTop: "1px solid rgba(255,255,255,0.35)",
    margin: "2px 0 3px",
};

export function PropertyPanel() {
    const { playerState, gameTime, voxelMap, uiState } = useEngine();
    useFrameTick(true);

    const header = `${gameTime.dayCount}日目  ${gameTime.currentTimeString}`;
    const tileLines = buildTileLines(voxelMap, playerState);
    const speed = uiState.timeSpeed;

    const makeBtnStyle = (active: boolean): React.CSSProperties => ({
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "inherit",
        lineHeight: 1,
        padding: "0 2px",
        color: "inherit",
        pointerEvents: "auto",
        opacity: active ? 1 : 0.4,
    });

    return (
        <div style={PANEL_STYLE}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button type="button" style={makeBtnStyle(speed === "paused")} onClick={() => uiState.setTimeSpeed("paused")}>
                    <img src="/assets/svg/pause-solid-full.svg" alt="一時停止" style={{ width: "1em", height: "1em", display: "block" }} />
                </button>
                <button type="button" style={makeBtnStyle(speed === "normal")} onClick={() => uiState.setTimeSpeed("normal")}>
                    <img src="/assets/svg/play-solid-full.svg" alt="通常速度" style={{ width: "1em", height: "1em", display: "block" }} />
                </button>
                <button type="button" style={makeBtnStyle(speed === "fast")} onClick={() => uiState.setTimeSpeed("fast")}>
                    <img src="/assets/svg/forward-solid-full.svg" alt="早送り" style={{ width: "1em", height: "1em", display: "block" }} />
                </button>
                <span>{header}</span>
            </div>
            {tileLines && (
                <>
                    <div style={DIVIDER_STYLE} />
                    {tileLines.map((line, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: 行数固定の静的リスト
                        <div key={i}>{line}</div>
                    ))}
                </>
            )}
        </div>
    );
}
