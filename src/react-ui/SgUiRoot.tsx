import { EngineProvider, type EngineRefs, useEngine } from "./EngineContext";
import { useUIMode } from "./hooks/useUIMode";
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
