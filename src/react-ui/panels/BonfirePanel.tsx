import { useCallback } from "react";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../../_boundary/interfaces";
import { getItemDisplayName } from "../../_registry/ItemRegistry";
import type { BonfireSlotKind, BonfireStorage } from "../../engine/BonfireStorage";
import { BONFIRE_MATERIAL_DEF, findAllRecipesForInput } from "../../_registry/ProcessingRecipes";
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

type BonfireSlotArea = "inventory" | "toolbar" | "bonfire_fuel" | "bonfire_material" | "bonfire_output_ash" | "bonfire_output_steamed";
type BonfireSlotRef = { area: BonfireSlotArea; index: number };

function areaToKind(area: BonfireSlotArea): BonfireSlotKind | null {
    switch (area) {
        case "bonfire_fuel":
            return "fuel";
        case "bonfire_material":
            return "material";
        case "bonfire_output_ash":
            return "outputAsh";
        case "bonfire_output_steamed":
            return "outputSteamed";
        default:
            return null;
    }
}

export interface BonfirePanelProps {
    open: boolean;
    inventory: IInventoryWriter;
    bonfireStorage: BonfireStorage;
    voxelMap: IVoxelWriter;
    uiState: UIState;
}

export function BonfirePanel({ open, inventory, bonfireStorage, voxelMap, uiState }: BonfirePanelProps) {
    useFrameTick(open);
    const targetPos = uiState.targetPos;

    const getSlot = useCallback(
        (ref: BonfireSlotRef): ItemStack | null => {
            const kind = areaToKind(ref.area);
            if (kind) return targetPos ? bonfireStorage.getSlot(targetPos, kind) : null;
            return inventory.getSlot(ref as SlotRef);
        },
        [inventory, bonfireStorage, targetPos],
    );

    const setSlot = useCallback(
        (ref: BonfireSlotRef, stack: ItemStack | null) => {
            const kind = areaToKind(ref.area);
            if (kind) {
                if (targetPos) bonfireStorage.setSlot(targetPos, kind, stack, voxelMap);
                return;
            }
            inventory.setSlot(ref as SlotRef, stack);
        },
        [inventory, bonfireStorage, voxelMap, targetPos],
    );

    const canPlaceTo = useCallback(
        (ref: BonfireSlotRef, stack: ItemStack): boolean => {
            if (ref.area === "bonfire_fuel") return bonfireStorage.canAcceptFuel(stack.itemId);
            if (ref.area === "bonfire_material") return bonfireStorage.canAcceptMaterial(stack.itemId);
            if (ref.area === "bonfire_output_ash" || ref.area === "bonfire_output_steamed") return false;
            return true;
        },
        [bonfireStorage],
    );

    const getQuickTransferTargets = useCallback((ref: BonfireSlotRef): BonfireSlotRef[] | undefined => {
        const invTotal = INV_ROWS * COLS;
        // 焚き火スロット → インベントリ + toolbar 1..9
        if (areaToKind(ref.area)) {
            const targets: BonfireSlotRef[] = [];
            for (let i = 0; i < invTotal; i++) targets.push({ area: "inventory", index: i });
            for (let i = 1; i <= TOOLBAR_COLS; i++) targets.push({ area: "toolbar", index: i });
            return targets;
        }
        // インベントリ/ツールバー → 燃料 と 素材（canPlaceTo がアイテム種別で振り分ける）
        return [
            { area: "bonfire_fuel", index: 0 },
            { area: "bonfire_material", index: 0 },
        ];
    }, []);

    const getQuickTransferSources = useCallback((ref: BonfireSlotRef): BonfireSlotRef[] => {
        const invTotal = INV_ROWS * COLS;
        if (areaToKind(ref.area)) {
            return [
                { area: "bonfire_fuel", index: 0 },
                { area: "bonfire_material", index: 0 },
                { area: "bonfire_output_ash", index: 0 },
                { area: "bonfire_output_steamed", index: 0 },
            ];
        }
        const sources: BonfireSlotRef[] = [];
        for (let i = 0; i < invTotal; i++) sources.push({ area: "inventory", index: i });
        for (let i = 1; i <= TOOLBAR_COLS; i++) sources.push({ area: "toolbar", index: i });
        return sources;
    }, []);

    const { pickedUp, cursorPos, handleLeftClick, handleRightClick } = usePickup<BonfireSlotRef>(open, {
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

    const fuel = targetPos ? bonfireStorage.getSlot(targetPos, "fuel") : null;
    const material = targetPos ? bonfireStorage.getSlot(targetPos, "material") : null;
    const outputAsh = targetPos ? bonfireStorage.getSlot(targetPos, "outputAsh") : null;
    const outputSteamed = targetPos ? bonfireStorage.getSlot(targetPos, "outputSteamed") : null;
    const isBurning = targetPos ? bonfireStorage.isBurning(targetPos) : false;

    // 素材に複数レシピ（蒸麦 / 炒り麦）があるときドロップダウンを出す。
    const materialRecipes = material ? findAllRecipesForInput(BONFIRE_MATERIAL_DEF, material.itemId) : [];
    const showRecipeSelector = materialRecipes.length > 1;
    const selectedRecipeIndex = targetPos ? bonfireStorage.getSelectedRecipeIndex(targetPos) : 0;
    const onSelectRecipe = (index: number) => {
        if (targetPos) bonfireStorage.setSelectedRecipeIndex(targetPos, index);
    };

    return (
        <>
            <SidePanel open={open} title={isBurning ? "焚き火（燃焼中）" : "焚き火"} onClose={close}>
                <section className="sg-sidepanel-section">
                    <h3 className="sg-section-title">焚き火</h3>
                    <div className="sg-forge-slots">
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">燃料</span>
                            <Slot
                                stack={fuel}
                                onLeftClick={(e) => handleLeftClick({ area: "bonfire_fuel", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "bonfire_fuel", index: 0 })}
                            />
                            <span className="sg-processing-arrow">→</span>
                            <span className="sg-forge-row-label">草木灰</span>
                            <Slot
                                stack={outputAsh}
                                onLeftClick={(e) => handleLeftClick({ area: "bonfire_output_ash", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "bonfire_output_ash", index: 0 })}
                            />
                        </div>
                        <div className="sg-forge-row">
                            <span className="sg-forge-row-label">素材</span>
                            <Slot
                                stack={material}
                                onLeftClick={(e) => handleLeftClick({ area: "bonfire_material", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "bonfire_material", index: 0 })}
                            />
                            <span className="sg-processing-arrow">→</span>
                            <span className="sg-forge-row-label">加工品</span>
                            <Slot
                                stack={outputSteamed}
                                onLeftClick={(e) => handleLeftClick({ area: "bonfire_output_steamed", index: 0 }, e.nativeEvent)}
                                onRightClick={() => handleRightClick({ area: "bonfire_output_steamed", index: 0 })}
                            />
                        </div>
                        {showRecipeSelector && (
                            <div className="sg-processing-recipe-selector">
                                <label htmlFor="sg-bonfire-recipe-select">加工先:</label>
                                <select
                                    id="sg-bonfire-recipe-select"
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
    mode: "bonfire",
    component: ({ open, engine }) => (
        <BonfirePanel
            open={open}
            inventory={engine.inventory}
            bonfireStorage={engine.bonfireStorage}
            voxelMap={engine.voxelMap}
            uiState={engine.uiState}
        />
    ),
});
