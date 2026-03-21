import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { CraftStation, ICraftSystem, RecipeDef } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";

const RECIPE_CELL_SIZE = 40;
const RECIPE_ICON_SIZE = 32;
const RECIPE_COLS = 4;
const MATERIAL_ROW_HEIGHT = 36;
const PANE_WIDTH = 200;
const PANE_PADDING = 8;
const MATERIAL_ICON_SIZE = 24;

/** レシピアイコン1枚分の表示オブジェクト群。 */
interface RecipeIcon {
    container: Container;
    sprite: Sprite;
    graphics: Graphics;
    border: Graphics;
    recipe: RecipeDef | null;
}

/** 素材行1行分の表示オブジェクト群。 */
interface MaterialRow {
    container: Container;
    sprite: Sprite;
    graphics: Graphics;
    countText: BitmapText;
}

/** クラフトタブの右側ペイン。レシピグリッドと選択レシピの素材表示を担当する。 */
export class CraftPane {
    readonly container: Container;

    private craftSystem: ICraftSystem;
    private recipeIcons: RecipeIcon[] = [];
    private materialRows: MaterialRow[] = [];
    private selectedRecipe: RecipeDef | null = null;

    private recipeGridContainer: Container;
    private materialContainer: Container;
    private materialLabel: BitmapText;

    /** 現在のステーションで利用可能なレシピ一覧。update() で更新される。 */
    private currentRecipes: readonly RecipeDef[] = [];

    constructor(craftSystem: ICraftSystem, station: CraftStation) {
        this.craftSystem = craftSystem;
        this.container = new Container();

        // 背景
        const bg = new Graphics();
        bg.rect(0, 0, PANE_WIDTH, 600);
        bg.fill({ color: 0x222222, alpha: 0.5 });
        this.container.addChild(bg);

        // レシピグリッドコンテナ（右上エリア）
        this.recipeGridContainer = new Container();
        this.recipeGridContainer.y = PANE_PADDING;
        this.recipeGridContainer.x = PANE_PADDING;
        this.container.addChild(this.recipeGridContainer);

        // 素材エリアラベル（右下エリア）
        this.materialLabel = new BitmapText({
            text: "Materials:",
            style: { fontFamily: "Roboto", fontSize: 13, fill: 0xaaaaaa },
        });

        // 素材コンテナ（右下エリア）
        this.materialContainer = new Container();
        this.container.addChild(this.materialLabel);
        this.container.addChild(this.materialContainer);

        // 初期レシピを取得して構築
        this.currentRecipes = craftSystem.getAvailableRecipes(station);
        this.buildRecipeIcons();
        this.buildMaterialRows();
        this.updateMaterialDisplay();
    }

    /** レシピアイコンを事前確保して並べる。 */
    private buildRecipeIcons(): void {
        // 既存アイコンをクリア
        for (const icon of this.recipeIcons) {
            this.recipeGridContainer.removeChild(icon.container);
        }
        this.recipeIcons = [];

        const maxRecipes = Math.max(this.currentRecipes.length, 1);

        for (let i = 0; i < maxRecipes; i++) {
            const recipe = this.currentRecipes[i] ?? null;
            const col = i % RECIPE_COLS;
            const row = Math.floor(i / RECIPE_COLS);

            const itemContainer = new Container();
            itemContainer.x = col * RECIPE_CELL_SIZE;
            itemContainer.y = row * RECIPE_CELL_SIZE;
            itemContainer.hitArea = new Rectangle(0, 0, RECIPE_CELL_SIZE, RECIPE_CELL_SIZE);
            itemContainer.interactive = true;
            itemContainer.cursor = "pointer";

            // セル背景枠
            const border = new Graphics();
            border.rect(0, 0, RECIPE_CELL_SIZE, RECIPE_CELL_SIZE);
            border.stroke({ width: 2, color: 0x555555 });
            itemContainer.addChild(border);

            // アイテムアイコン（スプライトまたはGraphics）
            const iconOffset = (RECIPE_CELL_SIZE - RECIPE_ICON_SIZE) / 2;

            const sprite = new Sprite();
            sprite.width = RECIPE_ICON_SIZE;
            sprite.height = RECIPE_ICON_SIZE;
            sprite.x = iconOffset;
            sprite.y = iconOffset;
            sprite.visible = false;
            itemContainer.addChild(sprite);

            const graphics = new Graphics();
            graphics.visible = false;
            itemContainer.addChild(graphics);

            this.recipeGridContainer.addChild(itemContainer);

            const icon: RecipeIcon = { container: itemContainer, sprite, graphics, border, recipe };
            this.recipeIcons.push(icon);

            // イベント登録（クロージャで icon を参照）
            const capturedIcon = icon;
            itemContainer.on("pointerdown", (event: FederatedPointerEvent) => {
                event.stopPropagation();
                if (!capturedIcon.recipe) return;

                if (event.button === 0) {
                    // 左クリック: レシピ選択
                    this.selectedRecipe = capturedIcon.recipe;
                    this.updateMaterialDisplay();
                    this.updateRecipeBorders();
                } else if (event.button === 2) {
                    // 右クリック: レシピ選択 + クラフト実行
                    this.selectedRecipe = capturedIcon.recipe;
                    this.updateMaterialDisplay();
                    this.updateRecipeBorders();
                    this.craftSystem.craft(capturedIcon.recipe);
                }
            });
        }

        this.applyRecipeIconContent();
        this.updateRecipeBorders();
    }

    /** レシピアイコンにアイテム画像を適用する。 */
    private applyRecipeIconContent(): void {
        for (let i = 0; i < this.recipeIcons.length; i++) {
            const icon = this.recipeIcons[i];
            const recipe = this.currentRecipes[i] ?? null;
            icon.recipe = recipe;

            if (!recipe) {
                icon.sprite.visible = false;
                icon.graphics.visible = false;
                icon.container.interactive = false;
                continue;
            }

            icon.container.interactive = true;
            const def = getItemDef(recipe.result.itemId);
            if (!def) continue;
            const iconOffset = (RECIPE_CELL_SIZE - RECIPE_ICON_SIZE) / 2;

            if (def.spriteName) {
                icon.sprite.texture = Texture.from(def.spriteName);
                icon.sprite.visible = true;
                icon.graphics.visible = false;
            } else {
                icon.graphics.clear();
                icon.graphics.rect(iconOffset, iconOffset, RECIPE_ICON_SIZE, RECIPE_ICON_SIZE);
                icon.graphics.fill({ color: def.placeholderColor ?? 0x888888 });
                icon.graphics.visible = true;
                icon.sprite.visible = false;
            }
        }
    }

    /** 選択レシピに応じてアイコンの枠線を更新する。 */
    private updateRecipeBorders(): void {
        for (const icon of this.recipeIcons) {
            icon.border.clear();
            icon.border.rect(0, 0, RECIPE_CELL_SIZE, RECIPE_CELL_SIZE);
            if (icon.recipe && this.selectedRecipe && icon.recipe.id === this.selectedRecipe.id) {
                icon.border.stroke({ width: 3, color: 0xffffff });
            } else {
                icon.border.stroke({ width: 2, color: 0x555555 });
            }
        }
    }

    /** 素材表示行を事前確保する（最大想定素材数）。 */
    private buildMaterialRows(): void {
        // 既存の行をクリア
        for (const row of this.materialRows) {
            this.materialContainer.removeChild(row.container);
        }
        this.materialRows = [];

        const MAX_MATERIALS = 8;

        for (let i = 0; i < MAX_MATERIALS; i++) {
            const rowContainer = new Container();
            rowContainer.visible = false;

            const sprite = new Sprite();
            sprite.width = MATERIAL_ICON_SIZE;
            sprite.height = MATERIAL_ICON_SIZE;
            sprite.visible = false;
            rowContainer.addChild(sprite);

            const graphics = new Graphics();
            graphics.visible = false;
            rowContainer.addChild(graphics);

            const countText = new BitmapText({
                text: "x0",
                style: { fontFamily: "Roboto", fontSize: 13, fill: 0xdddddd },
            });
            countText.x = MATERIAL_ICON_SIZE + 6;
            countText.y = (MATERIAL_ICON_SIZE - 13) / 2;
            rowContainer.addChild(countText);

            this.materialContainer.addChild(rowContainer);
            this.materialRows.push({ container: rowContainer, sprite, graphics, countText });
        }
    }

    /** 選択レシピに応じて素材表示を更新する。 */
    private updateMaterialDisplay(): void {
        // グリッド行数からオフセットを計算
        const recipeRows = Math.max(1, Math.ceil(this.currentRecipes.length / RECIPE_COLS));
        const gridHeight = recipeRows * RECIPE_CELL_SIZE;
        const labelY = PANE_PADDING + gridHeight + PANE_PADDING;

        this.materialLabel.x = PANE_PADDING;
        this.materialLabel.y = labelY;

        this.materialContainer.x = PANE_PADDING;
        this.materialContainer.y = labelY + 18;

        // 全行を非表示にしてリセット
        for (const row of this.materialRows) {
            row.container.visible = false;
        }

        if (!this.selectedRecipe) return;

        const ingredients = this.selectedRecipe.ingredients;
        for (let i = 0; i < ingredients.length && i < this.materialRows.length; i++) {
            const ingredient = ingredients[i];
            const row = this.materialRows[i];
            const def = getItemDef(ingredient.itemId);
            if (!def) continue;

            row.container.y = i * MATERIAL_ROW_HEIGHT;
            row.container.visible = true;

            if (def.spriteName) {
                row.sprite.texture = Texture.from(def.spriteName);
                row.sprite.visible = true;
                row.graphics.visible = false;
            } else {
                row.graphics.clear();
                row.graphics.rect(0, 0, MATERIAL_ICON_SIZE, MATERIAL_ICON_SIZE);
                row.graphics.fill({ color: def.placeholderColor ?? 0x888888 });
                row.graphics.visible = true;
                row.sprite.visible = false;
            }

            row.countText.text = `x${ingredient.count}  ${ingredient.itemId}`;
        }
    }

    /** ゲームループから毎 tick 呼ぶ。クラフト可否に応じてアイコンの alpha を更新する。 */
    tick(): void {
        for (let i = 0; i < this.recipeIcons.length; i++) {
            const icon = this.recipeIcons[i];
            if (!icon.recipe) continue;
            icon.container.alpha = this.craftSystem.canCraft(icon.recipe) ? 1.0 : 0.3;
        }
    }

    /** ステーション変更時にレシピ一覧を再取得して再構築する。 */
    update(station: CraftStation): void {
        this.currentRecipes = this.craftSystem.getAvailableRecipes(station);
        this.selectedRecipe = null;
        this.buildRecipeIcons();
        this.buildMaterialRows();
        this.updateMaterialDisplay();
    }

    get top(): Container {
        return this.container;
    }
}
