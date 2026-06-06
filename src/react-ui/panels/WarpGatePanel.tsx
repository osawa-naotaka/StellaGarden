import { useCallback } from "react";
import type { IInventoryWriter, IReputationSystemReader, ItemStack, SlotRef } from "../../_boundary/interfaces";
import { SEED_REQUEST_DEFS, SEED_STACK_COUNT, type SeedRequestSystem } from "../../engine/SeedRequestSystem";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { ItemIcon } from "../components/ItemIcon";
import { SidePanel } from "../components/SidePanel";
import { TierList } from "../components/TierList";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";
import { getStorageSet, getStorageSlot, setStorageSlot, type StorageSet } from "../../_registry/StorageRegistry";

const EARTH_INV_ROWS = 4;
const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type WarpGateSlotArea = "inventory" | "toolbar" | "warp_gate";
type WarpGateSlotRef = { area: WarpGateSlotArea; index: number };

export interface WarpGatePanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    warpGateStorage:  StorageSet | null;
    reputationSystem: IReputationSystemReader;
    seedRequestSystem: SeedRequestSystem;
    uiState: UIState;
}

export function WarpGatePanel({ open, inventory, warpGateStorage, reputationSystem, seedRequestSystem, uiState }: WarpGatePanelProps) {
    useFrameTick(open);
    const targetPos = uiState.targetPos;

    const getSlot = useCallback(
        (ref: WarpGateSlotRef): ItemStack | null => {
            if (ref.area === "warp_gate") return targetPos ? getStorageSlot("warp_gate", targetPos, "main", ref.index) : null;
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, warpGateStorage],
    );

    const setSlot = useCallback(
        (ref: WarpGateSlotRef, stack: ItemStack | null) => {
            if (ref.area === "warp_gate") {
                if (targetPos) {
                    setStorageSlot("warp_gate", targetPos, "main", ref.index, stack);
                    return;
                }
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, warpGateStorage],
    );

    const getQuickTransferTargets = useCallback((ref: WarpGateSlotRef): WarpGateSlotRef[] | undefined => {
        const warpTotal = EARTH_INV_ROWS * COLS;
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "warp_gate") {
            const targets: WarpGateSlotRef[] = [];
            for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
            for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
            return targets;
        }
        const targets: WarpGateSlotRef[] = [];
        for (let i = 0; i < warpTotal; i++) targets.push({ area: "warp_gate", index: i });
        return targets;
    }, []);

    const getQuickTransferSources = useCallback((ref: WarpGateSlotRef): WarpGateSlotRef[] => {
        const warpTotal = EARTH_INV_ROWS * COLS;
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "warp_gate") {
            const sources: WarpGateSlotRef[] = [];
            for (let i = 0; i < warpTotal; i++) sources.push({ area: "warp_gate", index: i });
            return sources;
        }
        const sources: WarpGateSlotRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<WarpGateSlotRef>(open, {
        getSlot,
        setSlot,
        getQuickTransferTargets,
        getQuickTransferSources,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.targetPos = null;
    }, [uiState]);

    const handleSeedRequest = useCallback(
        (seedId: (typeof SEED_REQUEST_DEFS)[number]["seedId"]) => {
            // 同じ種を再度押したら取り消し、それ以外は上書きリクエスト（1日1件）。
            if (seedRequestSystem.getPending() === seedId) {
                seedRequestSystem.cancel();
            } else {
                seedRequestSystem.request(seedId);
            }
        },
        [seedRequestSystem],
    );

    const pendingSeed = seedRequestSystem.getPending();

    const tiers = reputationSystem.getAllTierProgress();
    const points = reputationSystem.getPoints();
    let preview = 0;
    for (const stack of getStorageSet("warp_gate", uiState.targetPos)?.main ?? []) {
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
                        getStack={(i) => uiState.targetPos ? getStorageSlot("warp_gate", uiState.targetPos, "main", i) : null }
                        onLeftClick={(i, e) => handleLeftClick({ area: "warp_gate", index: i }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "warp_gate", index: i })}
                    />
                </section>

                <hr className="sg-section-divider" />

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Seed Request</h3>
                    <div className="sg-seed-request-grid">
                        {SEED_REQUEST_DEFS.map((def) => {
                            const isPending = pendingSeed === def.seedId;
                            return (
                                <button
                                    key={def.seedId}
                                    type="button"
                                    className={`sg-seed-request-row${isPending ? " is-pending" : ""}`}
                                    onClick={() => handleSeedRequest(def.seedId)}
                                >
                                    <ItemIcon itemId={def.seedId} size={24} />
                                    <span className="sg-seed-request-name">
                                        {def.displayName} ×{SEED_STACK_COUNT}
                                    </span>
                                    <span className="sg-seed-request-penalty">-{def.penalty.toLocaleString()} pt</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="sg-seed-request-status">
                        {pendingSeed
                            ? `リクエスト中: 翌朝5時に1スタック配達され、評価値が減点されます（再度押すと取消）`
                            : `1日1種類・1スタックまで地球に種をリクエストできます`}
                    </p>
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
    mode: "warp_gate",
    component: ({ open, engine }) => (
        <WarpGatePanel
            open={open}
            inventory={engine.inventory}
            warpGateStorage={getStorageSet("warp_gate", engine.uiState.targetPos) ?? null}
            reputationSystem={engine.reputationSystem}
            seedRequestSystem={engine.seedRequestSystem}
            uiState={engine.uiState}
        />
    ),
});
