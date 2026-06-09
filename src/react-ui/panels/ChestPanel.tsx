import { useCallback } from "react";
import type { IInventoryWriter, ItemStack } from "../../_boundary/interfaces";
import type { SlotStorage } from "../../engine/SlotStorage";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";
import { toInventorySlotRef } from "./slotRef";

const CHEST_ROWS = 8;
const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type ChestSlotArea = "inventory" | "toolbar" | "chest";
type ChestSlotRef = { area: ChestSlotArea; index: number };

export interface ChestPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    chest: SlotStorage;
    uiState: UIState;
}

export function ChestPanel({ open, inventory, chest, uiState }: ChestPanelProps) {
    useFrameTick(open);
    const targetPos = uiState.targetPos;

    const getSlot = useCallback(
        (ref: ChestSlotRef): ItemStack | null => {
            if (ref.area === "chest") {
                return targetPos ? chest.getSlot(targetPos, "main", ref.index) : null;
            }
            return inventory.getSlot(toInventorySlotRef(ref));
        },
        [inventory, chest, targetPos],
    );

    const setSlot = useCallback(
        (ref: ChestSlotRef, stack: ItemStack | null) => {
            if (ref.area === "chest") {
                if (targetPos) chest.setSlot(targetPos, "main", ref.index, stack);
                return;
            }
            inventory.setSlot(toInventorySlotRef(ref), stack);
        },
        [inventory, chest, targetPos],
    );

    const getQuickTransferTargets = useCallback(
        (ref: ChestSlotRef): ChestSlotRef[] | undefined => {
            const chestTotal = CHEST_ROWS * COLS;
            const invTotal = INV_ROWS * COLS;
            if (ref.area === "chest") {
                // chest → inventory → toolbar 1..9 (hand=0 を除外)
                const targets: ChestSlotRef[] = [];
                for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
                for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
                return targets;
            }
            // inventory / toolbar → chest
            if (!targetPos) return undefined;
            const targets: ChestSlotRef[] = [];
            for (let i = 0; i < chestTotal; i++) targets.push({ area: "chest", index: i });
            return targets;
        },
        [targetPos],
    );

    const getQuickTransferSources = useCallback((ref: ChestSlotRef): ChestSlotRef[] => {
        const chestTotal = CHEST_ROWS * COLS;
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "chest") {
            const sources: ChestSlotRef[] = [];
            for (let i = 0; i < chestTotal; i++) sources.push({ area: "chest", index: i });
            return sources;
        }
        // inventory + toolbar(1..9) を同じ側として扱う
        const sources: ChestSlotRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<ChestSlotRef>(open, {
        getSlot,
        setSlot,
        getQuickTransferTargets,
        getQuickTransferSources,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.targetPos = null;
    }, [uiState]);

    return (
        <>
            <SidePanel open={open} title="Chest" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Chest Contents</h3>
                    <InventoryGrid
                        rows={CHEST_ROWS}
                        cols={COLS}
                        getStack={(i) => (targetPos ? chest.getSlot(targetPos, "main", i) : null)}
                        onLeftClick={(i, e) => handleLeftClick({ area: "chest", index: i }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "chest", index: i })}
                    />
                </section>

                <hr className="sg-section-divider" />

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Inventory</h3>
                    <InventoryGrid
                        rows={INV_ROWS}
                        cols={COLS}
                        getStack={(i) => inventory.getSlot({ area: "inventory", index: i })}
                        onLeftClick={(i, e) => handleLeftClick({ area: "inventory", index: i }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "inventory", index: i })}
                    />
                </section>

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Toolbar</h3>
                    <InventoryGrid
                        rows={1}
                        cols={TOOLBAR_COLS}
                        getStack={(i) => inventory.getSlot({ area: "toolbar", index: i + 1 })}
                        onLeftClick={(i, e) => handleLeftClick({ area: "toolbar", index: i + 1 }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "toolbar", index: i + 1 })}
                    />
                </section>
            </SidePanel>

            <CursorStack stack={pickedUp} x={cursorPos.x} y={cursorPos.y} />
        </>
    );
}

registerPanel({
    mode: "chest",
    component: ({ open, engine }) => (
        <ChestPanel open={open} inventory={engine.inventory} chest={engine.storageVault.get<SlotStorage>("chest")} uiState={engine.uiState} />
    ),
});
