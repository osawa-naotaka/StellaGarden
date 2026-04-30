import { useCallback } from "react";
import type { IInventoryWriter, IReputationSystemReader, ItemStack, SlotRef } from "../../_boundary/interfaces";
import type { WarpGateStorage } from "../../engine/WarpGateStorage";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { TierList } from "../components/TierList";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";

const EARTH_INV_ROWS = 4;
const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type WarpGateSlotArea = "inventory" | "toolbar" | "warp_gate";
type WarpGateSlotRef = { area: WarpGateSlotArea; index: number };

export interface WarpGatePanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    warpGateStorage: WarpGateStorage;
    reputationSystem: IReputationSystemReader;
    uiState: UIState;
}

export function WarpGatePanel({ open, inventory, warpGateStorage, reputationSystem, uiState }: WarpGatePanelProps) {
    useFrameTick(open);

    const getSlot = useCallback(
        (ref: WarpGateSlotRef): ItemStack | null => {
            if (ref.area === "warp_gate") return warpGateStorage.getSlot(ref.index);
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, warpGateStorage],
    );

    const setSlot = useCallback(
        (ref: WarpGateSlotRef, stack: ItemStack | null) => {
            if (ref.area === "warp_gate") {
                warpGateStorage.setSlot(ref.index, stack);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, warpGateStorage],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<WarpGateSlotRef>(open, {
        getSlot,
        setSlot,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.warpGatePos = null;
    }, [uiState]);

    const tiers = reputationSystem.getAllTierProgress();
    const points = reputationSystem.getPoints();
    let preview = 0;
    for (const stack of warpGateStorage.getSlots()) {
        if (stack) preview += reputationSystem.calculateStackPoints(stack.itemId, stack.count);
    }

    return (
        <>
            <SidePanel open={open} title="Warp Gate" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Reputation</h3>
                    <div className="sg-reputation">
                        <span className="sg-reputation-value">{points} pt</span>
                        <span className="sg-reputation-shipment">+{preview} pt on shipment</span>
                    </div>
                </section>

                <hr className="sg-section-divider" />

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Earth Inventory</h3>
                    <InventoryGrid
                        rows={EARTH_INV_ROWS}
                        cols={COLS}
                        getStack={(i) => warpGateStorage.getSlot(i)}
                        onLeftClick={(i) => handleLeftClick({ area: "warp_gate", index: i })}
                        onRightClick={(i) => handleRightClick({ area: "warp_gate", index: i })}
                    />
                </section>

                <hr className="sg-section-divider" />

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Tier Progression</h3>
                    <TierList tiers={tiers} />
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
    mode: "warp_gate",
    component: ({ open, engine }) => (
        <WarpGatePanel
            open={open}
            inventory={engine.inventory}
            warpGateStorage={engine.warpGateStorage}
            reputationSystem={engine.reputationSystem}
            uiState={engine.uiState}
        />
    ),
});
