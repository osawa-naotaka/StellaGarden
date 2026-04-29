import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import type { ForgeSlotKind, ForgeStorage } from "../../engine/ForgeStorage";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { Slot } from "../components/Slot";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";

const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type ForgeSlotArea = "inventory" | "toolbar" | "forge_ingredient" | "forge_fuel" | "forge_output";
type ForgeSlotRef = { area: ForgeSlotArea; index: number };

const ALLOWED_ITEM_BY_KIND: Record<ForgeSlotKind, string> = {
    ingredient: "meteoric_iron",
    fuel: "charcoal",
    output: "hot_meteoric_iron",
};

export interface ForgePanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    forgeStorage: ForgeStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function ForgePanel({ open, inventory, forgeStorage, voxelMap, uiState }: ForgePanelProps) {
    useFrameTick(open);
    const forgePos = uiState.forgePos;

    const slotAreaToKind = useCallback((area: ForgeSlotArea): ForgeSlotKind | null => {
        if (area === "forge_ingredient") return "ingredient";
        if (area === "forge_fuel") return "fuel";
        if (area === "forge_output") return "output";
        return null;
    }, []);

    const getSlot = useCallback(
        (ref: ForgeSlotRef): ItemStack | null => {
            const kind = slotAreaToKind(ref.area);
            if (kind) return forgePos ? forgeStorage.getSlot(forgePos, kind) : null;
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, forgeStorage, forgePos, slotAreaToKind],
    );

    const setSlot = useCallback(
        (ref: ForgeSlotRef, stack: ItemStack | null) => {
            const kind = slotAreaToKind(ref.area);
            if (kind) {
                if (forgePos) forgeStorage.setSlot(forgePos, kind, stack, voxelMap);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, forgeStorage, voxelMap, forgePos, slotAreaToKind],
    );

    const canPlaceTo = useCallback(
        (ref: ForgeSlotRef, stack: ItemStack): boolean => {
            const kind = slotAreaToKind(ref.area);
            if (!kind) return true;
            return stack.itemId === ALLOWED_ITEM_BY_KIND[kind];
        },
        [slotAreaToKind],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<ForgeSlotRef>(open, {
        getSlot,
        setSlot,
        canPlaceTo,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.forgePos = null;
    }, [uiState]);

    const ingredient = forgePos ? forgeStorage.getSlot(forgePos, "ingredient") : null;
    const fuel = forgePos ? forgeStorage.getSlot(forgePos, "fuel") : null;
    const output = forgePos ? forgeStorage.getSlot(forgePos, "output") : null;
    const isBurning = forgePos ? forgeStorage.isBurning(forgePos) : false;

    return (
        <>
            <SidePanel open={open} title={isBurning ? "Forge (burning)" : "Forge"} onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Forge Slots</h3>
                    <div className="sg-forge-slots">
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">Ingredient</span>
                            <Slot
                                stack={ingredient}
                                onLeftClick={() => handleLeftClick({ area: "forge_ingredient", index: 0 })}
                                onRightClick={() => handleRightClick({ area: "forge_ingredient", index: 0 })}
                            />
                        </div>
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">Fuel</span>
                            <Slot
                                stack={fuel}
                                onLeftClick={() => handleLeftClick({ area: "forge_fuel", index: 0 })}
                                onRightClick={() => handleRightClick({ area: "forge_fuel", index: 0 })}
                            />
                        </div>
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">Output</span>
                            <Slot
                                stack={output}
                                onLeftClick={() => handleLeftClick({ area: "forge_output", index: 0 })}
                                onRightClick={() => handleRightClick({ area: "forge_output", index: 0 })}
                            />
                        </div>
                    </div>
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
