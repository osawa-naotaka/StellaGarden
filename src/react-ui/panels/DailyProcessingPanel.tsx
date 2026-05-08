import { useCallback, useMemo } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDefByEntityType } from "../../_registry/ItemRegistry";
import type { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import { findRecipeForInput, getDailyProcessingDef } from "../../engine/ProcessingRecipes";
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

type DailyProcessingArea = "inventory" | "toolbar" | "processing_input" | "processing_output";
type DailyProcessingRef = { area: DailyProcessingArea; index: number };

export interface DailyProcessingPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    dailyProcessingStorage: DailyProcessingStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function DailyProcessingPanel({ open, inventory, dailyProcessingStorage, voxelMap, uiState }: DailyProcessingPanelProps) {
    useFrameTick(open);
    const pos = uiState.processingPos;

    // pos からエンティティタイプとレシピ定義を引く（ベース entityType を使う）
    const baseEntityType = useMemo(() => {
        if (!pos) return null;
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }, [pos, voxelMap]);

    const def = baseEntityType !== null ? getDailyProcessingDef(baseEntityType) : null;
    const itemDef = baseEntityType !== null ? getItemDefByEntityType(baseEntityType) : null;
    const title = itemDef?.displayName ?? "Processing";

    const getSlot = useCallback(
        (ref: DailyProcessingRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "processing_input") return dailyProcessingStorage.getInput(pos);
            if (ref.area === "processing_output") return dailyProcessingStorage.getOutput(pos, ref.index as 0 | 1);
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, dailyProcessingStorage, pos],
    );

    const setSlot = useCallback(
        (ref: DailyProcessingRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "processing_input") {
                dailyProcessingStorage.setInput(pos, stack, voxelMap);
                return;
            }
            if (ref.area === "processing_output") {
                dailyProcessingStorage.setOutput(pos, ref.index as 0 | 1, stack, voxelMap);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, dailyProcessingStorage, voxelMap, pos],
    );

    const canPlaceTo = useCallback(
        (ref: DailyProcessingRef, stack: ItemStack): boolean => {
            if (!pos) return false;
            if (ref.area === "processing_output") return false;
            if (ref.area === "processing_input") {
                return dailyProcessingStorage.canAcceptInput(pos, stack.itemId, voxelMap);
            }
            return true;
        },
        [dailyProcessingStorage, voxelMap, pos],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<DailyProcessingRef>(open, {
        getSlot,
        setSlot,
        canPlaceTo,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.processingPos = null;
    }, [uiState]);

    if (!def || !pos) {
        return (
            <SidePanel open={open} title={title} onClose={close}>
                <div />
            </SidePanel>
        );
    }

    const input = dailyProcessingStorage.getInput(pos);
    const output0 = dailyProcessingStorage.getOutput(pos, 0);
    const output1 = dailyProcessingStorage.getOutput(pos, 1);
    const daysElapsed = dailyProcessingStorage.getDaysElapsed(pos, voxelMap);

    // 進捗の表示: 入力が必要数に達していて、レシピが見つかる場合のみカウントを表示
    const recipe = input ? findRecipeForInput(def, input.itemId) : null;
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
                            onLeftClick={() => handleLeftClick({ area: "processing_input", index: 0 })}
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
    mode: "processing-daily",
    component: ({ open, engine }) => (
        <DailyProcessingPanel
            open={open}
            inventory={engine.inventory}
            dailyProcessingStorage={engine.dailyProcessingStorage}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
