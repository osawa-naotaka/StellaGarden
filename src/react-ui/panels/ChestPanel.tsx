import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, SlotRef } from "../../_boundary/interfaces";
import type { ChestStorage } from "../../engine/ChestStorage";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";

const CHEST_ROWS = 8;
const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type ChestSlotArea = "inventory" | "toolbar" | "chest";
type ChestSlotRef = { area: ChestSlotArea; index: number };

export interface ChestPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    chestStorage: ChestStorage;
    uiState: UIState;
}

export function ChestPanel({ open, inventory, chestStorage, uiState }: ChestPanelProps) {
    useFrameTick(open);
    const chestPos = uiState.chestPos;

    const getSlot = useCallback(
        (ref: ChestSlotRef): ItemStack | null => {
            if (ref.area === "chest") {
                return chestPos ? chestStorage.getSlot(chestPos, ref.index) : null;
            }
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, chestStorage, chestPos],
    );

    const setSlot = useCallback(
        (ref: ChestSlotRef, stack: ItemStack | null) => {
            if (ref.area === "chest") {
                if (chestPos) chestStorage.setSlot(chestPos, ref.index, stack);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, chestStorage, chestPos],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<ChestSlotRef>(open, {
        getSlot,
        setSlot,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.chestPos = null;
    }, [uiState]);

    return (
        <>
            <SidePanel open={open} title="Chest" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Chest Contents</h3>
                    <InventoryGrid
                        rows={CHEST_ROWS}
                        cols={COLS}
                        getStack={(i) => (chestPos ? chestStorage.getSlot(chestPos, i) : null)}
                        onLeftClick={(i) => handleLeftClick({ area: "chest", index: i })}
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
                        onLeftClick={(i) => handleLeftClick({ area: "inventory", index: i })}
                        onRightClick={(i) => handleRightClick({ area: "inventory", index: i })}
                    />
                </section>

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Toolbar</h3>
                    <InventoryGrid
                        rows={1}
                        cols={TOOLBAR_COLS}
                        getStack={(i) => inventory.getSlot({ area: "toolbar", index: i + 1 })}
                        onLeftClick={(i) => handleLeftClick({ area: "toolbar", index: i + 1 })}
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
    component: ({ open, engine }) => <ChestPanel open={open} inventory={engine.inventory} chestStorage={engine.chestStorage} uiState={engine.uiState} />,
});
