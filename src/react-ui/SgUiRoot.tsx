import { useEffect, useState } from "react";
import { DialogView } from "./components/DialogView";
import { MissionPanel } from "./components/MissionPanel";
import { Toolbar } from "./components/Toolbar";
import { EngineProvider, type EngineRefs, useEngine } from "./EngineContext";
import { useUIMode } from "./hooks/useUIMode";

// パネルの自己登録（モジュールロード時の副作用）
// 新しいパネルを追加する時はここに 1 行追加するだけ。
import "./panels/AutoProcessingPanel";
import "./panels/BonfirePanel";
import "./panels/CartPanel";
import "./panels/ChestPanel";
import "./panels/DailyProcessingPanel";
import "./panels/DistillerPanel";
import "./panels/FermentationPanel";
import "./panels/ForgePanel";
import "./panels/InventoryPanel";
import "./panels/ManualProcessingPanel";
import "./panels/SaltPanPanel";
import "./panels/WarpGatePanel";

import { PropertyPanel } from "./components/PropertyPanel";
import { getRegisteredPanels } from "./PanelRegistry";
import { ChatLogPanel } from "./panels/ChatLogPanel";
import { GuidePanel } from "./panels/GuidePanel";
import "./styles.css";
import type { UIMode } from "../view/UIState";

/**
 * React UI 層のルート。canvas の上に重ねるオーバーレイとして配置する。
 * 自身は pointer-events: none。各パネルだけが pointer-events: auto を持つ。
 */
export function SgUiRoot({ engine, onSave, saveState }: { engine: EngineRefs; onSave: () => Promise<void>; saveState: "idle" | "saving" | "done" }) {
    const [guideOpen, setGuideOpen] = useState(false);
    const [backLogOpen, setBackLogOpen] = useState(false);

    // 右側オーバーレイ（Guide / ChatLog / ゲーム系パネル）は常に 1 枚だけにする排他制御。
    // mode はここで一度だけ観測し、PanelDispatcher に渡す（useUIMode の RAF ループを二重化しない）。
    const mode = useUIMode(engine.uiState, engine.eventBroker);

    // ゲーム系パネルが開いたら Guide / ChatLog を閉じる。
    useEffect(() => {
        if (mode !== "normal") {
            setGuideOpen(false);
            setBackLogOpen(false);
        }
    }, [mode]);

    // Guide / ChatLog を開くときはゲーム系パネルと相手側オーバーレイを閉じる（トグルは維持）。
    const toggleGuide = () => {
        engine.uiState.mode = "normal";
        engine.uiState.targetPos = null;
        setBackLogOpen(false);
        setGuideOpen((v) => !v);
    };
    const toggleBackLog = () => {
        engine.uiState.mode = "normal";
        engine.uiState.targetPos = null;
        setGuideOpen(false);
        setBackLogOpen((v) => !v);
    };

    const saveLabel = saveState === "saving" ? "SAVING..." : saveState === "done" ? "SAVED!" : "SAVE";

    return (
        <EngineProvider engine={engine}>
            <div className="sg-ui-root">
                <PropertyPanel />
                <div className="sg-corner-buttons">
                    <button type="button" className="sg-guide-button" onClick={toggleGuide} aria-label="プレイガイドを開く">
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
                    <button type="button" className="sg-backlog-button" onClick={toggleBackLog} aria-label="会話ログを開く">
                        BackLog
                    </button>
                </div>
                <GuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />
                <ChatLogPanel open={backLogOpen} onClose={() => setBackLogOpen(false)} />
                <MissionPanel />
                <DialogView />
                <PanelDispatcher mode={mode} />
            </div>
        </EngineProvider>
    );
}

function PanelDispatcher({ mode }: { mode: UIMode }) {
    const engine = useEngine();
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
