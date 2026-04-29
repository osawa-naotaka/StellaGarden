import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { IInventoryWriter, IReputationSystemReader, ItemStack, SlotRef } from "../../_boundary/interfaces";
import { getItemDef } from "../../_registry/ItemRegistry";
import type { WarpGateStorage } from "../../engine/WarpGateStorage";
import type { UIState } from "../../view/UIState";
import { InventoryGrid } from "../components/InventoryGrid";
import { ItemIcon } from "../components/ItemIcon";
import { SidePanel } from "../components/SidePanel";
import { TierList } from "../components/TierList";
import { useFrameTick } from "../hooks/useFrameTick";

const EARTH_INV_ROWS = 4;
const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type WarpGateSlotArea = "inventory" | "toolbar" | "warp_gate";
type WarpGateSlotRef = { area: WarpGateSlotArea; index: number };

interface PickedUp {
    stack: ItemStack;
    source: WarpGateSlotRef;
}

export interface WarpGatePanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    warpGateStorage: WarpGateStorage;
    reputationSystem: IReputationSystemReader;
    uiState: UIState;
}

export function WarpGatePanel({ open, inventory, warpGateStorage, reputationSystem, uiState }: WarpGatePanelProps) {
    useFrameTick(open);

    const [pickedUp, setPickedUp] = useState<PickedUp | null>(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

    // 開閉切替時にピックアップを元に戻す
    useEffect(() => {
        if (open) return;
        if (!pickedUp) return;
        setSlotByRef(inventory, warpGateStorage, pickedUp.source, pickedUp.stack);
        setPickedUp(null);
    }, [open, pickedUp, inventory, warpGateStorage]);

    useEffect(() => {
        if (!open) return;
        const onMove = (e: MouseEvent | globalThis.MouseEvent) => {
            setCursorPos({ x: (e as globalThis.MouseEvent).clientX, y: (e as globalThis.MouseEvent).clientY });
        };
        window.addEventListener("mousemove", onMove as EventListener);
        return () => window.removeEventListener("mousemove", onMove as EventListener);
    }, [open]);

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.warpGatePos = null;
    }, [uiState]);

    const handleLeftClick = useCallback(
        (ref: WarpGateSlotRef) => {
            const target = getSlotByRef(inventory, warpGateStorage, ref);
            if (!pickedUp) {
                if (target) {
                    setPickedUp({ stack: { ...target }, source: ref });
                    setSlotByRef(inventory, warpGateStorage, ref, null);
                }
                return;
            }
            if (!target) {
                setSlotByRef(inventory, warpGateStorage, ref, pickedUp.stack);
                setPickedUp(null);
                return;
            }
            if (target.itemId === pickedUp.stack.itemId) {
                const max = getItemDef(pickedUp.stack.itemId)?.maxStack ?? 64;
                const canAdd = max - target.count;
                const adding = Math.min(canAdd, pickedUp.stack.count);
                target.count += adding;
                setSlotByRef(inventory, warpGateStorage, ref, target);
                const remaining = pickedUp.stack.count - adding;
                if (remaining === 0) setPickedUp(null);
                else setPickedUp({ ...pickedUp, stack: { ...pickedUp.stack, count: remaining } });
                return;
            }
            // 異種交換
            setSlotByRef(inventory, warpGateStorage, ref, pickedUp.stack);
            setPickedUp({ stack: target, source: ref });
        },
        [inventory, warpGateStorage, pickedUp],
    );

    const handleRightClick = useCallback(
        (ref: WarpGateSlotRef) => {
            if (!pickedUp) {
                const stack = getSlotByRef(inventory, warpGateStorage, ref);
                if (!stack) return;
                const taken: ItemStack = { itemId: stack.itemId, count: 1 };
                if (stack.count === 1) setSlotByRef(inventory, warpGateStorage, ref, null);
                else setSlotByRef(inventory, warpGateStorage, ref, { itemId: stack.itemId, count: stack.count - 1 });
                setPickedUp({ stack: taken, source: ref });
                return;
            }
            const target = getSlotByRef(inventory, warpGateStorage, ref);
            if (!target) {
                setSlotByRef(inventory, warpGateStorage, ref, { itemId: pickedUp.stack.itemId, count: 1 });
                const remaining = pickedUp.stack.count - 1;
                if (remaining === 0) setPickedUp(null);
                else setPickedUp({ ...pickedUp, stack: { ...pickedUp.stack, count: remaining } });
                return;
            }
            if (target.itemId === pickedUp.stack.itemId) {
                const max = getItemDef(pickedUp.stack.itemId)?.maxStack ?? 64;
                if (target.count < max) {
                    target.count += 1;
                    setSlotByRef(inventory, warpGateStorage, ref, target);
                    const remaining = pickedUp.stack.count - 1;
                    if (remaining === 0) setPickedUp(null);
                    else setPickedUp({ ...pickedUp, stack: { ...pickedUp.stack, count: remaining } });
                }
            }
        },
        [inventory, warpGateStorage, pickedUp],
    );

    // ─── 表示用データ ──────────────────────────────────────
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

            {pickedUp && (
                <div className="sg-cursor-stack" style={{ left: cursorPos.x, top: cursorPos.y }}>
                    <ItemIcon itemId={pickedUp.stack.itemId} />
                    {pickedUp.stack.count >= 2 && <span className="sg-slot-count">{pickedUp.stack.count}</span>}
                </div>
            )}
        </>
    );
}

// ─── 共通ヘルパ ────────────────────────────────────────────
function getSlotByRef(inventory: IInventoryWriter, warpGateStorage: WarpGateStorage, ref: WarpGateSlotRef): ItemStack | null {
    if (ref.area === "warp_gate") return warpGateStorage.getSlot(ref.index);
    return inventory.getSlot(ref as SlotRef);
}

function setSlotByRef(
    inventory: IInventoryWriter,
    warpGateStorage: WarpGateStorage,
    ref: WarpGateSlotRef,
    stack: ItemStack | null,
): void {
    if (ref.area === "warp_gate") {
        warpGateStorage.setSlot(ref.index, stack);
        return;
    }
    inventory.setSlot(ref as SlotRef, stack);
}
