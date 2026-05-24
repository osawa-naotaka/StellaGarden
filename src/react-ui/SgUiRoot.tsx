import { useState } from "react";
import { DialogView } from "./components/DialogView";
import { MissionPanel } from "./components/MissionPanel";
import { Toolbar } from "./components/Toolbar";
import { EngineProvider, type EngineRefs, useEngine } from "./EngineContext";
import { useUIMode } from "./hooks/useUIMode";

// パネルの自己登録（モジュールロード時の副作用）
// 新しいパネルを追加する時はここに 1 行追加するだけ。
import "./panels/AutoProcessingPanel";
import "./panels/CartPanel";
import "./panels/ChestPanel";
import "./panels/DailyProcessingPanel";
import "./panels/ForgePanel";
import "./panels/InventoryPanel";
import "./panels/ManualProcessingPanel";
import "./panels/WarpGatePanel";
import "./panels/WinchPanel";

import { PropertyPanel } from "./components/PropertyPanel";
import { getRegisteredPanels } from "./PanelRegistry";
import { ChatLogPanel } from "./panels/ChatLogPanel";
import { GuidePanel } from "./panels/GuidePanel";
import "./styles.css";

/**
 * React UI 層のルート。canvas の上に重ねるオーバーレイとして配置する。
 * 自身は pointer-events: none。各パネルだけが pointer-events: auto を持つ。
 */
export function SgUiRoot({ engine, onSave, saveState }: { engine: EngineRefs; onSave: () => Promise<void>; saveState: "idle" | "saving" | "done" }) {
    const [guideOpen, setGuideOpen] = useState(false);
    const [backLogOpen, setBackLogOpen] = useState(false);

    const saveLabel = saveState === "saving" ? "SAVING..." : saveState === "done" ? "SAVED!" : "SAVE";

    return (
        <EngineProvider engine={engine}>
            <div className="sg-ui-root">
                <PropertyPanel />
                <div className="sg-corner-buttons">
                    <button type="button" className="sg-guide-button" onClick={() => setGuideOpen((v) => !v)} aria-label="プレイガイドを開く">
                        GUIDE
                    </button>
                    <button
                        type="button"
                        className={`sg-save-button${saveState === "done" ? " is-done" : ""}`}
                        onClick={onSave}
                        disabled={saveState !== "idle"}
                        aria-label="ゲームを保存する"
                    >
                        {saveLabel}
                    </button>
                    <button type="button" className="sg-backlog-button" onClick={() => setBackLogOpen((v) => !v)} aria-label="会話ログを開く">
                        BackLog
                    </button>
                </div>
                <GuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />
                <ChatLogPanel open={backLogOpen} onClose={() => setBackLogOpen(false)} />
                <MissionPanel />
                <DialogView />
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
            <Toolbar inventory={engine.inventory} mode={mode} uiState={engine.uiState} />
            {panels.map(({ mode: panelMode, component: PanelComponent }) => (
                <PanelComponent key={panelMode} open={mode === panelMode} engine={engine} />
            ))}
        </>
    );
}
