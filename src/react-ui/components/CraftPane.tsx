import { useMemo, useState } from "react";
import type { CraftStation, ICraftSystem, ItemId, ItemStack, RecipeDef } from "../../_boundary/interfaces";
import { getItemDisplayName } from "../../_registry/ItemRegistry";
import { ItemIcon } from "./ItemIcon";
import { Slot } from "./Slot";

const RECIPES_PER_PAGE = 24;

const CRAFT_TOOL_ITEM_IDS: ReadonlySet<ItemId> = new Set([
    "hand",
    "pickaxe",
    "axe",
    "sickle",
    "shovel",
    "hoes",
    "watering_can",
    "tongs",
    "stone_hammer",
    "froe",
    "chisel",
    "stone_pickaxe",
    "stone_axe",
    "stone_sickle",
    "wooden_shovel",
    "wooden_hoes",
    "clay_watering_can",
]);

export interface CraftPaneProps {
    craftSystem: ICraftSystem;
    station: CraftStation;
    /** ピックアップ中のアイテム（カーソルに持っているもの）。 */
    pickedUp: ItemStack | null;
    /** ツールスロットのクリックを処理する。 */
    onToolSlotLeftClick: () => void;
    /** 一時停止中かどうか。true のときクラフト実行を無効化する。 */
    isPaused?: boolean;
}

export function CraftPane({ craftSystem, station, pickedUp, onToolSlotLeftClick, isPaused }: CraftPaneProps) {
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
    const [page, setPage] = useState(0);

    const allRecipes = useMemo(() => craftSystem.getAvailableRecipes(station), [craftSystem, station]);
    const totalPages = Math.max(1, Math.ceil(allRecipes.length / RECIPES_PER_PAGE));
    const safePage = Math.min(page, totalPages - 1);
    const pageRecipes = allRecipes.slice(safePage * RECIPES_PER_PAGE, (safePage + 1) * RECIPES_PER_PAGE);
    const selectedRecipe = allRecipes.find((r) => r.id === selectedRecipeId) ?? null;
    const tool = craftSystem.getToolSlot();

    return (
        <div className="sg-sidepanel-section">
            <div className="sg-craft-tool-row">
                <span className="sg-section-title" style={{ margin: 0 }}>
                    Tool:
                </span>
                <Slot
                    stack={tool}
                    onLeftClick={() => {
                        const isToolItem = pickedUp ? CRAFT_TOOL_ITEM_IDS.has(pickedUp.itemId) : true;
                        if (!pickedUp || isToolItem) onToolSlotLeftClick();
                    }}
                />
            </div>

            <div className="sg-recipe-grid">
                {pageRecipes.map((recipe) => {
                    const canCraft = craftSystem.canCraft(recipe);
                    const selected = recipe.id === selectedRecipeId;
                    return (
                        <div
                            key={recipe.id}
                            className={`sg-recipe-cell${selected ? " is-selected" : ""}${canCraft ? "" : " is-uncraftable"}`}
                            data-tooltip={getItemDisplayName(recipe.result.itemId)}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipeId(recipe.id);
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedRecipeId(recipe.id);
                                if (canCraft && !isPaused) craftSystem.craft(recipe);
                            }}
                        >
                            <ItemIcon itemId={recipe.result.itemId} size={48} />
                            {recipe.result.count >= 2 && <span className="sg-slot-count">{recipe.result.count}</span>}
                        </div>
                    );
                })}
                {/* 空セル */}
                {Array.from({ length: RECIPES_PER_PAGE - pageRecipes.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="sg-recipe-cell is-uncraftable" />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="sg-pagination">
                    <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage <= 0}>
                        Prev
                    </button>
                    <span>
                        {safePage + 1} / {totalPages}
                    </span>
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                        Next
                    </button>
                </div>
            )}

            {selectedRecipe && <RecipeDetail recipe={selectedRecipe} />}
        </div>
    );
}

function RecipeDetail({ recipe }: { recipe: RecipeDef }) {
    return (
        <div className="sg-recipe-detail">
            <div className="sg-recipe-detail-title">
                {recipe.result.itemId} × {recipe.result.count}
            </div>
            {recipe.requiredTool && (
                <div className="sg-recipe-detail-row">
                    <span>Required tool:</span>
                    <ItemIcon itemId={recipe.requiredTool.itemId} size={32} />
                    <span>{recipe.requiredTool.itemId}</span>
                </div>
            )}
            <div className="sg-recipe-detail-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <span>Materials:</span>
                {recipe.ingredients.map((ing, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ItemIcon itemId={ing.itemId} size={20} />
                        <span>
                            x{ing.count} {ing.itemId}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
