import { useCallback } from "react";
import type { ICraftSystem, IInventoryWriter, ItemStack, SlotRef } from "../../_boundary/interfaces";
import { getPlacementInfo, isPlaceable } from "../../_registry/ItemRegistry";
import type { UIState } from "../../view/UIState";
import { CraftPane } from "../components/CraftPane";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";

const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type InvSlotArea = "inventory" | "toolbar" | "craft_tool";
type InvSlotRef = { area: InvSlotArea; index: number };

export interface InventoryPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    craftSystem: ICraftSystem;
    uiState: UIState;
}

export function InventoryPanel({ open, inventory, craftSystem, uiState }: InventoryPanelProps) {
    useFrameTick(open);
    const station = uiState.craftStation;

    const getSlot = useCallback(
        (ref: InvSlotRef): ItemStack | null => {
            if (ref.area === "craft_tool") return craftSystem.getToolSlot();
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, craftSystem],
    );

    const setSlot = useCallback(
        (ref: InvSlotRef, stack: ItemStack | null) => {
            if (ref.area === "craft_tool") {
                craftSystem.setToolSlot(stack);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, craftSystem],
    );

    const onPlaceableRightClick = useCallback(
        (ref: InvSlotRef, stack: ItemStack): boolean => {
            if (ref.area === "craft_tool") return false;
            if (!isPlaceable(stack.itemId)) return false;
            const info = getPlacementInfo(stack.itemId);
            uiState.enterPlacementMode(stack.itemId, ref as SlotRef, info?.defaultVariant ?? 0);
            return true;
        },
        [uiState],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<InvSlotRef>(open, {
        getSlot,
        setSlot,
        onPlaceableRightClick,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.craftWorkbenchPos = null;
        uiState.craftStation = "hand";
    }, [uiState]);

    const title = station === "workbench" ? "Workbench" : "Inventory & Craft";

    return (
        <>
            <SidePanel open={open} title={title} onClose={close}>
                <CraftPane
                    craftSystem={craftSystem}
                    station={station}
                    pickedUp={pickedUp}
                    onToolSlotLeftClick={() => handleLeftClick({ area: "craft_tool", index: 0 })}
                    isPaused={uiState.isPaused}
                />

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
    mode: "inventory-craft",
    component: ({ open, engine }) => (
        <InventoryPanel
            open={open}
            inventory={engine.inventory}
            craftSystem={engine.craftSystem}
            uiState={engine.uiState}
        />
    ),
});
