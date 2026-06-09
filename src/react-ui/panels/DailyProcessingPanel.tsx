import { useCallback, useMemo } from "react";
import type { IInventoryWriter, ItemId, ItemStack, IVoxelWriter, Pos2D } from "../../_boundary/interfaces";
import { type DailyProcessingStorage, dailyProcessingCanAcceptInput, getDaysElapsed } from "../../_registry/entities/DailyProcessing";
import { getItemDefByEntityType } from "../../_registry/ItemRegistry";
import { findRecipeForInput, getDailyProcessingDef } from "../../_registry/ProcessingRecipes";
import type { StorageVault } from "../../engine/StorageVault";
import { getEntityTypeFromVoxel } from "../../engine/VoxelDefs";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { Slot } from "../components/Slot";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";
import { toInventorySlotRef } from "./slotRef";

const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type DailyProcessingArea = "inventory" | "toolbar" | "processing_input" | "processing_output";
type DailyProcessingRef = { area: DailyProcessingArea; index: number };

export interface DailyProcessingPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    storageVault: StorageVault;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function getItemIdFromPos(pos: Pos2D | null, voxelMap: IVoxelWriter): ItemId {
    if (pos === null) return "none" as const;
    const surface = voxelMap.getSurfacePosition(pos);
    const entityType = getEntityTypeFromVoxel(voxelMap.get(surface));
    const itemDef = entityType !== null ? getItemDefByEntityType(entityType) : null;
    return itemDef?.itemId ?? ("none" as const);
}

export function DailyProcessingPanel({ open, inventory, storageVault, voxelMap, uiState }: DailyProcessingPanelProps) {
    useFrameTick(open);
    const pos = open ? uiState.targetPos : null;

    // pos からエンティティタイプとレシピ定義を引く（ベース entityType を使う）
    const baseEntityType = useMemo(() => {
        if (!pos) return null;
        const surface = voxelMap.getSurfacePosition(pos);
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }, [pos, voxelMap]);

    const def = baseEntityType !== null ? getDailyProcessingDef(baseEntityType) : null;
    const itemDef = baseEntityType !== null ? getItemDefByEntityType(baseEntityType) : null;
    const itemId = itemDef?.itemId ?? ("none" as const);
    const title = itemDef?.displayName ?? "Processing";
    // 日次処理施設のときのみストレージを解決する（def 非nullなら itemId は vault に登録済み）。
    const daily = def && itemId !== "none" ? storageVault.get<DailyProcessingStorage>(itemId) : null;

    const getSlot = useCallback(
        (ref: DailyProcessingRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "processing_input") return daily?.getSlot(pos, "input", 0) ?? null;
            if (ref.area === "processing_output") return daily?.getSlot(pos, "output", ref.index) ?? null;
            return inventory.getSlot(toInventorySlotRef(ref));
        },
        [inventory, daily, pos],
    );

    const setSlot = useCallback(
        (ref: DailyProcessingRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "processing_input") {
                daily?.setSlot(pos, "input", 0, stack);
                return;
            }
            if (ref.area === "processing_output") {
                daily?.setSlot(pos, "output", ref.index, stack);
                return;
            }
            inventory.setSlot(toInventorySlotRef(ref), stack);
        },
        [inventory, daily, pos],
    );

    const canPlaceTo = useCallback(
        (ref: DailyProcessingRef, stack: ItemStack): boolean => {
            if (!pos) return false;
            if (ref.area === "processing_output") return false;
            if (ref.area === "processing_input") {
                return dailyProcessingCanAcceptInput(pos, stack.itemId, voxelMap);
            }
            return true;
        },
        [voxelMap, pos],
    );

    const getQuickTransferTargets = useCallback(
        (ref: DailyProcessingRef): DailyProcessingRef[] | undefined => {
            if (!pos || !def) return undefined;
            const invTotal = INV_ROWS * COLS;
            // 出力 or 入力 → プレイヤーインベントリへ取り出し
            if (ref.area === "processing_output" || ref.area === "processing_input") {
                const targets: DailyProcessingRef[] = [];
                for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
                for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
                return targets;
            }
            // インベントリ/ツールバー → 入力スロット（日次処理は入力1スロットのみ）
            return [{ area: "processing_input", index: 0 }];
        },
        [pos, def],
    );

    const getQuickTransferSources = useCallback((ref: DailyProcessingRef): DailyProcessingRef[] => {
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "processing_input" || ref.area === "processing_output") {
            // processing 側 (input + output 2 slots) を同じ側として扱う
            return [
                { area: "processing_input", index: 0 },
                { area: "processing_output", index: 0 },
                { area: "processing_output", index: 1 },
            ];
        }
        const sources: DailyProcessingRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<DailyProcessingRef>(open, {
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

    if (!def || !pos) {
        return (
            <SidePanel open={open} title={title} onClose={close}>
                <div />
            </SidePanel>
        );
    }

    const input = daily?.getSlot(pos, "input", 0) ?? null;
    const output0 = daily?.getSlot(pos, "output", 0) ?? null;
    const output1 = daily?.getSlot(pos, "output", 1) ?? null;
    const daysElapsed = getDaysElapsed(pos, voxelMap);

    // 進捗の表示: 入力が必要数に達していて、レシピが見つかる場合のみカウントを表示。
    // 受理不可アイテム（誤って入った出力物など）では findRecipeForInput が throw するため事前に弾く。
    const recipe = input && dailyProcessingCanAcceptInput(pos, input.itemId, voxelMap) ? findRecipeForInput(def, input.itemId) : null;
    const isProgressing = recipe !== null && input !== null && input.count >= recipe.inputCountPerCycle;
    const progressPct = isProgressing ? Math.min(100, Math.round(((daysElapsed - 1) / def.daysRequired) * 100)) : 0;
    const progressLabel = isProgressing ? `${daysElapsed - 1} / ${def.daysRequired} 日` : `必要量を投入してください`;

    return (
        <>
            <SidePanel open={open} title={title} onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Process</h3>
                    <div className="sg-processing-row">
                        <Slot
                            stack={input}
                            onLeftClick={(e) => handleLeftClick({ area: "processing_input", index: 0 }, e.nativeEvent)}
                            onRightClick={() => handleRightClick({ area: "processing_input", index: 0 })}
                        />
                        <div className="sg-processing-progress">
                            <div className="sg-progress-bar">
                                <div className="sg-progress-fill" style={{ width: `${progressPct}%` }} />
                            </div>
                            <span className="sg-processing-progress-label">{progressLabel}</span>
                        </div>
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
    mode: "processing-daily",
    component: ({ open, engine }) => (
        <DailyProcessingPanel open={open} inventory={engine.inventory} storageVault={engine.storageVault} voxelMap={engine.voxelMap} uiState={engine.uiState} />
    ),
});
