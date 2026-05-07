import { useCallback, useState } from "react";
import "./_registry";
import type { SaveSlot } from "./lib/SaveSystem";
import { useGameEngine } from "./react-ui/hooks/useGameEngine";
import { SgUiRoot } from "./react-ui/SgUiRoot";
import { SlotSelectScreen } from "./react-ui/screens/SlotSelectScreen";
import { TitleScreen } from "./react-ui/screens/TitleScreen";

type AppMode = "title" | "slot-new" | "slot-load" | "game";

function GameScreen({ saveSlot, shouldLoad }: { saveSlot: SaveSlot; shouldLoad: boolean }) {
    const { containerRef, engineRefs, requestSave, saveState } = useGameEngine({ w: 400, h: 400 }, saveSlot, shouldLoad);
    return (
        <>
            <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />
            {engineRefs && <SgUiRoot engine={engineRefs} onSave={requestSave} saveState={saveState} />}
        </>
    );
}

export default function App() {
    const [mode, setMode] = useState<AppMode>("title");
    const [selectedSlot, setSelectedSlot] = useState<SaveSlot>(1);
    const [shouldLoad, setShouldLoad] = useState(false);

    const handleSelectSlot = useCallback((slot: SaveSlot, load: boolean) => {
        setSelectedSlot(slot);
        setShouldLoad(load);
        setMode("game");
    }, []);

    if (mode === "title") {
        return <TitleScreen onNewGame={() => setMode("slot-new")} onContinue={() => setMode("slot-load")} />;
    }
    if (mode === "slot-new") {
        return <SlotSelectScreen mode="new" onSelect={(slot) => handleSelectSlot(slot, false)} onBack={() => setMode("title")} />;
    }
    if (mode === "slot-load") {
        return <SlotSelectScreen mode="load" onSelect={(slot) => handleSelectSlot(slot, true)} onBack={() => setMode("title")} />;
    }
    return <GameScreen saveSlot={selectedSlot} shouldLoad={shouldLoad} />;
}
