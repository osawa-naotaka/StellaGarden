import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { CraftStation, ICraftSystem, Pos2D, RecipeDef } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";

interface CraftPaneOptions {
    onToolSlotLeftClick?: (event: FederatedPointerEvent) => void;
}

const RECIPE_CELL_SIZE = 60;
const RECIPE_ICON_SIZE = 48;
const RECIPE_COLS = 4;
const RECIPE_ROWS = 4;
const RECIPES_PER_PAGE = RECIPE_COLS * RECIPE_ROWS;

const TOOL_SLOT_SIZE = 60;
const TOOL_SLOT_ICON_SIZE = 48;
const TOOL_SLOT_AREA_HEIGHT = 92;

const MATERIAL_ROW_HEIGHT = 60;
const PANE_PADDING = 8;
const MATERIAL_ICON_SIZE = 48;

const PAGINATION_HEIGHT = 36;
const PAGINATION_BUTTON_WIDTH = 72;
const PAGINATION_BUTTON_HEIGHT = 28;
const PAGINATION_LABEL_FONT_SIZE = 20;

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

interface PaginationButton {
    container: Container;
    background: Graphics;
    label: BitmapText;
}

interface ToolSlotDisplay {
    container: Container;
    border: Graphics;
    sprite: Sprite;
    graphics: Graphics;
    label: BitmapText;
}

interface ToolRequirementDisplay {
    container: Container;
    label: BitmapText;
    sprite: Sprite;
    graphics: Graphics;
    nameText: BitmapText;
}

/** クラフトタブの右側ペイン。レシピグリッドと選択レシピの素材表示を担当する。 */
export class CraftPane {
    readonly container: Container;

    private craftSystem: ICraftSystem;
    private recipeIcons: RecipeIcon[] = [];
    private materialRows: MaterialRow[] = [];
    private selectedRecipe: RecipeDef | null = null;

    private recipeGridContainer: Container;
    private paginationContainer: Container;
    private materialContainer: Container;
    private materialLabel: BitmapText;
    private pageLabel: BitmapText;
    private prevButton: PaginationButton;
    private nextButton: PaginationButton;
    private toolSlotDisplay: ToolSlotDisplay;
    private toolRequirementDisplay: ToolRequirementDisplay;

    /** 現在のステーションで利用可能なレシピ一覧。update() で更新される。 */
    private currentRecipes: readonly RecipeDef[] = [];
    private currentPage = 0;
    private onToolSlotLeftClick?: (event: FederatedPointerEvent) => void;

    constructor(craftSystem: ICraftSystem, station: CraftStation, options: CraftPaneOptions = {}) {
        this.craftSystem = craftSystem;
        this.container = new Container();
        this.onToolSlotLeftClick = options.onToolSlotLeftClick;

        this.toolSlotDisplay = this.createToolSlotDisplay();
        this.toolSlotDisplay.container.x = PANE_PADDING;
        this.toolSlotDisplay.container.y = PANE_PADDING;
        this.container.addChild(this.toolSlotDisplay.container);

        // レシピグリッドコンテナ（右上エリア）
        this.recipeGridContainer = new Container();
        this.recipeGridContainer.y = PANE_PADDING + TOOL_SLOT_AREA_HEIGHT;
        this.recipeGridContainer.x = PANE_PADDING;
        this.container.addChild(this.recipeGridContainer);

        // ページネーションコンテナ
        this.paginationContainer = new Container();
        this.paginationContainer.x = PANE_PADDING;
        this.paginationContainer.y = PANE_PADDING + TOOL_SLOT_AREA_HEIGHT + RECIPE_ROWS * RECIPE_CELL_SIZE + PANE_PADDING;
        this.container.addChild(this.paginationContainer);

        this.prevButton = this.createPaginationButton("Prev");
        this.prevButton.container.x = 0;
        this.paginationContainer.addChild(this.prevButton.container);

        this.pageLabel = new BitmapText({
            text: "1 / 1",
            style: { fontFamily: "Roboto", fontSize: PAGINATION_LABEL_FONT_SIZE, fill: 0xdddddd },
        });
        this.pageLabel.x = PAGINATION_BUTTON_WIDTH + 12;
        this.pageLabel.y = 4;
        this.paginationContainer.addChild(this.pageLabel);

        this.nextButton = this.createPaginationButton("Next");
        this.nextButton.container.x = RECIPE_COLS * RECIPE_CELL_SIZE - PAGINATION_BUTTON_WIDTH;
        this.paginationContainer.addChild(this.nextButton.container);

        this.prevButton.container.on("pointerdown", (event: FederatedPointerEvent) => {
            event.stopPropagation();
            if (this.currentPage <= 0) return;
            this.currentPage--;
            this.refreshRecipePage();
        });

        this.nextButton.container.on("pointerdown", (event: FederatedPointerEvent) => {
            event.stopPropagation();
            if (this.currentPage >= this.getTotalPages() - 1) return;
            this.currentPage++;
            this.refreshRecipePage();
        });

        this.toolRequirementDisplay = this.createToolRequirementDisplay();
        this.container.addChild(this.toolRequirementDisplay.container);

        // 素材エリアラベル（右下エリア）
        this.materialLabel = new BitmapText({
            text: "Materials:",
            style: { fontFamily: "Roboto", fontSize: 24, fill: 0xaaaaaa },
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
        this.refreshRecipePage();
    }

    private createPaginationButton(text: string): PaginationButton {
        const container = new Container();
        container.hitArea = new Rectangle(0, 0, PAGINATION_BUTTON_WIDTH, PAGINATION_BUTTON_HEIGHT);
        container.interactive = true;
        container.cursor = "pointer";

        const background = new Graphics();
        container.addChild(background);

        const label = new BitmapText({
            text,
            style: { fontFamily: "Roboto", fontSize: 18, fill: 0xffffff },
        });
        label.x = 10;
        label.y = 4;
        container.addChild(label);

        return { container, background, label };
    }

    private createToolSlotDisplay(): ToolSlotDisplay {
        const container = new Container();

        const label = new BitmapText({
            text: "Tool:",
            style: { fontFamily: "Roboto", fontSize: 24, fill: 0xaaaaaa },
        });
        container.addChild(label);

        const slotContainer = new Container();
        slotContainer.y = 28;
        slotContainer.hitArea = new Rectangle(0, 0, TOOL_SLOT_SIZE, TOOL_SLOT_SIZE);
        slotContainer.interactive = true;
        slotContainer.cursor = "pointer";
        slotContainer.on("pointerdown", (event: FederatedPointerEvent) => {
            event.stopPropagation();
            if (event.button !== 0) return;
            this.onToolSlotLeftClick?.(event);
        });
        container.addChild(slotContainer);

        const border = new Graphics();
        slotContainer.addChild(border);

        const iconOffset = (TOOL_SLOT_SIZE - TOOL_SLOT_ICON_SIZE) / 2;

        const sprite = new Sprite();
        sprite.width = TOOL_SLOT_ICON_SIZE;
        sprite.height = TOOL_SLOT_ICON_SIZE;
        sprite.x = iconOffset;
        sprite.y = iconOffset;
        sprite.visible = false;
        slotContainer.addChild(sprite);

        const graphics = new Graphics();
        graphics.visible = false;
        slotContainer.addChild(graphics);

        return { container: slotContainer, border, sprite, graphics, label };
    }

    private createToolRequirementDisplay(): ToolRequirementDisplay {
        const container = new Container();
        container.visible = false;

        const label = new BitmapText({
            text: "Tool:",
            style: { fontFamily: "Roboto", fontSize: 24, fill: 0xaaaaaa },
        });
        container.addChild(label);

        const sprite = new Sprite();
        sprite.width = MATERIAL_ICON_SIZE;
        sprite.height = MATERIAL_ICON_SIZE;
        sprite.y = 30;
        sprite.visible = false;
        container.addChild(sprite);

        const graphics = new Graphics();
        graphics.y = 30;
        graphics.visible = false;
        container.addChild(graphics);

        const nameText = new BitmapText({
            text: "",
            style: { fontFamily: "Roboto", fontSize: 24, fill: 0xdddddd },
        });
        nameText.x = MATERIAL_ICON_SIZE + 6;
        nameText.y = 42;
        container.addChild(nameText);

        return { container, label, sprite, graphics, nameText };
    }

    /** レシピアイコンを事前確保して並べる。 */
    private buildRecipeIcons(): void {
        // 既存アイコンをクリア
        for (const icon of this.recipeIcons) {
            this.recipeGridContainer.removeChild(icon.container);
        }
        this.recipeIcons = [];

        for (let i = 0; i < RECIPES_PER_PAGE; i++) {
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

            const icon: RecipeIcon = { container: itemContainer, sprite, graphics, border, recipe: null };
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
    }

    private getTotalPages(): number {
        return Math.max(1, Math.ceil(this.currentRecipes.length / RECIPES_PER_PAGE));
    }

    private getRecipesForCurrentPage(): readonly RecipeDef[] {
        const startIndex = this.currentPage * RECIPES_PER_PAGE;
        return this.currentRecipes.slice(startIndex, startIndex + RECIPES_PER_PAGE);
    }

    private refreshRecipePage(): void {
        const totalPages = this.getTotalPages();
        if (this.currentPage >= totalPages) {
            this.currentPage = totalPages - 1;
        }
        if (this.currentPage < 0) {
            this.currentPage = 0;
        }

        this.applyRecipeIconContent();
        this.updateRecipeBorders();
        this.updatePaginationDisplay();
        this.updateMaterialDisplay();
    }

    /** レシピアイコンにアイテム画像を適用する。 */
    private applyRecipeIconContent(): void {
        const pageRecipes = this.getRecipesForCurrentPage();

        for (let i = 0; i < this.recipeIcons.length; i++) {
            const icon = this.recipeIcons[i];
            const recipe = pageRecipes[i] ?? null;
            icon.recipe = recipe;

            if (!recipe) {
                icon.sprite.visible = false;
                icon.graphics.visible = false;
                icon.container.interactive = false;
                icon.container.alpha = 1.0;
                continue;
            }

            icon.container.interactive = true;
            const def = getItemDef(recipe.result.itemId);
            if (!def) {
                icon.sprite.visible = false;
                icon.graphics.visible = false;
                continue;
            }

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

    private updatePaginationDisplay(): void {
        const totalPages = this.getTotalPages();
        this.pageLabel.text = `${this.currentPage + 1} / ${totalPages}`;

        this.updatePaginationButtonState(this.prevButton, this.currentPage > 0);
        this.updatePaginationButtonState(this.nextButton, this.currentPage < totalPages - 1);
    }

    private updatePaginationButtonState(button: PaginationButton, enabled: boolean): void {
        button.container.interactive = enabled;
        button.container.cursor = enabled ? "pointer" : "default";
        button.container.alpha = enabled ? 1.0 : 0.4;

        button.background.clear();
        button.background.roundRect(0, 0, PAGINATION_BUTTON_WIDTH, PAGINATION_BUTTON_HEIGHT, 6);
        button.background.fill({ color: enabled ? 0x4a4a4a : 0x2f2f2f, alpha: 0.95 });
        button.background.stroke({ width: 2, color: enabled ? 0x888888 : 0x555555 });
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
                style: { fontFamily: "Roboto", fontSize: 24, fill: 0xdddddd },
            });
            countText.x = MATERIAL_ICON_SIZE + 6;
            countText.y = (MATERIAL_ICON_SIZE - 24) / 2;
            rowContainer.addChild(countText);

            this.materialContainer.addChild(rowContainer);
            this.materialRows.push({ container: rowContainer, sprite, graphics, countText });
        }
    }

    /** 選択レシピに応じて素材表示を更新する。 */
    private updateMaterialDisplay(): void {
        const gridHeight = RECIPE_ROWS * RECIPE_CELL_SIZE;
        const paginationY = PANE_PADDING + TOOL_SLOT_AREA_HEIGHT + gridHeight + PANE_PADDING;
        const toolLabelY = paginationY + PAGINATION_HEIGHT + PANE_PADDING;

        this.toolRequirementDisplay.container.x = PANE_PADDING;
        this.toolRequirementDisplay.container.y = toolLabelY;
        this.toolRequirementDisplay.container.visible = false;
        this.toolRequirementDisplay.sprite.visible = false;
        this.toolRequirementDisplay.graphics.visible = false;

        let materialLabelY = toolLabelY;

        if (this.selectedRecipe?.requiredTool) {
            const toolDef = getItemDef(this.selectedRecipe.requiredTool.itemId);
            this.toolRequirementDisplay.container.visible = true;
            materialLabelY += MATERIAL_ROW_HEIGHT;

            if (toolDef?.spriteName) {
                this.toolRequirementDisplay.sprite.texture = Texture.from(toolDef.spriteName);
                this.toolRequirementDisplay.sprite.visible = true;
                this.toolRequirementDisplay.graphics.visible = false;
            } else {
                this.toolRequirementDisplay.graphics.clear();
                this.toolRequirementDisplay.graphics.rect(0, 0, MATERIAL_ICON_SIZE, MATERIAL_ICON_SIZE);
                this.toolRequirementDisplay.graphics.fill({ color: toolDef?.placeholderColor ?? 0x888888 });
                this.toolRequirementDisplay.graphics.visible = true;
                this.toolRequirementDisplay.sprite.visible = false;
            }

            this.toolRequirementDisplay.nameText.text = this.selectedRecipe.requiredTool.itemId;
        }

        this.materialLabel.x = PANE_PADDING;
        this.materialLabel.y = materialLabelY;

        this.materialContainer.x = PANE_PADDING;
        this.materialContainer.y = materialLabelY + 32;

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

    setOnToolSlotLeftClick(callback: ((event: FederatedPointerEvent) => void) | undefined): void {
        this.onToolSlotLeftClick = callback;
    }

    getToolSlot() {
        return this.craftSystem.getToolSlot();
    }

    setToolSlot(stack: import("../_boundary/interfaces").ItemStack | null): void {
        this.craftSystem.setToolSlot(stack);
        this.updateToolSlotDisplay();
        this.updateMaterialDisplay();
    }

    private updateToolSlotDisplay(): void {
        const toolStack = this.craftSystem.getToolSlot();
        this.toolSlotDisplay.border.clear();
        this.toolSlotDisplay.border.rect(0, 0, TOOL_SLOT_SIZE, TOOL_SLOT_SIZE);
        this.toolSlotDisplay.border.stroke({ width: 2, color: 0x888888 });

        this.toolSlotDisplay.sprite.visible = false;
        this.toolSlotDisplay.graphics.visible = false;

        if (!toolStack) {
            return;
        }

        const def = getItemDef(toolStack.itemId);
        if (!def) {
            return;
        }

        if (def.spriteName) {
            this.toolSlotDisplay.sprite.texture = Texture.from(def.spriteName);
            this.toolSlotDisplay.sprite.visible = true;
            this.toolSlotDisplay.graphics.visible = false;
        } else {
            const iconOffset = (TOOL_SLOT_SIZE - TOOL_SLOT_ICON_SIZE) / 2;
            this.toolSlotDisplay.graphics.clear();
            this.toolSlotDisplay.graphics.rect(iconOffset, iconOffset, TOOL_SLOT_ICON_SIZE, TOOL_SLOT_ICON_SIZE);
            this.toolSlotDisplay.graphics.fill({ color: def.placeholderColor ?? 0x888888 });
            this.toolSlotDisplay.graphics.visible = true;
            this.toolSlotDisplay.sprite.visible = false;
        }
    }

    /** ゲームループから毎 tick 呼ぶ。クラフト可否に応じてアイコンの alpha を更新する。 */
    tick(): void {
        this.updateToolSlotDisplay();

        for (let i = 0; i < this.recipeIcons.length; i++) {
            const icon = this.recipeIcons[i];
            if (!icon.recipe) continue;
            icon.container.alpha = this.craftSystem.canCraft(icon.recipe) ? 1.0 : 0.3;
        }
    }

    /** ステーション変更時にレシピ一覧を再取得して再構築する。 */
    update(station: CraftStation, _workbenchPos: Pos2D | null = null): void {
        this.currentRecipes = this.craftSystem.getAvailableRecipes(station);
        this.currentPage = 0;
        this.selectedRecipe = null;
        this.refreshRecipePage();
    }

    get top(): Container {
        return this.container;
    }
}