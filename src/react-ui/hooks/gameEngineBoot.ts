import type { IEventBroker } from "../../_boundary/interfaces";
import { setAutoProcessingStorage } from "../../_registry/entities/AutoProcessing";
import { setBonfireStorage } from "../../_registry/entities/Bonfire";
import { setCartStorage } from "../../_registry/entities/Cart";
import { setChestStorage } from "../../_registry/entities/Chest";
import { setDailyProcessingStorage } from "../../_registry/entities/DailyProcessing";
import { setDistillerStorage } from "../../_registry/entities/Distiller";
import { setFermentationStorage } from "../../_registry/entities/FermentationVat";
import { setForgeStorage } from "../../_registry/entities/Forge";
import { setManualProcessingStorage } from "../../_registry/entities/ManualProcessing";
import { setSaltPanStorage } from "../../_registry/entities/Saltpan";
import { setSoakingBasketStorage } from "../../_registry/entities/SoakingBasket";
import { setWarpGateStorage } from "../../_registry/entities/WarpGate";
import { setWorkbenchStorage } from "../../_registry/entities/Workbench";
import { AutoProcessingStorage } from "../../engine/AutoProcessingStorage";
import { BonfireStorage } from "../../engine/BonfireStorage";
import { CartStorage } from "../../engine/CartStorage";
import { DistillerStorage } from "../../engine/DistillerStorage";
import { FermentationStorage } from "../../engine/FermentationStorage";
import { ChestStorage } from "../../engine/ChestStorage";
import { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import { ForgeStorage } from "../../engine/ForgeStorage";
import { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import { SaltPanStorage } from "../../engine/SaltPanStorage";
import { setStationStorages } from "../../engine/StationSystem";
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

    const bonfireStorage = new BonfireStorage();
    if (saveData) bonfireStorage.loadSaveData(saveData.bonfireStorage.bonfires);
    setBonfireStorage(bonfireStorage);

    const distillerStorage = new DistillerStorage();
    if (saveData) distillerStorage.loadSaveData(saveData.distillerStorage.distillers);
    setDistillerStorage(distillerStorage);

    const saltPanStorage = new SaltPanStorage();
    if (saveData) saltPanStorage.loadSaveData(saveData.saltPanStorage.saltpans);
    setSaltPanStorage(saltPanStorage);

    const fermentationStorage = new FermentationStorage();
    if (saveData) fermentationStorage.loadSaveData(saveData.fermentationStorage.vats);
    setFermentationStorage(fermentationStorage);

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
    setSoakingBasketStorage(dailyProcessingStorage); // 浸漬槽は独立エンティティだが storage を共有

    const autoProcessingStorage = new AutoProcessingStorage();
    if (saveData) autoProcessingStorage.loadSaveData(saveData.autoProcessingStorage.facilities);
    setAutoProcessingStorage(autoProcessingStorage);

    // ステーション（フォーク搬送）は chest / daily / auto の3ストレージにアクセスする
    setStationStorages(chestStorage, dailyProcessingStorage, autoProcessingStorage);

    const cartStorage = new CartStorage();
    if (saveData) cartStorage.loadSaveData(saveData.cartStorage);
    setCartStorage(cartStorage);

    return {
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
    };
}
