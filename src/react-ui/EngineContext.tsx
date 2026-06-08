import { createContext, type ReactNode, useContext } from "react";
import type {
    ICraftSystem,
    IEventBroker,
    IGameTimeReader,
    IInventoryWriter,
    IPlayerStateReader,
    IReputationSystemReader,
    IVoxelWriter,
} from "../_boundary/interfaces";
import type { BonfireStorage } from "../engine/BonfireStorage";
import type { CartStorage } from "../engine/CartStorage";
import type { ChatHistory } from "../engine/ChatHistory";
import type { FermentationStorage } from "../engine/FermentationStorage";
import type { MissionSystem } from "../engine/MissionSystem";
import type { SeedRequestSystem } from "../engine/SeedRequestSystem";
import type { StorageVault } from "../engine/StorageVault";
import type { UIState } from "../view/UIState";

/**
 * React UI 層が engine 状態にアクセスするためのコンテナ。
 * App.tsx の useGameEngine から提供される。
 */
export interface EngineRefs {
    inventory: IInventoryWriter;
    playerState: IPlayerStateReader;
    gameTime: IGameTimeReader;
    reputationSystem: IReputationSystemReader;
    seedRequestSystem: SeedRequestSystem;
    storageVault: StorageVault;
    bonfireStorage: BonfireStorage;
    fermentationStorage: FermentationStorage;
    cartStorage: CartStorage;
    craftSystem: ICraftSystem;
    voxelMap: IVoxelWriter;
    uiState: UIState;
    eventBroker: IEventBroker;
    missionSystem: MissionSystem;
    chatHistory: ChatHistory;
}

const EngineContext = createContext<EngineRefs | null>(null);

export function EngineProvider({ engine, children }: { engine: EngineRefs; children: ReactNode }) {
    return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useEngine(): EngineRefs {
    const ctx = useContext(EngineContext);
    if (!ctx) throw new Error("useEngine must be used inside EngineProvider");
    return ctx;
}
