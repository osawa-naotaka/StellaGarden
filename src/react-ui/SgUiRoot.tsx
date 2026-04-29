import { Toolbar } from "./components/Toolbar";
import { EngineProvider, type EngineRefs, useEngine } from "./EngineContext";
import { useUIMode } from "./hooks/useUIMode";
import { ChestPanel } from "./panels/ChestPanel";
import { ForgePanel } from "./panels/ForgePanel";
import { InventoryPanel } from "./panels/InventoryPanel";
import { WarpGatePanel } from "./panels/WarpGatePanel";
import "./styles.css";

/**
 * React UI 層のルート。canvas の上に重ねるオーバーレイとして配置する。
 * 自身は pointer-events: none。各パネルだけが pointer-events: auto を持つ。
 */
export function SgUiRoot({ engine }: { engine: EngineRefs }) {
    return (
        <EngineProvider engine={engine}>
            <div className="sg-ui-root">
                <PanelDispatcher />
            </div>
        </EngineProvider>
    );
}

function PanelDispatcher() {
    const engine = useEngine();
    const mode = useUIMode(engine.uiState, engine.eventBroker);

    return (
        <>
            <Toolbar inventory={engine.inventory} mode={mode} />

            <InventoryPanel
                open={mode === "inventory-craft"}
                inventory={engine.inventory}
                craftSystem={engine.craftSystem}
                uiState={engine.uiState}
            />

            <ChestPanel open={mode === "chest"} inventory={engine.inventory} chestStorage={engine.chestStorage} uiState={engine.uiState} />

            <ForgePanel
                open={mode === "forge"}
                inventory={engine.inventory}
                forgeStorage={engine.forgeStorage}
                voxelMap={engine.voxelMap}
                uiState={engine.uiState}
            />

            <WarpGatePanel
                open={mode === "warp_gate"}
                inventory={engine.inventory}
                warpGateStorage={engine.warpGateStorage}
                reputationSystem={engine.reputationSystem}
                uiState={engine.uiState}
            />
        </>
    );
}
