import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import type { ForgeSlotKind, ForgeStorage } from "../../_registry/entities/Forge";
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

type ForgeSlotArea = "inventory" | "toolbar" | "forge_ingredient" | "forge_fuel" | "forge_output";
type ForgeSlotRef = { area: ForgeSlotArea; index: number };

const ALLOWED_ITEM_BY_KIND: Record<ForgeSlotKind, string> = {
    ingredient: "meteoric_iron",
    fuel: "charcoal",
    output: "hot_meteoric_iron",
};

export interface ForgePanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    forge: ForgeStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function ForgePanel({ open, inventory, forge, voxelMap, uiState }: ForgePanelProps) {
    useFrameTick(open);
    const targetPos = uiState.targetPos;

    const slotAreaToKind = useCallback((area: ForgeSlotArea): ForgeSlotKind | null => {
        if (area === "forge_ingredient") return "ingredient";
        if (area === "forge_fuel") return "fuel";
        if (area === "forge_output") return "output";
        return null;
    }, []);

    const getSlot = useCallback(
        (ref: ForgeSlotRef): ItemStack | null => {
            const kind = slotAreaToKind(ref.area);
            if (kind) return targetPos ? forge.getSlot(targetPos, kind, 0) : null;
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, forge, targetPos, slotAreaToKind],
    );

    const setSlot = useCallback(
        (ref: ForgeSlotRef, stack: ItemStack | null) => {
            const kind = slotAreaToKind(ref.area);
            if (kind) {
                if (targetPos) {
                    forge.setForgeSlot(targetPos, kind, stack, voxelMap);
                    return;
                }
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, forge, voxelMap, targetPos, slotAreaToKind],
    );

    const canPlaceTo = useCallback(
        (ref: ForgeSlotRef, stack: ItemStack): boolean => {
            const kind = slotAreaToKind(ref.area);
            if (!kind) return true;
            return stack.itemId === ALLOWED_ITEM_BY_KIND[kind];
        },
        [slotAreaToKind],
    );

    const getQuickTransferTargets = useCallback((ref: ForgeSlotRef): ForgeSlotRef[] | undefined => {
        const invTotal = INV_ROWS * COLS;
        // forge スロット → インベントリ + toolbar 1..9
        if (ref.area === "forge_ingredient" || ref.area === "forge_fuel" || ref.area === "forge_output") {
            const targets: ForgeSlotRef[] = [];
            for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
            for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
            return targets;
        }
        // インベントリ/ツールバー → ingredient と fuel のみ（output は完成品スロットなので含めない。canPlaceTo がアイテム種別で振り分ける）
        return [
            { area: "forge_ingredient", index: 0 },
            { area: "forge_fuel", index: 0 },
        ];
    }, []);

    const getQuickTransferSources = useCallback((ref: ForgeSlotRef): ForgeSlotRef[] => {
        const invTotal = INV_ROWS * COLS;
        if (ref.area === "forge_ingredient" || ref.area === "forge_fuel" || ref.area === "forge_output") {
            // forge 側は ingredient/fuel/output を全部同じ側として扱う（同 itemId のものは canPlaceTo によって受入先が決まる）
            return [
                { area: "forge_ingredient", index: 0 },
                { area: "forge_fuel", index: 0 },
                { area: "forge_output", index: 0 },
            ];
        }
        const sources: ForgeSlotRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<ForgeSlotRef>(open, {
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

    const ingredient = targetPos ? forge.getSlot(targetPos, "ingredient", 0) : null;
    const fuel = targetPos ? forge.getSlot(targetPos, "fuel", 0) : null;
    const output = targetPos ? forge.getSlot(targetPos, "output", 0) : null;
    const isBurning = targetPos ? forge.isBurning(targetPos) : false;

    return (
        <>
            <SidePanel open={open} title={isBurning ? "Forge (burning)" : "Forge"} onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">Forge Slots</h3>
                    <div className="sg-forge-slots">
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">Ingredient</span>
                            <Slot
                                stack={ingredient}
                                onLeftClick={(e) => handleLeftClick({ area: "forge_ingredient", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "forge_ingredient", index: 0 })}
                            />
                        </div>
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">Fuel</span>
                            <Slot
                                stack={fuel}
                                onLeftClick={(e) => handleLeftClick({ area: "forge_fuel", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "forge_fuel", index: 0 })}
                            />
                        </div>
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">Output</span>
                            <Slot
                                stack={output}
                                onLeftClick={(e) => handleLeftClick({ area: "forge_output", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "forge_output", index: 0 })}
                            />
                        </div>
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
    mode: "forge",
    component: ({ open, engine }) => (
        <ForgePanel
            open={open}
            inventory={engine.inventory}
            forge={engine.storageVault.get<ForgeStorage>("forge")}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
