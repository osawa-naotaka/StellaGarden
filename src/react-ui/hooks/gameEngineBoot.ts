import type { IEventBroker } from "../../_boundary/interfaces";
import { setBonfireStorage } from "../../_registry/entities/Bonfire";
import { setCartStorage } from "../../_registry/entities/Cart";
import { setFermentationStorage } from "../../_registry/entities/FermentationVat";
import { loadStorages } from "../../_registry/StorageRegistry";
import { BonfireStorage } from "../../engine/BonfireStorage";
import { CartStorage } from "../../engine/CartStorage";
import { FermentationStorage } from "../../engine/FermentationStorage";
import type { SlotStorage } from "../../engine/SlotStorage";
import { setStationStorages } from "../../engine/StationSystem";
import { getStorageFactories, StorageVault } from "../../engine/StorageVault";
import { generateTerrain } from "../../engine/TerrainGenerator";
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
    bonfireStorage: BonfireStorage;
    fermentationStorage: FermentationStorage;
    cartStorage: CartStorage;
    storageVault: StorageVault;
}

/**
 * 4種類のストレージを生成し、セーブデータがあれば復元、レジストリにも登録する。
 * Chest / Forge / Workbench / WarpGate の同型な初期化処理を一括化。
 */
export function bootstrapStorages(saveData: SaveData | null): Storages {
    if (saveData) {
        loadStorages(saveData.storage);
    }

    const storageVault = new StorageVault();
    storageVault.init(getStorageFactories());
    if (saveData) {
        storageVault.loadSaveData(saveData.storageVault);
    }

    const bonfireStorage = new BonfireStorage();
    if (saveData) bonfireStorage.loadSaveData(saveData.bonfireStorage.bonfires);
    setBonfireStorage(bonfireStorage);

    const fermentationStorage = new FermentationStorage();
    if (saveData) fermentationStorage.loadSaveData(saveData.fermentationStorage.vats);
    setFermentationStorage(fermentationStorage);

    // ステーション（フォーク搬送）は chest / daily / auto のストレージにアクセスする
    setStationStorages(bonfireStorage, storageVault.get<SlotStorage>("chest"));

    const cartStorage = new CartStorage();
    if (saveData) cartStorage.loadSaveData(saveData.cartStorage);
    setCartStorage(cartStorage);

    return {
        bonfireStorage,
        fermentationStorage,
        cartStorage,
        storageVault,
    };
}
