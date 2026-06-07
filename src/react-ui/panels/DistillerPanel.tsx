import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDisplayName } from "../../_registry/ItemRegistry";
import type { DistillerSlotKind } from "../../_registry/entities/Distiller";
import { DISTILLER_MATERIAL_DEF, findAllRecipesForInput } from "../../_registry/ProcessingRecipes";
import type { UIState } from "../../view/UIState";
import { CursorStack } from "../components/CursorStack";
import { InventoryGrid } from "../components/InventoryGrid";
import { SidePanel } from "../components/SidePanel";
import { Slot } from "../components/Slot";
import { useFrameTick } from "../hooks/useFrameTick";
import { usePickup } from "../hooks/usePickup";
import { registerPanel } from "../PanelRegistry";
import { getStorageNumberValue, getStorageSet, getStorageSlot, setStorageNumberValue, setStorageSlot, type StorageSet } from "../../_registry/StorageRegistry";
import { distillerCanAcceptFuel, distillerCanAcceptMaterial } from "../../_registry/entities/Distiller";

const COLS = 8;
const INV_ROWS = 8;
const TOOLBAR_COLS = 9;

type DistillerSlotArea = "inventory" | "toolbar" | "distiller_fuel" | "distiller_material" | "distiller_output";
type DistillerSlotRef = { area: DistillerSlotArea; index: number };

function areaToKind(area: DistillerSlotArea): DistillerSlotKind | null {
    switch (area) {
        case "distiller_fuel":
            return "fuel";
        case "distiller_material":
            return "material";
        case "distiller_output":
            return "output";
        default:
            return null;
    }
}

export interface DistillerPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    distillerStorage: StorageSet | undefined;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function DistillerPanel({ open, inventory, distillerStorage, voxelMap, uiState }: DistillerPanelProps) {
    useFrameTick(open);
    const targetPos = uiState.targetPos;

    const getSlot = useCallback(
        (ref: DistillerSlotRef): ItemStack | null => {
            const kind = areaToKind(ref.area);
            if (kind) return targetPos ? getStorageSlot("distiller", targetPos, kind, 0) : null;
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, distillerStorage, targetPos],
    );

    const setSlot = useCallback(
        (ref: DistillerSlotRef, stack: ItemStack | null) => {
            const kind = areaToKind(ref.area);
            if (kind) {
                if (targetPos) setStorageSlot("distiller", targetPos, kind, 0, stack);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, distillerStorage, voxelMap, targetPos],
    );

    const canPlaceTo = useCallback(
        (ref: DistillerSlotRef, stack: ItemStack): boolean => {
            if (ref.area === "distiller_fuel") return distillerCanAcceptFuel(stack.itemId);
            if (ref.area === "distiller_material") return distillerCanAcceptMaterial(stack.itemId);
            if (ref.area === "distiller_output") return false;
            return true;
        },
        [distillerStorage],
    );

    const getQuickTransferTargets = useCallback((ref: DistillerSlotRef): DistillerSlotRef[] | undefined => {
        const invTotal = INV_ROWS * COLS;
        if (areaToKind(ref.area)) {
            const targets: DistillerSlotRef[] = [];
            for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
            for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
            return targets;
        }
        return [
            { area: "distiller_fuel", index: 0 },
            { area: "distiller_material", index: 0 },
        ];
    }, []);

    const getQuickTransferSources = useCallback((ref: DistillerSlotRef): DistillerSlotRef[] => {
        const invTotal = INV_ROWS * COLS;
        if (areaToKind(ref.area)) {
            return [
                { area: "distiller_fuel", index: 0 },
                { area: "distiller_material", index: 0 },
                { area: "distiller_output", index: 0 },
            ];
        }
        const sources: DistillerSlotRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<DistillerSlotRef>(open, {
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

    const fuel = targetPos ? getStorageSlot("distiller", targetPos, "fuel", 0) : null;
    const material = targetPos ? getStorageSlot("distiller", targetPos, "material", 0) : null;
    const output = targetPos ? getStorageSlot("distiller", targetPos, "output", 0) : null;
//    const isBurning = targetPos ? distillerStorage.isBurning(targetPos) : false;

    const materialRecipes = material ? findAllRecipesForInput(DISTILLER_MATERIAL_DEF, material.itemId) : [];
    const showRecipeSelector = materialRecipes.length > 1;
    const selectedRecipeIndex = targetPos ? getStorageNumberValue("distiller", targetPos, "recipe") ?? 0 : 0;
    const onSelectRecipe = (index: number) => {
        if (targetPos) setStorageNumberValue("distiller", targetPos, "recipe", index);
    };

    return (
        <>
            <SidePanel open={open} title="蒸留器" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">蒸留器</h3>
                    <div className="sg-forge-slots">
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">燃料</span>
                            <Slot
                                stack={fuel}
                                onLeftClick={(e) => handleLeftClick({ area: "distiller_fuel", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "distiller_fuel", index: 0 })}
                            />
                        </div>
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">素材</span>
                            <Slot
                                stack={material}
                                onLeftClick={(e) => handleLeftClick({ area: "distiller_material", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "distiller_material", index: 0 })}
                            />
                            <span className="sg-processing-arrow">→</span>
                            <span className="sg-forge-row-label">麦焼酎</span>
                            <Slot
                                stack={output}
                                onLeftClick={(e) => handleLeftClick({ area: "distiller_output", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "distiller_output", index: 0 })}
                            />
                        </div>
                        {showRecipeSelector && (
                            <div className="sg-processing-recipe-selector">
                                <label htmlFor="sg-distiller-recipe-select">蒸留先:</label>
                                <select
                                    id="sg-distiller-recipe-select"
                                    value={selectedRecipeIndex}
                                    onChange={(e) => onSelectRecipe(Number(e.target.value))}
                                >
                                    {materialRecipes.map((r, i) => (
                                        <option key={i} value={i}>
                                            {getItemDisplayName(r.outputs[0].itemId)} ×{r.outputs[0].count}
                                        </option>
                                    ))}
                                </select>
                            </div>
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
    mode: "distiller",
    component: ({ open, engine }) => (
        <DistillerPanel
            open={open}
            inventory={engine.inventory}
            distillerStorage={getStorageSet("distiller", engine.uiState.targetPos)}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
