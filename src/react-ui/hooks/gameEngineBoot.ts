import type { IEventBroker } from "../../_boundary/interfaces";
import { setAutoProcessingStorage } from "../../_registry/entities/AutoProcessing";
import { setCartStorage } from "../../_registry/entities/Cart";
import { setChestStorage } from "../../_registry/entities/Chest";
import { setDailyProcessingStorage } from "../../_registry/entities/DailyProcessing";
import { setForgeStorage } from "../../_registry/entities/Forge";
import { setManualProcessingStorage } from "../../_registry/entities/ManualProcessing";
import { setWarpGateStorage } from "../../_registry/entities/WarpGate";
import { setWorkbenchStorage } from "../../_registry/entities/Workbench";
import { AutoProcessingStorage } from "../../engine/AutoProcessingStorage";
import { CartStorage } from "../../engine/CartStorage";
import { ChestStorage } from "../../engine/ChestStorage";
import { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import { ForgeStorage } from "../../engine/ForgeStorage";
import { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import { generateTerrain } from "../../engine/TerrainGenerator";
import { WarpGateStorage } from "../../engine/WarpGateStorage";
import { WorkbenchStorage } from "../../engine/WorkbenchStorage";
import type { SaveData } from "../../lib/SaveSystem";
import type { Size2D } from "../../lib/VoxelMap";
import { VoxelMap } from "../../lib/VoxelMap";

/**
 * セーブデータがあれば復元、なければ新規地形生成して VoxelMap を返す。
 * eventBroker のセットまでこの関数で完結させる。
 */
export function restoreOrGenerateVoxelMap(saveData: SaveData | null, worldSize: Size2D, seed: string, eventBroker: IEventBroker): VoxelMap {
    let voxelMap: VoxelMap;
    if (saveData) {
        const sd = saveData.voxelMap;
        voxelMap = new VoxelMap(sd.width, sd.height, sd.depth, sd.horizonHeight);
        voxelMap.setVoxelsBuffer(new BigUint64Array(sd.voxels));
        voxelMap.setRiversideCells(new Uint32Array(sd.riversideCells));
    } else {
        voxelMap = generateTerrain(seed, { width: worldSize.w, height: 12, depth: worldSize.h, horizonHeight: 3 });
    }
    voxelMap.setEventBroker(eventBroker);
    return voxelMap;
}

export interface Storages {
    chestStorage: ChestStorage;
    forgeStorage: ForgeStorage;
    workbenchStorage: WorkbenchStorage;
    warpGateStorage: WarpGateStorage;
    manualProcessingStorage: ManualProcessingStorage;
    dailyProcessingStorage: DailyProcessingStorage;
    autoProcessingStorage: AutoProcessingStorage;
    cartStorage: CartStorage;
}

/**
 * 4種類のストレージを生成し、セーブデータがあれば復元、レジストリにも登録する。
 * Chest / Forge / Workbench / WarpGate の同型な初期化処理を一括化。
 */
export function bootstrapStorages(saveData: SaveData | null): Storages {
    const chestStorage = new ChestStorage();
    if (saveData) chestStorage.loadSaveData(saveData.chestStorage.chests);
    setChestStorage(chestStorage);

    const forgeStorage = new ForgeStorage();
    if (saveData) forgeStorage.loadSaveData(saveData.forgeStorage.forges);
    setForgeStorage(forgeStorage);

    const workbenchStorage = new WorkbenchStorage();
    if (saveData) workbenchStorage.loadSaveData(saveData.workbenchStorage.workbenches);
    setWorkbenchStorage(workbenchStorage);

    const warpGateStorage = new WarpGateStorage();
    if (saveData) warpGateStorage.loadSaveData(saveData.warpGateStorage);
    setWarpGateStorage(warpGateStorage);

    const manualProcessingStorage = new ManualProcessingStorage();
    if (saveData) manualProcessingStorage.loadSaveData(saveData.manualProcessingStorage.facilities);
    setManualProcessingStorage(manualProcessingStorage);

    const dailyProcessingStorage = new DailyProcessingStorage();
    if (saveData) dailyProcessingStorage.loadSaveData(saveData.dailyProcessingStorage.facilities);
    setDailyProcessingStorage(dailyProcessingStorage);

    const autoProcessingStorage = new AutoProcessingStorage();
    if (saveData) autoProcessingStorage.loadSaveData(saveData.autoProcessingStorage.facilities);
    setAutoProcessingStorage(autoProcessingStorage);

    const cartStorage = new CartStorage();
    if (saveData) cartStorage.loadSaveData(saveData.cartStorage);
    setCartStorage(cartStorage);

    return {
        chestStorage,
        forgeStorage,
        workbenchStorage,
        warpGateStorage,
        manualProcessingStorage,
        dailyProcessingStorage,
        autoProcessingStorage,
        cartStorage,
    };
}
