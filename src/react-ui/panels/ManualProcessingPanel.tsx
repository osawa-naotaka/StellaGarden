import { useCallback, useEffect, useMemo, useRef } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDefByEntityType, getItemDisplayName } from "../../_registry/ItemRegistry";
import { findAllRecipesForInput, getManualProcessingDef } from "../../_registry/ProcessingRecipes";
import { getEntityTypeFromVoxel } from "../../engine/VoxelDefs";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { Slot } from "../components/Slot";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";
import { canAcceptItem, getStorageNumberValue, getStorageSet, getStorageSlot, setStorageNumberValue, setStorageSlot, type StorageSet } from "../../_registry/StorageRegistry";
import { getItemIdFromPos } from "./DailyProcessingPanel";
import { manualProcessingCanProcess, manualProcessingTryProcessOnce } from "../../_registry/entities/ManualProcessing";

const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type ManualProcessingArea = "inventory" | "toolbar" | "processing_input" | "processing_output";
type ManualProcessingRef = { area: ManualProcessingArea; index: number };

export interface ManualProcessingPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    manualProcessingStorage: StorageSet | null;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function ManualProcessingPanel({ open, inventory, manualProcessingStorage, voxelMap, uiState }: ManualProcessingPanelProps) {
    useFrameTick(open);
    const pos = open ? uiState.targetPos : null;

    // pos からエンティティタイプとレシピ定義を引く
    const entityType = useMemo(() => {
        if (!pos) return null;
        const surface = voxelMap.getSurfacePosition(pos);
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }, [pos, voxelMap]);

    const def = entityType !== null ? getManualProcessingDef(entityType) : null;
    const itemDef = entityType !== null ? getItemDefByEntityType(entityType) : null;
    const itemId = itemDef?.itemId ?? ("none" as const);
    const title = itemDef?.displayName ?? "Processing";

    const getSlot = useCallback(
        (ref: ManualProcessingRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "processing_input") return getStorageSlot(itemId, pos, "input", 0);
            if (ref.area === "processing_output") return getStorageSlot(itemId, pos, "output", ref.index);
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, manualProcessingStorage, pos, itemId],
    );

    const setSlot = useCallback(
        (ref: ManualProcessingRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "processing_input") {
                setStorageSlot(itemId, pos, "input", 0, stack);
                return;
            }
            if (ref.area === "processing_output") {
                setStorageSlot(itemId, pos, "output", ref.index, stack);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, manualProcessingStorage, pos, itemId],
    );

    const canPlaceTo = useCallback(
        (ref: ManualProcessingRef, stack: ItemStack): boolean => {
            if (!pos) return false;
            if (ref.area === "processing_output") return false;
            if (ref.area === "processing_input") {
                return canAcceptItem(itemId, "input", stack);
            }
            return true;
        },
        [manualProcessingStorage, voxelMap, pos, itemId],
    );

    const getQuickTransferTargets = useCallback(
        (ref: ManualProcessingRef): ManualProcessingRef[] | undefined => {
            if (!pos || !def) return undefined;
            const invTotal = INV_ROWS * COLS;
            // 出力 or 入力 → プレイヤーインベントリへ取り出し
            if (ref.area === "processing_output" || ref.area === "processing_input") {
                const targets: ManualProcessingRef[] = [];
                for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
                for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
                return targets;
            }
            // インベントリ/ツールバー → 入力スロット（手動処理は入力1スロットのみ）
            return [{ area: "processing_input", index: 0 }];
        },
        [pos, def],
    );

    const getQuickTransferSources = useCallback((ref: ManualProcessingRef): ManualProcessingRef[] => {
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "processing_input" || ref.area === "processing_output") {
            return [
                { area: "processing_input", index: 0 },
                { area: "processing_output", index: 0 },
                { area: "processing_output", index: 1 },
            ];
        }
        const sources: ManualProcessingRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<ManualProcessingRef>(open, {
        getSlot,
        setSlot,
        canPlaceTo,
        getQuickTransferTargets,
        getQuickTransferSources,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.targetPos = null;
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
        if (!manualProcessingCanProcess(entityType ?? 0, itemId, pos)) return;
        // 即時実行はしない。intervalMS 経過後に初めて1サイクル目を試みる。
        holdStartRef.current = Date.now();
        intervalRef.current = setInterval(() => {
            const ok = manualProcessingTryProcessOnce(def, itemId, pos);
            if (!ok) {
                // 入力切れ・出力満杯 → 停止（進捗もリセット）
                stopProcessing();
                return;
            }
            // 次サイクルへ。進捗バーを 0 から再カウント。
            // ただし、消費後の状態でもう次サイクルが回せるかをチェックして、
            // 不可なら次の intervalMS を待たずにすぐ停止する。
            if (!manualProcessingCanProcess(entityType ?? 0, itemId, pos)) {
                stopProcessing();
                return;
            }
            holdStartRef.current = Date.now();
        }, def.intervalMS);
    }, [pos, itemId, def, manualProcessingStorage, voxelMap, stopProcessing]);

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

    const input = pos ? getStorageSlot(itemId, pos, "input", 0) : null;
    const output0 = pos ? getStorageSlot(itemId, pos, "output", 0) : null;
    const output1 = pos ? getStorageSlot(itemId, pos, "output", 1) : null;

    // 同一入力に複数レシピが登録されているとき（例: 金床の刃 / 扱き歯）にドロップダウンを表示する。
    // input が空のときや、入力 itemId にマッチするレシピが1件以下のときはドロップダウンを出さない。
    const matchingRecipes = input ? findAllRecipesForInput(def, input.itemId) : [];
    const showRecipeSelector = matchingRecipes.length > 1;
    const selectedRecipeIndex = pos ? getStorageNumberValue(itemId, pos, "recipe") ?? 0 : 0;
    const onSelectRecipe = (index: number) => {
        if (!pos) return;
        setStorageNumberValue(itemId, pos, "recipe", index);
    };

    return (
        <>
            <SidePanel open={open} title={title} onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Process</h3>
                    {showRecipeSelector && (
                        <div className="sg-processing-recipe-selector">
                            <label htmlFor="sg-processing-recipe-select">出力:</label>
                            <select id="sg-processing-recipe-select" value={selectedRecipeIndex} onChange={(e) => onSelectRecipe(Number(e.target.value))}>
                                {matchingRecipes.map((r, i) => (
                                    <option key={i} value={i}>
                                        {getItemDisplayName(r.outputs[0].itemId)} ×{r.outputs[0].count}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="sg-processing-row">
                        <Slot
                            stack={input}
                            onLeftClick={(e) => handleLeftClick({ area: "processing_input", index: 0 }, e.nativeEvent)}
                            onRightClick={() => handleRightClick({ area: "processing_input", index: 0 })}
                        />
                        <span className="sg-processing-arrow">→</span>
                        <Slot
                            stack={output0}
                            onLeftClick={(e) => handleLeftClick({ area: "processing_output", index: 0 }, e.nativeEvent)}
                            onRightClick={() => handleRightClick({ area: "processing_output", index: 0 })}
                        />
                        {def.outputSlotCount === 2 && (
                            <Slot
                                stack={output1}
                                onLeftClick={(e) => handleLeftClick({ area: "processing_output", index: 1 }, e.nativeEvent)}
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
    mode: "processing-manual",
    component: ({ open, engine }) => (
        <ManualProcessingPanel
            open={open}
            inventory={engine.inventory}
            manualProcessingStorage={getStorageSet(getItemIdFromPos(engine.uiState.targetPos, engine.voxelMap), engine.uiState.targetPos) ?? null}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
