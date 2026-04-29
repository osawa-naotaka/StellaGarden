import { createContext, type ReactNode, useContext } from "react";
import type { ICraftSystem, IEventBroker, IInventoryWriter, IReputationSystemReader, IVoxelWriter } from "../_boundary/interfaces";
import type { ChestStorage } from "../engine/ChestStorage";
import type { ForgeStorage } from "../engine/ForgeStorage";
import type { WarpGateStorage } from "../engine/WarpGateStorage";
import type { UIState } from "../view/UIState";

/**
 * React UI 層が engine 状態にアクセスするためのコンテナ。
 * App.tsx の useGameEngine から提供される。
 */
export interface EngineRefs {
    inventory: IInventoryWriter;
    warpGateStorage: WarpGateStorage;
    reputationSystem: IReputationSystemReader;
    chestStorage: ChestStorage;
    forgeStorage: ForgeStorage;
    craftSystem: ICraftSystem;
    voxelMap: IVoxelWriter;
    uiState: UIState;
    eventBroker: IEventBroker;
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
