import { useCallback, useState } from "react";
import "./_registry";
import type { SaveSlot } from "./lib/SaveSystem";
import { useGameEngine } from "./react-ui/hooks/useGameEngine";
import { SgUiRoot } from "./react-ui/SgUiRoot";
import { SeedInputScreen } from "./react-ui/screens/SeedInputScreen";
import { SlotSelectScreen } from "./react-ui/screens/SlotSelectScreen";
import { TitleScreen } from "./react-ui/screens/TitleScreen";

type AppMode = "title" | "slot-new" | "slot-load" | "seed-input" | "game";

function GameScreen({ saveSlot, shouldLoad, seed }: { saveSlot: SaveSlot; shouldLoad: boolean; seed: string }) {
    const { containerRef, engineRefs, requestSave, saveState } = useGameEngine({ w: 400, h: 400 }, saveSlot, shouldLoad, seed);
    return (
        <>
            <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />
            {engineRefs && <SgUiRoot engine={engineRefs} onSave={requestSave} saveState={saveState} />}
        </>
    );
}

export default function App() {
    const [mode, setMode] = useState<AppMode>("title");
    // selectedSlot は新規/ロード時に SlotSelectScreen から受け取る。初期値は空文字（未選択）。
    const [selectedSlot, setSelectedSlot] = useState<SaveSlot>("");
    const [shouldLoad, setShouldLoad] = useState(false);
    const [seed, setSeed] = useState("");

    const handleLoadSlotSelect = useCallback((slot: SaveSlot) => {
        setSelectedSlot(slot);
        setShouldLoad(true);
        setMode("game");
    }, []);

    if (mode === "title") {
        return <TitleScreen onNewGame={() => setMode("slot-new")} onContinue={() => setMode("slot-load")} />;
    }
    if (mode === "slot-new") {
        return (
            <SlotSelectScreen
                mode="new"
                onSelect={(slot) => {
                    setSelectedSlot(slot);
                    setMode("seed-input");
                }}
                onBack={() => setMode("title")}
            />
        );
    }
    if (mode === "slot-load") {
        return <SlotSelectScreen mode="load" onSelect={handleLoadSlotSelect} onBack={() => setMode("title")} />;
    }
    if (mode === "seed-input") {
        return (
            <SeedInputScreen
                onConfirm={(s) => {
                    setSeed(s);
                    setShouldLoad(false);
                    setMode("game");
                }}
                onBack={() => setMode("slot-new")}
            />
        );
    }
    return <GameScreen saveSlot={selectedSlot} shouldLoad={shouldLoad} seed={seed} />;
}
