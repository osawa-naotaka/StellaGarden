import { useCallback, useEffect, useMemo, useRef } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDefByEntityType } from "../../_registry/ItemRegistry";
import type { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import { getManualProcessingDef } from "../../engine/ProcessingRecipes";
import { getEntityTypeFromVoxel } from "../../engine/TerrainDefs";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { Slot } from "../components/Slot";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";

const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type ManualProcessingArea = "inventory" | "toolbar" | "processing_input" | "processing_output";
type ManualProcessingRef = { area: ManualProcessingArea; index: number };

export interface ManualProcessingPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    manualProcessingStorage: ManualProcessingStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function ManualProcessingPanel({ open, inventory, manualProcessingStorage, voxelMap, uiState }: ManualProcessingPanelProps) {
    useFrameTick(open);
    const pos = uiState.processingPos;

    // pos からエンティティタイプとレシピ定義を引く
    const entityType = useMemo(() => {
        if (!pos) return null;
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }, [pos, voxelMap]);

    const def = entityType !== null ? getManualProcessingDef(entityType) : null;
    const itemDef = entityType !== null ? getItemDefByEntityType(entityType) : null;
    const title = itemDef?.displayName ?? "Processing";

    const getSlot = useCallback(
        (ref: ManualProcessingRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "processing_input") return manualProcessingStorage.getInput(pos);
            if (ref.area === "processing_output") return manualProcessingStorage.getOutput(pos, ref.index as 0 | 1);
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, manualProcessingStorage, pos],
    );

    const setSlot = useCallback(
        (ref: ManualProcessingRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "processing_input") {
                manualProcessingStorage.setInput(pos, stack, voxelMap);
                return;
            }
            if (ref.area === "processing_output") {
                manualProcessingStorage.setOutput(pos, ref.index as 0 | 1, stack, voxelMap);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, manualProcessingStorage, voxelMap, pos],
    );

    const canPlaceTo = useCallback(
        (ref: ManualProcessingRef, stack: ItemStack): boolean => {
            if (!pos) return false;
            if (ref.area === "processing_output") return false;
            if (ref.area === "processing_input") {
                return manualProcessingStorage.canAcceptInput(pos, stack.itemId, voxelMap);
            }
            return true;
        },
        [manualProcessingStorage, voxelMap, pos],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<ManualProcessingRef>(open, {
        getSlot,
        setSlot,
        canPlaceTo,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.processingPos = null;
    }, [uiState]);

    // 処理ボタン: 押下中だけ setInterval で1サイクルずつ処理する
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopProcessing = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const startProcessing = useCallback(() => {
        if (!pos || !def) return;
        stopProcessing();
        // 押下した瞬間に1回試す（初回反応）
        manualProcessingStorage.tryProcessOnce(pos, voxelMap);
        intervalRef.current = setInterval(() => {
            const ok = manualProcessingStorage.tryProcessOnce(pos, voxelMap);
            // 入力切れ・出力満杯で何もできなくなったら停止
            if (!ok) stopProcessing();
        }, def.intervalMS);
    }, [pos, def, manualProcessingStorage, voxelMap, stopProcessing]);

    // パネルクローズ・unmount で必ずインターバルを止める
    useEffect(() => {
        if (!open) stopProcessing();
        return stopProcessing;
    }, [open, stopProcessing]);

    if (!def) {
        // 念のため: pos がない or 未対応 entity の場合は空の枠だけ表示
        return (
            <SidePanel open={open} title={title} onClose={close}>
                <div />
            </SidePanel>
        );
    }

    const input = pos ? manualProcessingStorage.getInput(pos) : null;
    const output0 = pos ? manualProcessingStorage.getOutput(pos, 0) : null;
    const output1 = pos ? manualProcessingStorage.getOutput(pos, 1) : null;

    return (
        <>
            <SidePanel open={open} title={title} onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Process</h3>
                    <div className="sg-processing-row">
                        <Slot
                            stack={input}
                            onLeftClick={() => handleLeftClick({ area: "processing_input", index: 0 })}
                            onRightClick={() => handleRightClick({ area: "processing_input", index: 0 })}
                        />
                        <span className="sg-processing-arrow">→</span>
                        <Slot
                            stack={output0}
                            onLeftClick={() => handleLeftClick({ area: "processing_output", index: 0 })}
                            onRightClick={() => handleRightClick({ area: "processing_output", index: 0 })}
                        />
                        {def.outputSlotCount === 2 && (
                            <Slot
                                stack={output1}
                                onLeftClick={() => handleLeftClick({ area: "processing_output", index: 1 })}
                                onRightClick={() => handleRightClick({ area: "processing_output", index: 1 })}
                            />
                        )}
                    </div>
                    <button
                        type="button"
                        className="sg-processing-button"
                        onMouseDown={startProcessing}
                        onMouseUp={stopProcessing}
                        onMouseLeave={stopProcessing}
                        onTouchStart={startProcessing}
                        onTouchEnd={stopProcessing}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        処理
                    </button>
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
    mode: "processing-manual",
    component: ({ open, engine }) => (
        <ManualProcessingPanel
            open={open}
            inventory={engine.inventory}
            manualProcessingStorage={engine.manualProcessingStorage}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
