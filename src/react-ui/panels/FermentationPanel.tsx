import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDisplayName } from "../../_registry/ItemRegistry";
import type { FermentationStorage } from "../../engine/FermentationStorage";
import { FERMENTATION_RECIPES } from "../../engine/ProcessingRecipes";
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

type FermentationSlotArea = "inventory" | "toolbar" | "vat_input" | "vat_output";
type FermentationSlotRef = { area: FermentationSlotArea; index: number };

export interface FermentationPanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    fermentationStorage: FermentationStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function FermentationPanel({ open, inventory, fermentationStorage, voxelMap, uiState }: FermentationPanelProps) {
    useFrameTick(open);
    const pos = open ? uiState.targetPos : null;

    /** vat_input の index から、選択中レシピでその位置が要求する itemId を引く。 */
    const inputItemIdAt = useCallback(
        (index: number) => {
            if (!pos) return null;
            const recipe = fermentationStorage.getRecipe(pos);
            return recipe?.inputs[index]?.itemId ?? null;
        },
        [fermentationStorage, pos],
    );

    const getSlot = useCallback(
        (ref: FermentationSlotRef): ItemStack | null => {
            if (!pos) return null;
            if (ref.area === "vat_output") return fermentationStorage.getOutput(pos);
            if (ref.area === "vat_input") {
                const itemId = inputItemIdAt(ref.index);
                return itemId ? fermentationStorage.getInput(pos, itemId) : null;
            }
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, fermentationStorage, pos, inputItemIdAt],
    );

    const setSlot = useCallback(
        (ref: FermentationSlotRef, stack: ItemStack | null) => {
            if (!pos) return;
            if (ref.area === "vat_output") {
                fermentationStorage.setOutput(pos, stack, voxelMap);
                return;
            }
            if (ref.area === "vat_input") {
                const itemId = inputItemIdAt(ref.index);
                if (itemId) fermentationStorage.setInput(pos, itemId, stack, voxelMap);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, fermentationStorage, voxelMap, pos, inputItemIdAt],
    );

    const canPlaceTo = useCallback(
        (ref: FermentationSlotRef, stack: ItemStack): boolean => {
            if (ref.area === "vat_output") return false;
            if (ref.area === "vat_input") return stack.itemId === inputItemIdAt(ref.index);
            return true;
        },
        [inputItemIdAt],
    );

    const getQuickTransferTargets = useCallback(
        (ref: FermentationSlotRef): FermentationSlotRef[] | undefined => {
            if (!pos) return undefined;
            const invTotal = INV_ROWS * COLS;
            if (ref.area === "vat_input" || ref.area === "vat_output") {
                const targets: FermentationSlotRef[] = [];
                for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
                for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
                return targets;
            }
            // インベントリ/ツールバー → 投入スロット（canPlaceTo が itemId で振り分ける）
            const recipe = fermentationStorage.getRecipe(pos);
            if (!recipe) return undefined;
            return recipe.inputs.map((_g, i) => ({ area: "vat_input" as const, index: i }));
        },
        [pos, fermentationStorage],
    );

    const getQuickTransferSources = useCallback(
        (ref: FermentationSlotRef): FermentationSlotRef[] => {
            const invTotal = INV_ROWS * COLS;
            if (ref.area === "vat_input" || ref.area === "vat_output") {
                const recipe = pos ? fermentationStorage.getRecipe(pos) : null;
                const sources: FermentationSlotRef[] = [{ area: "vat_output", index: 0 }];
                if (recipe) recipe.inputs.forEach((_g, i) => sources.push({ area: "vat_input", index: i }));
                return sources;
            }
            const sources: FermentationSlotRef[] = [];
            for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
            for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
            return sources;
        },
        [pos, fermentationStorage],
    );

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<FermentationSlotRef>(open, {
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

    if (!pos) {
        return (
            <SidePanel open={open} title="発酵桶" onClose={close}>
                <div />
            </SidePanel>
        );
    }

    const selectedRecipeIndex = fermentationStorage.getSelectedRecipeIndex(pos);
    const recipe = fermentationStorage.getRecipe(pos);
    const output = fermentationStorage.getOutput(pos);
    const isReady = fermentationStorage.isReady(pos);
    const daysElapsed = fermentationStorage.getDaysElapsed(pos, voxelMap);
    const daysRequired = recipe?.daysRequired ?? 0;
    const progressPct = isReady && daysRequired > 0 ? Math.min(100, Math.round(((daysElapsed - 1) / daysRequired) * 100)) : 0;
    const progressLabel = isReady ? `${Math.max(0, daysElapsed - 1)} / ${daysRequired} 日` : "材料を揃えてください";

    return (
        <>
            <SidePanel open={open} title="発酵桶" onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">仕込み</h3>
                    <div className="sg-processing-recipe-selector">
                        <label htmlFor="sg-fermentation-recipe-select">品目:</label>
                        <select
                            id="sg-fermentation-recipe-select"
                            value={selectedRecipeIndex}
                            onChange={(e) => fermentationStorage.setSelectedRecipeIndex(pos, Number(e.target.value), voxelMap)}
                        >
                            {FERMENTATION_RECIPES.map((r, i) => (
                                <option key={i} value={i}>
                                    {getItemDisplayName(r.output.itemId)} ×{r.output.count}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sg-processing-row">
                        <div className="sg-forge-slots">
                            {recipe?.inputs.map((g, i) => (
                                <div className="sg-forge-row" key={g.itemId}>
                                    <span className="sg-forge-row-label">
                                        {getItemDisplayName(g.itemId)} ×{g.count}
                                    </span>
                                    <Slot
                                        stack={getSlot({ area: "vat_input", index: i })}
                                        onLeftClick={(e) => handleLeftClick({ area: "vat_input", index: i }, e.nativeEvent)}
                                        onRightClick={() => handleRightClick({ area: "vat_input", index: i })}
                                    />
                                </div>
                            ))}
                        </div>
                        <span className="sg-processing-arrow">→</span>
                        <Slot
                            stack={output}
                            onLeftClick={(e) => handleLeftClick({ area: "vat_output", index: 0 }, e.nativeEvent)}
                            onRightClick={() => handleRightClick({ area: "vat_output", index: 0 })}
                        />
                    </div>

                    <div className="sg-processing-progress">
                        <div className="sg-progress-bar">
                            <div className="sg-progress-fill" style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="sg-processing-progress-label">{progressLabel}</span>
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
    mode: "fermentation",
    component: ({ open, engine }) => (
        <FermentationPanel
            open={open}
            inventory={engine.inventory}
            fermentationStorage={engine.fermentationStorage}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
