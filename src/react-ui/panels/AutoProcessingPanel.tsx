import { useCallback, useMemo } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDefByEntityType } from "../../_registry/ItemRegistry";
import type { AutoProcessingStorage } from "../../engine/AutoProcessingStorage";
import { getAutoProcessingDef } from "../../engine/ProcessingRecipes";
import { getEntityTypeFromVoxel } from "../../engine/VoxelDefs";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";

const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;
const INPUT_COLS = 4;
const INPUT_ROWS = 2;
const OUTPUT_COLS = 4;
const OUTPUT_ROWS = 4;

type AutoProcessingArea = "inventory" | "toolbar" | "processing_input" | "processing_output";
type AutoProcessingRef = { area: AutoProcessingArea; index: number };

export interface AutoProcessingPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    autoProcessingStorage: AutoProcessingStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function AutoProcessingPanel({ open, inventory, autoProcessingStorage, voxelMap, uiState }: AutoProcessingPanelProps) {
    useFrameTick(open);
    const pos = open ? uiState.processingPos : null;

    const entityType = useMemo(() => {
        if (!pos) return null;
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }, [pos, voxelMap]);

    const def = entityType !== null ? getAutoProcessingDef(entityType) : null;
    const itemDef = entityType !== null ? getItemDefByEntityType(entityType) : null;
    const title = itemDef?.displayName ?? "Auto Processing";

    const getSlot = useCallback(
        (ref: AutoProcessingRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "processing_input") return autoProcessingStorage.getInput(pos, ref.index);
            if (ref.area === "processing_output") return autoProcessingStorage.getOutput(pos, ref.index);
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, autoProcessingStorage, pos],
    );

    const setSlot = useCallback(
        (ref: AutoProcessingRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "processing_input") {
                autoProcessingStorage.setInput(pos, ref.index, stack, voxelMap);
                return;
            }
            if (ref.area === "processing_output") {
                autoProcessingStorage.setOutput(pos, ref.index, stack, voxelMap);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, autoProcessingStorage, voxelMap, pos],
    );

    const canPlaceTo = useCallback(
        (ref: AutoProcessingRef, stack: ItemStack): boolean => {
            if (!pos) return false;
            if (ref.area === "processing_output") return false;
            if (ref.area === "processing_input") {
                return autoProcessingStorage.canAcceptInput(pos, stack.itemId, voxelMap);
            }
            return true;
        },
        [autoProcessingStorage, voxelMap, pos],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<AutoProcessingRef>(open, {
        getSlot,
        setSlot,
        canPlaceTo,
    });

    const close = useCallback(() => {
        uiState.mode = "normal";
        uiState.processingPos = null;
    }, [uiState]);

    // 動力状態（毎フレーム useFrameTick で再読み込み）
    const powered = pos ? autoProcessingStorage.isPowered(pos, voxelMap) : false;
    const powerLabel = powered ? "稼働中" : "停止中（シャフト未接続）";
    const powerColor = powered ? "var(--sg-accent-strong)" : "var(--sg-text-muted, #888)";

    if (!def || !pos) {
        return (
            <SidePanel open={open} title={title} onClose={close}>
                <div />
            </SidePanel>
        );
    }

    const inputCount = def.inputSlotCount;
    const outputCount = def.outputSlotCount;

    return (
        <>
            <SidePanel open={open} title={title} onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Input</h3>
                    <InventoryGrid
                        rows={INPUT_ROWS}
                        cols={INPUT_COLS}
                        getStack={(i) => (i < inputCount ? autoProcessingStorage.getInput(pos, i) : null)}
                        onLeftClick={(i) => handleLeftClick({ area: "processing_input", index: i })}
                        onRightClick={(i) => handleRightClick({ area: "processing_input", index: i })}
                    />
                </section>

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Output</h3>
                    <InventoryGrid
                        rows={OUTPUT_ROWS}
                        cols={OUTPUT_COLS}
                        getStack={(i) => (i < outputCount ? autoProcessingStorage.getOutput(pos, i) : null)}
                        onLeftClick={(i) => handleLeftClick({ area: "processing_output", index: i })}
                        onRightClick={(i) => handleRightClick({ area: "processing_output", index: i })}
                    />
                </section>

                <section className="sg-sidepanel-section">
                    <div className="sg-processing-progress">
                        <span className="sg-processing-progress-label" style={{ color: powerColor }}>
                            {powerLabel}
                        </span>
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
    mode: "processing-auto",
    component: ({ open, engine }) => (
        <AutoProcessingPanel
            open={open}
            inventory={engine.inventory}
            autoProcessingStorage={engine.autoProcessingStorage}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
