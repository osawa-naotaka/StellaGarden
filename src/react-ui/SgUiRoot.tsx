import { useState } from "react";
import { Toolbar } from "./components/Toolbar";
import { EngineProvider, type EngineRefs, useEngine } from "./EngineContext";
import { useUIMode } from "./hooks/useUIMode";

// パネルの自己登録（モジュールロード時の副作用）
// 新しいパネルを追加する時はここに 1 行追加するだけ。
import "./panels/ChestPanel";
import "./panels/ForgePanel";
import "./panels/InventoryPanel";
import "./panels/WarpGatePanel";

import { getRegisteredPanels } from "./PanelRegistry";
import { GuidePanel } from "./panels/GuidePanel";
import "./styles.css";

/**
 * React UI 層のルート。canvas の上に重ねるオーバーレイとして配置する。
 * 自身は pointer-events: none。各パネルだけが pointer-events: auto を持つ。
 */
export function SgUiRoot({ engine }: { engine: EngineRefs }) {
    const [guideOpen, setGuideOpen] = useState(false);

    return (
        <EngineProvider engine={engine}>
            <div className="sg-ui-root">
                <button
                    type="button"
                    className="sg-guide-button"
                    onClick={() => setGuideOpen((v) => !v)}
                    aria-label="プレイガイドを開く"
                >
                    GUIDE
                </button>
                <GuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />
                <PanelDispatcher />
            </div>
        </EngineProvider>
    );
}

function PanelDispatcher() {
    const engine = useEngine();
    const mode = useUIMode(engine.uiState, engine.eventBroker);
    const panels = getRegisteredPanels();

    return (
        <>
            <Toolbar inventory={engine.inventory} mode={mode} />
            {panels.map(({ mode: panelMode, component: PanelComponent }) => (
                <PanelComponent key={panelMode} open={mode === panelMode} engine={engine} />
            ))}
        </>
    );
}
