import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CraftStation, ICraftSystem, ItemId, ItemStack, RecipeDef } from "../../_boundary/interfaces";
import { getItemDisplayName } from "../../_registry/ItemRegistry";
import { useFrameTick } from "../hooks/useFrameTick";
import { ItemIcon } from "./ItemIcon";
import { Slot } from "./Slot";

const RECIPES_PER_PAGE = 24;
/** 作成ボタン押下から 1 サイクル完了までの時間（ms）。ManualProcessingPanel と同様、押し続けで連続生成する。 */
const CRAFT_INTERVAL_MS = 1000;

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

    // 作成ボタン: 押下を CRAFT_INTERVAL_MS だけ継続して初めて 1 サイクル実行する。
    // 押下開始時刻を ref で持ち、useFrameTick による毎フレーム再描画で進捗 % を算出する。
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const holdStartRef = useRef<number | null>(null);
    const [holding, setHolding] = useState(false);
    // 押下中の進捗バーをなめらかに更新するため、押下中のみ毎フレーム再描画する。
    useFrameTick(holding);

    const stopCrafting = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        holdStartRef.current = null;
        setHolding(false);
    }, []);

    const startCrafting = useCallback(() => {
        if (!selectedRecipe) return;
        if (isPaused) return;
        stopCrafting();
        // いまクラフト不可（素材不足・道具不一致・出力満杯 等）なら、進捗バーも動かさず何もしない。
        if (!craftSystem.canCraft(selectedRecipe)) return;
        // 即時実行はしない。CRAFT_INTERVAL_MS 経過後に初めて 1 サイクル目を試みる。
        holdStartRef.current = Date.now();
        setHolding(true);
        intervalRef.current = setInterval(() => {
            const ok = craftSystem.craft(selectedRecipe);
            if (!ok) {
                // 素材不足・追加不可 → 停止
                stopCrafting();
                return;
            }
            // 次サイクルへ。消費後の状態で次が回せるかをチェックして、不可なら即停止する。
            if (!craftSystem.canCraft(selectedRecipe)) {
                stopCrafting();
                return;
            }
            holdStartRef.current = Date.now();
        }, CRAFT_INTERVAL_MS);
    }, [selectedRecipe, isPaused, craftSystem, stopCrafting]);

    // unmount で必ずインターバルを止める。
    // 選択レシピ変更時の停止は、レシピセルの onClick 側で stopCrafting を直接呼んでいる。
    useEffect(() => {
        return stopCrafting;
    }, [stopCrafting]);

    // 押下中の進捗（0..1）。useFrameTick による毎フレーム再描画でスムースに更新される。
    const holdProgress = (() => {
        if (holdStartRef.current === null) return 0;
        const elapsed = Date.now() - holdStartRef.current;
        return Math.min(1, elapsed / CRAFT_INTERVAL_MS);
    })();
    const holdPct = Math.round(holdProgress * 100);
    const buttonStyle =
        holdStartRef.current !== null
            ? { background: `linear-gradient(90deg, var(--sg-accent-strong) ${holdPct}%, var(--sg-bg-elev2) ${holdPct}%)` }
            : undefined;

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
                                if (recipe.id !== selectedRecipeId) {
                                    // 別のレシピに切り替えるときは進行中のクラフトを止める。
                                    stopCrafting();
                                }
                                setSelectedRecipeId(recipe.id);
                            }}
                            onContextMenu={(e) => {
                                // 右クリックメニューを抑止するだけで、それ以外の挙動は持たない。
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <ItemIcon itemId={recipe.result.itemId} size={48} />
                            {recipe.result.count >= 2 && <span className="sg-slot-count">{recipe.result.count}</span>}
                        </div>
                    );
                })}
                {/* 空セル */}
                {Array.from({ length: RECIPES_PER_PAGE - pageRecipes.length }).map((_, i) => (
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: 空セルのためのキー
                        key={`empty-${i}`}
                        className="sg-recipe-cell is-uncraftable"
                    />
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

            {selectedRecipe && (
                <>
                    <RecipeDetail recipe={selectedRecipe} />
                    <button
                        type="button"
                        className="sg-processing-button"
                        style={buttonStyle}
                        onMouseDown={startCrafting}
                        onMouseUp={stopCrafting}
                        onMouseLeave={stopCrafting}
                        onTouchStart={startCrafting}
                        onTouchEnd={stopCrafting}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        作成
                    </button>
                </>
            )}
        </div>
    );
}

function RecipeDetail({ recipe }: { recipe: RecipeDef }) {
    return (
        <div className="sg-recipe-detail">
            <div className="sg-recipe-detail-title">
                {getItemDisplayName(recipe.result.itemId)} × {recipe.result.count}
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
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: 材料のためのキー
                        key={i}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                        <ItemIcon itemId={ing.itemId} size={20} />
                        <span>
                            x{ing.count} {getItemDisplayName(ing.itemId)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
