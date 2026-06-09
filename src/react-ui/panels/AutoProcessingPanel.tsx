import { useCallback, useMemo } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter } from "../../_boundary/interfaces";
import { type AutoProcessingStorage, autoProcessingCanAcceptInput, autoProcessingIsPowered } from "../../_registry/entities/AutoProcessing";
import { getItemDefByEntityType } from "../../_registry/ItemRegistry";
import { getAutoProcessingDef } from "../../_registry/ProcessingRecipes";
import type { StorageVault } from "../../engine/StorageVault";
import { getEntityTypeFromVoxel } from "../../engine/VoxelDefs";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";
import { toInventorySlotRef } from "./slotRef";

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
    storageVault: StorageVault;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function AutoProcessingPanel({ open, inventory, storageVault, voxelMap, uiState }: AutoProcessingPanelProps) {
    useFrameTick(open);
    const pos = open ? uiState.targetPos : null;

    const voxel = useMemo(() => {
        if (!pos) return null;
        return voxelMap.getSurface(pos);
    }, [pos, voxelMap]);

    const entityType = useMemo(() => {
        if (!pos) return null;
        const surface = voxelMap.getSurfacePosition(pos);
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }, [pos, voxelMap]);

    const def = entityType !== null ? getAutoProcessingDef(entityType) : null;
    const itemDef = entityType !== null ? getItemDefByEntityType(entityType) : null;
    const itemId = itemDef?.itemId ?? "none";
    const title = itemDef?.displayName ?? "Auto Processing";
    // 自動処理施設のときのみストレージを解決する（def 非nullなら itemId は vault に登録済み）。
    const auto = def && itemId !== "none" ? storageVault.get<AutoProcessingStorage>(itemId) : null;

    const getSlot = useCallback(
        (ref: AutoProcessingRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "processing_input") return auto?.getSlot(pos, "input", ref.index) ?? null;
            if (ref.area === "processing_output") return auto?.getSlot(pos, "output", ref.index) ?? null;
            return inventory.getSlot(toInventorySlotRef(ref));
        },
        [inventory, auto, pos],
    );

    const setSlot = useCallback(
        (ref: AutoProcessingRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "processing_input") {
                auto?.setSlot(pos, "input", ref.index, stack);
                return;
            }
            if (ref.area === "processing_output") {
                auto?.setSlot(pos, "output", ref.index, stack);
                return;
            }
            inventory.setSlot(toInventorySlotRef(ref), stack);
        },
        [inventory, auto, pos],
    );

    const canPlaceTo = useCallback(
        (ref: AutoProcessingRef, stack: ItemStack): boolean => {
            if (!pos) return false;
            if (ref.area === "processing_output") return false;
            if (ref.area === "processing_input") {
                return autoProcessingCanAcceptInput(stack.itemId, entityType ?? 0);
            }
            return true;
        },
        [pos, entityType],
    );

    const getQuickTransferTargets = useCallback(
        (ref: AutoProcessingRef): AutoProcessingRef[] | undefined => {
            if (!pos || !def) return undefined;
            const invTotal = INV_ROWS * COLS;
            // 出力 or 入力 → プレイヤーインベントリへ取り出し
            if (ref.area === "processing_output" || ref.area === "processing_input") {
                const targets: AutoProcessingRef[] = [];
                for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
                for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
                return targets;
            }
            // インベントリ/ツールバー → 入力スロット（canPlaceTo がレシピでフィルタ）
            const targets: AutoProcessingRef[] = [];
            for (let i = 0; i < def.inputSlotCount; i++) targets.push({ area: "processing_input", index: i });
            return targets;
        },
        [pos, def],
    );

    const getQuickTransferSources = useCallback(
        (ref: AutoProcessingRef): AutoProcessingRef[] => {
            const invTotal = INV_ROWS * COLS;
            if (ref.area === "processing_input" || ref.area === "processing_output") {
                const sources: AutoProcessingRef[] = [];
                const inputCount = def?.inputSlotCount ?? 0;
                const outputCount = def?.outputSlotCount ?? 0;
                for (let i = 0; i < inputCount; i++) sources.push({ area: "processing_input", index: i });
                for (let i = 0; i < outputCount; i++) sources.push({ area: "processing_output", index: i });
                return sources;
            }
            const sources: AutoProcessingRef[] = [];
            for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
            for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
            return sources;
        },
        [def],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<AutoProcessingRef>(open, {
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

    // 動力状態（毎フレーム useFrameTick で再読み込み）
    const powered = pos ? autoProcessingIsPowered(voxel ?? 0n) : false;
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
                        getStack={(i) => (i < inputCount ? (auto?.getSlot(pos, "input", i) ?? null) : null)}
                        onLeftClick={(i, e) => handleLeftClick({ area: "processing_input", index: i }, e.nativeEvent)}
                        onRightClick={(i) => handleRightClick({ area: "processing_input", index: i })}
                    />
                </section>

                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Output</h3>
                    <InventoryGrid
                        rows={OUTPUT_ROWS}
                        cols={OUTPUT_COLS}
                        getStack={(i) => (i < outputCount ? (auto?.getSlot(pos, "output", i) ?? null) : null)}
                        onLeftClick={(i, e) => handleLeftClick({ area: "processing_output", index: i }, e.nativeEvent)}
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
    mode: "processing-auto",
    component: ({ open, engine }) => (
        <AutoProcessingPanel open={open} inventory={engine.inventory} storageVault={engine.storageVault} voxelMap={engine.voxelMap} uiState={engine.uiState} />
    ),
});
