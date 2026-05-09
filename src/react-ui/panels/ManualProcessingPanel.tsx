import { useCallback, useEffect, useMemo, useRef } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDefByEntityType } from "../../_registry/ItemRegistry";
import type { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import { getManualProcessingDef } from "../../engine/ProcessingRecipes";
import { getEntityTypeFromVoxel } from "../../engine/VoxelDefs";
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
    const pos = open ? uiState.processingPos : null;

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

    // 処理ボタン: 押下を intervalMS だけ継続して初めて1サイクル実行する。
    // 押下開始時刻を ref で持ち、useFrameTick による毎フレーム再描画で進捗 % を算出する。
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const holdStartRef = useRef<number | null>(null);

    const stopProcessing = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        holdStartRef.current = null;
    }, []);

    const startProcessing = useCallback(() => {
        if (!pos || !def) return;
        stopProcessing();
        // いま処理不可（入力空・必要数不足・出力満杯 等）なら、進捗バーも動かさず何もしない。
        if (!manualProcessingStorage.canProcess(pos, voxelMap)) return;
        // 即時実行はしない。intervalMS 経過後に初めて1サイクル目を試みる。
        holdStartRef.current = Date.now();
        intervalRef.current = setInterval(() => {
            const ok = manualProcessingStorage.tryProcessOnce(pos, voxelMap);
            if (!ok) {
                // 入力切れ・出力満杯 → 停止（進捗もリセット）
                stopProcessing();
                return;
            }
            // 次サイクルへ。進捗バーを 0 から再カウント。
            // ただし、消費後の状態でもう次サイクルが回せるかをチェックして、
            // 不可なら次の intervalMS を待たずにすぐ停止する。
            if (!manualProcessingStorage.canProcess(pos, voxelMap)) {
                stopProcessing();
                return;
            }
            holdStartRef.current = Date.now();
        }, def.intervalMS);
    }, [pos, def, manualProcessingStorage, voxelMap, stopProcessing]);

    // パネルクローズ・unmount で必ずインターバルを止める
    useEffect(() => {
        if (!open) stopProcessing();
        return stopProcessing;
    }, [open, stopProcessing]);

    // 押下中の進捗（0..1）。useFrameTick による毎フレーム再描画でスムースに更新される。
    const holdProgress = (() => {
        if (holdStartRef.current === null || !def) return 0;
        const elapsed = Date.now() - holdStartRef.current;
        return Math.min(1, elapsed / def.intervalMS);
    })();
    const holdPct = Math.round(holdProgress * 100);
    // ボタン背景を進捗に応じて左から塗りつぶす（押下中以外は通常背景）。
    const buttonStyle =
        holdStartRef.current !== null
            ? { background: `linear-gradient(90deg, var(--sg-accent-strong) ${holdPct}%, var(--sg-bg-elev2) ${holdPct}%)` }
            : undefined;

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
                        style={buttonStyle}
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
