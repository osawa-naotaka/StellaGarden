import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { SALT_DAYS_PER_CYCLE, type SaltPanStorage } from "../../engine/SaltPanStorage";
import { getDaysElapsedFromVoxel } from "../../engine/VoxelDefs";
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

type SaltPanSlotArea = "inventory" | "toolbar" | "saltpan_output";
type SaltPanSlotRef = { area: SaltPanSlotArea; index: number };

export interface SaltPanPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    saltPanStorage: SaltPanStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function SaltPanPanel({ open, inventory, saltPanStorage, voxelMap, uiState }: SaltPanPanelProps) {
    useFrameTick(open);
    const pos = open ? uiState.targetPos : null;

    const getSlot = useCallback(
        (ref: SaltPanSlotRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "saltpan_output") return saltPanStorage.getOutput(pos);
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, saltPanStorage, pos],
    );

    const setSlot = useCallback(
        (ref: SaltPanSlotRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "saltpan_output") {
                saltPanStorage.setOutput(pos, stack, voxelMap);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, saltPanStorage, voxelMap, pos],
    );

    const canPlaceTo = useCallback((ref: SaltPanSlotRef): boolean => {
        // 出力スロットへは置けない（受動生成の取り出し専用）。
        return ref.area !== "saltpan_output";
    }, []);

    const getQuickTransferTargets = useCallback((ref: SaltPanSlotRef): SaltPanSlotRef[] | undefined => {
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "saltpan_output") {
            const targets: SaltPanSlotRef[] = [];
            for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
            for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
            return targets;
        }
        // インベントリ/ツールバー側からは取り込み先が無い（入力スロットなし）。
        return undefined;
    }, []);

    const getQuickTransferSources = useCallback((ref: SaltPanSlotRef): SaltPanSlotRef[] => {
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "saltpan_output") return [{ area: "saltpan_output", index: 0 }];
        const sources: SaltPanSlotRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<SaltPanSlotRef>(open, {
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

    const output = pos ? saltPanStorage.getOutput(pos) : null;
    const daysElapsed = pos ? getDaysElapsedFromVoxel(voxelMap.get(voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z }))) : 0;
    const progressPct = Math.min(100, Math.round((daysElapsed / SALT_DAYS_PER_CYCLE) * 100));

    return (
        <>
            <SidePanel open={open} title="塩田" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">天日干し</h3>
                    <div className="sg-processing-row">
                        <div className="sg-processing-progress">
                            <div className="sg-progress-bar">
                                <div className="sg-progress-fill" style={{ width: `${progressPct}%` }} />
                            </div>
                            <span className="sg-processing-progress-label">{`${daysElapsed} / ${SALT_DAYS_PER_CYCLE} 日`}</span>
                        </div>
                        <Slot
                            stack={output}
                            onLeftClick={(e) => handleLeftClick({ area: "saltpan_output", index: 0 }, e.nativeEvent)}
                            onRightClick={() => handleRightClick({ area: "saltpan_output", index: 0 })}
                        />
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
    mode: "saltpan",
    component: ({ open, engine }) => (
        <SaltPanPanel
            open={open}
            inventory={engine.inventory}
            saltPanStorage={engine.saltPanStorage}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
