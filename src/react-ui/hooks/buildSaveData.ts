import type { ChestStorage } from "../../engine/ChestStorage";
import type { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import type { ForgeStorage } from "../../engine/ForgeStorage";
import type { GameTime } from "../../engine/GameTime";
import type { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import type { PlayerState } from "../../engine/PlayerState";
import type { ReputationSystem } from "../../engine/ReputationSystem";
import type { WarpGateStorage } from "../../engine/WarpGateStorage";
import type { WorkbenchStorage } from "../../engine/WorkbenchStorage";
import type { SaveData } from "../../lib/SaveSystem";
import type { VoxelMap } from "../../lib/VoxelMap";

export interface SaveSnapshotDeps {
    seed: string;
    voxelMap: VoxelMap;
    playerState: PlayerState;
    gameTime: GameTime;
    chestStorage: ChestStorage;
    forgeStorage: ForgeStorage;
    workbenchStorage: WorkbenchStorage;
    warpGateStorage: WarpGateStorage;
    manualProcessingStorage: ManualProcessingStorage;
    dailyProcessingStorage: DailyProcessingStorage;
    reputationSystem: ReputationSystem;
}

/** 各サブシステムの現在状態から saveGame に渡すペイロードを組み立てる。 */
export function buildSaveData(deps: SaveSnapshotDeps): Omit<SaveData, "version" | "timestamp"> {
    const {
        seed,
        voxelMap,
        playerState,
        gameTime,
        chestStorage,
        forgeStorage,
        workbenchStorage,
        warpGateStorage,
        manualProcessingStorage,
        dailyProcessingStorage,
        reputationSystem,
    } = deps;
    const inventory = playerState.inventory;
    return {
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
        reputation: reputationSystem.toSaveData(),
    };
}
