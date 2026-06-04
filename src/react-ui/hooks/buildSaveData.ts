import type { AutoProcessingStorage } from "../../engine/AutoProcessingStorage";
import type { CartStorage } from "../../engine/CartStorage";
import type { ChatHistory } from "../../engine/ChatHistory";
import type { BonfireStorage } from "../../engine/BonfireStorage";
import type { ChestStorage } from "../../engine/ChestStorage";
import type { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import type { DistillerStorage } from "../../engine/DistillerStorage";
import type { FermentationStorage } from "../../engine/FermentationStorage";
import type { ForgeStorage } from "../../engine/ForgeStorage";
import type { GameTime } from "../../engine/GameTime";
import type { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import type { MissionSystem } from "../../engine/MissionSystem";
import type { PlayerState } from "../../engine/PlayerState";
import type { ReputationSystem } from "../../engine/ReputationSystem";
import type { SaltPanStorage } from "../../engine/SaltPanStorage";
import type { WarpGateStorage } from "../../engine/WarpGateStorage";
import type { WorkbenchStorage } from "../../engine/WorkbenchStorage";
import type { SaveData } from "../../lib/SaveSystem";
import type { VoxelMap } from "../../lib/VoxelMap";

export interface SaveSnapshotDeps {
    slotName: string;
    seed: string;
    voxelMap: VoxelMap;
    playerState: PlayerState;
    gameTime: GameTime;
    chestStorage: ChestStorage;
    forgeStorage: ForgeStorage;
    bonfireStorage: BonfireStorage;
    distillerStorage: DistillerStorage;
    saltPanStorage: SaltPanStorage;
    fermentationStorage: FermentationStorage;
    workbenchStorage: WorkbenchStorage;
    warpGateStorage: WarpGateStorage;
    manualProcessingStorage: ManualProcessingStorage;
    dailyProcessingStorage: DailyProcessingStorage;
    autoProcessingStorage: AutoProcessingStorage;
    cartStorage: CartStorage;
    reputationSystem: ReputationSystem;
    missionSystem: MissionSystem;
    chatHistory: ChatHistory;
}

/** 各サブシステムの現在状態から saveGame に渡すペイロードを組み立てる。 */
export function buildSaveData(deps: SaveSnapshotDeps): Omit<SaveData, "version" | "timestamp"> {
    const {
        slotName,
        seed,
        voxelMap,
        playerState,
        gameTime,
        chestStorage,
        forgeStorage,
        bonfireStorage,
        distillerStorage,
        saltPanStorage,
        fermentationStorage,
        workbenchStorage,
        warpGateStorage,
        manualProcessingStorage,
        dailyProcessingStorage,
        autoProcessingStorage,
        cartStorage,
        reputationSystem,
        missionSystem,
        chatHistory,
    } = deps;
    const inventory = playerState.inventory;
    return {
        slotName,
        seed,
        voxelMap: {
            width: voxelMap.width,
            height: voxelMap.height,
            depth: voxelMap.depth,
            horizonHeight: voxelMap.horizonHeight,
            voxels: voxelMap.getVoxelsBuffer(),
            riversideCells: voxelMap.riversideCells,
        },
        playerState: {
            posInWorld: { ...playerState.posInWorld },
            zoomLevel: playerState.zoomLevel,
            facing: playerState.facing,
        },
        inventory: {
            toolbarSlots: [...inventory.toolbarSlots],
            inventorySlots: [...inventory.inventorySlots],
            selectedIndex: inventory.selectedIndex,
        },
        gameTime: {
            elapsedMs: gameTime.getElapsedMs(),
        },
        chestStorage: {
            chests: chestStorage.toSaveData(),
        },
        forgeStorage: {
            forges: forgeStorage.toSaveData(),
        },
        bonfireStorage: {
            bonfires: bonfireStorage.toSaveData(),
        },
        distillerStorage: {
            distillers: distillerStorage.toSaveData(),
        },
        saltPanStorage: {
            saltpans: saltPanStorage.toSaveData(),
        },
        fermentationStorage: {
            vats: fermentationStorage.toSaveData(),
        },
        workbenchStorage: {
            workbenches: workbenchStorage.toSaveData(),
        },
        warpGateStorage: warpGateStorage.toSaveData(),
        manualProcessingStorage: {
            facilities: manualProcessingStorage.toSaveData(),
        },
        dailyProcessingStorage: {
            facilities: dailyProcessingStorage.toSaveData(),
        },
        autoProcessingStorage: {
            facilities: autoProcessingStorage.toSaveData(),
        },
        cartStorage: cartStorage.toSaveData(),
        reputation: reputationSystem.toSaveData(),
        mission: missionSystem.toSaveData(),
        chatHistory: chatHistory.toSaveData(),
    };
}
