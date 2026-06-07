import type { AutoProcessingStorage } from "../../engine/AutoProcessingStorage";
import type { CartStorage } from "../../engine/CartStorage";
import type { ChatHistory } from "../../engine/ChatHistory";
import type { BonfireStorage } from "../../engine/BonfireStorage";
import type { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import type { FermentationStorage } from "../../engine/FermentationStorage";
import type { GameTime } from "../../engine/GameTime";
import type { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import type { MissionSystem } from "../../engine/MissionSystem";
import type { PlayerState } from "../../engine/PlayerState";
import type { ReputationSystem } from "../../engine/ReputationSystem";
import type { SeedRequestSystem } from "../../engine/SeedRequestSystem";
import type { SaveData } from "../../lib/SaveSystem";
import type { VoxelMap } from "../../lib/VoxelMap";
import { getStorages } from "../../_registry/StorageRegistry";

export interface SaveSnapshotDeps {
    slotName: string;
    seed: string;
    voxelMap: VoxelMap;
    playerState: PlayerState;
    gameTime: GameTime;
    bonfireStorage: BonfireStorage;
    fermentationStorage: FermentationStorage;
    manualProcessingStorage: ManualProcessingStorage;
    dailyProcessingStorage: DailyProcessingStorage;
    autoProcessingStorage: AutoProcessingStorage;
    cartStorage: CartStorage;
    reputationSystem: ReputationSystem;
    seedRequestSystem: SeedRequestSystem;
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
        bonfireStorage,
        fermentationStorage,
        manualProcessingStorage,
        dailyProcessingStorage,
        autoProcessingStorage,
        cartStorage,
        reputationSystem,
        seedRequestSystem,
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
        storage: getStorages(),
        bonfireStorage: {
            bonfires: bonfireStorage.toSaveData(),
        },
        fermentationStorage: {
            vats: fermentationStorage.toSaveData(),
        },
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
        seedRequest: seedRequestSystem.toSaveData(),
        mission: missionSystem.toSaveData(),
        chatHistory: chatHistory.toSaveData(),
    };
}
