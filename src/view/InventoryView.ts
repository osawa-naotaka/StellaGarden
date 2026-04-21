import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { CraftStation, ICraftSystem, IInventoryWriter, ItemStack, SlotRef } from "../_boundary/interfaces";
import { getItemDef, getPlacementInfo, isPlaceable } from "../_registry/ItemRegistry";
import { CraftPane } from "./CraftPane";
import type { UIMode, UIState } from "./UIState";

const CELL_SIZE = 60;
const ICON_SIZE = 48;
const PADDING = 10;
const TAB_HEIGHT = 48;
const SEPARATOR_HEIGHT = 32;
const INVENTORY_COLS = 8;
const INVENTORY_ROWS = 8;
const TOOLBAR_COLS = 9;

/** スロットに事前確保した表示オブジェクト群。tick ごとに内容を上書きして使い回す。 */
interface SlotIcon {
    sprite: Sprite;
    graphics: Graphics;
    countText: BitmapText;
}

/** SlotIcon の内容を現在の ItemStack に合わせて更新する（アロケーションなし）。 */
function updateSlotIcon(icon: SlotIcon, stack: ItemStack | null, cellSize: number): void {
    if (!stack) {
        icon.sprite.visible = false;
        icon.graphics.visible = false;
        icon.countText.visible = false;
        return;
    }

    const def = getItemDef(stack.itemId);
    if (!def) return;
    const offset = (cellSize - ICON_SIZE) / 2;

    if (def.spriteName) {
        icon.sprite.texture = Texture.from(def.spriteName);
        icon.sprite.visible = true;
        icon.graphics.visible = false;
    } else {
        icon.graphics.clear();
        icon.graphics.rect(offset, offset, ICON_SIZE, ICON_SIZE);
        icon.graphics.fill({ color: def.placeholderColor ?? 0x888888 });
        icon.graphics.visible = true;
        icon.sprite.visible = false;
    }

    if (stack.count >= 2) {
        icon.countText.text = String(stack.count);
        icon.countText.x = cellSize - icon.countText.width - 2;
        icon.countText.visible = true;
    } else {
        icon.countText.visible = false;
    }
}

/** スロット Container に表示オブジェクトを事前追加し、SlotIcon を返す。
 *  返却した SlotIcon のフィールドは tick ごとに updateSlotIcon で上書きする。 */
function createSlotIcon(container: Container, cellSize: number): SlotIcon {
    const offset = (cellSize - ICON_SIZE) / 2;

    const sprite = new Sprite();
    sprite.width = ICON_SIZE;
    sprite.height = ICON_SIZE;
    sprite.x = offset;
    sprite.y = offset;
    sprite.visible = false;
    container.addChild(sprite);

    const graphics = new Graphics();
    graphics.visible = false;
    container.addChild(graphics);

    const countText = new BitmapText({
        text: "0",
        style: { fontFamily: "Roboto", fontSize: 24, fill: 0xffffff },
    });
    countText.y = cellSize - 28;
    countText.visible = false;
    container.addChild(countText);

    return { sprite, graphics, countText };
}

/** Eキーで開閉できる 8×8 インベントリウィンドウ。
 *  画面中央に表示し、ウィンドウ下部にツールバースロットも表示する。
 *  スロット間のアイテム移動（左クリック全交換・右クリック1個移動）をサポートする。
 *  placeable アイテムを右クリックすると onRequestPlacement コールバックを呼び、配置モードへ遷移する。
 *  「Inventory」「Craft」の2つのタブを持ち、クラフトタブではレシピ選択とクラフト実行が可能。 */
export class InventoryView {
    private container: Container;
    private inventory: IInventoryWriter;
    private uiState: UIState;
    private prevMode: UIMode = "normal";

    private invSlotContainers: Container[] = [];
    private tbSlotContainers: Container[] = [];

    private invSlotIcons: SlotIcon[] = [];
    private tbSlotIcons: SlotIcon[] = [];

    /** ピックアップ状態：カーソルに持っているアイテムと元スロット。 */
    private pickedUp: { stack: ItemStack; source: SlotRef } | null = null;
    /** カーソル追従アイコン用コンテナ。PickedUp 時のみ表示。 */
    private cursorContainer: Container;
    private cursorIcon: SlotIcon;

    /** ウィンドウの幅・高さ（位置計算に使用）。 */
    private windowWidth: number;
    private windowHeight: number;

    /** タブ管理 */
    private activeTab: "inventory" | "craft" = "inventory";
    private craftPane: CraftPane;

    /** タブボタン（背景 Graphics）への参照。switchTab で色を更新する。 */
    private tabBgInventory: Graphics;
    private tabBgCraft: Graphics;

    private onMouseMoveBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(inventory: IInventoryWriter, craftSystem: ICraftSystem, uiState: UIState) {
        this.inventory = inventory;
        this.uiState = uiState;
        this.container = new Container();
        this.container.visible = false;

        // 左ペイン幅（インベントリグリッドとツールバーの広い方）
        const invWidth = INVENTORY_COLS * CELL_SIZE;
        const tbWidth = TOOLBAR_COLS * CELL_SIZE;
        const leftPaneWidth = Math.max(invWidth, tbWidth) + PADDING * 2;

        // 右ペイン幅（CraftPane の幅）
        const rightPaneWidth = 300; // CraftPane の PANE_WIDTH
        const totalWidth = leftPaneWidth + rightPaneWidth + PADDING;

        const contentHeight = TAB_HEIGHT + INVENTORY_ROWS * CELL_SIZE + SEPARATOR_HEIGHT + CELL_SIZE;
        this.windowWidth = totalWidth;
        this.windowHeight = contentHeight + PADDING * 2;

        this.cursorContainer = new Container();
        this.cursorContainer.visible = false;
        this.cursorIcon = createSlotIcon(this.cursorContainer, CELL_SIZE);

        this.onMouseMoveBound = this.onMouseMove.bind(this);
        this.onKeyDownBound = this.onKeyDown.bind(this);

        // CraftPane を事前生成
        this.craftPane = new CraftPane(craftSystem, "hand");

        // タブボタン用プレースホルダー（buildUI 内で上書きされる）
        this.tabBgInventory = new Graphics();
        this.tabBgCraft = new Graphics();

        this.buildUI(leftPaneWidth);
        this.updateWindowPosition();
    }

    private buildUI(leftPaneWidth: number): void {
        // 背景
        const bg = new Graphics();
        bg.rect(0, 0, this.windowWidth, this.windowHeight);
        bg.fill({ color: 0x2a2a2a, alpha: 0.92 });
        bg.stroke({ width: 2, color: 0x888888 });
        bg.interactive = true;
        bg.on("pointerdown", (e) => e.stopPropagation());
        this.container.addChild(bg);

        // ─── タブバー ───────────────────────────────────────────────────────────
        const TAB_WIDTH = 100;
        const TAB_INNER_WIDTH = TAB_WIDTH - 2;

        // Inventory タブ
        this.tabBgInventory = new Graphics();
        this.tabBgInventory.rect(0, 0, TAB_INNER_WIDTH, TAB_HEIGHT - 4);
        this.tabBgInventory.fill({ color: 0x444444 }); // 初期は選択状態
        this.tabBgInventory.x = PADDING;
        this.tabBgInventory.y = PADDING;
        this.tabBgInventory.interactive = true;
        this.tabBgInventory.cursor = "pointer";
        this.tabBgInventory.on("pointerdown", (e: FederatedPointerEvent) => {
            e.stopPropagation();
            this.switchTab("inventory");
        });
        this.container.addChild(this.tabBgInventory);

        const tabLabelInventory = new BitmapText({
            text: "Inventory",
            style: { fontFamily: "Roboto", fontSize: 24, fill: 0xdddddd },
        });
        tabLabelInventory.x = PADDING + 8;
        tabLabelInventory.y = PADDING +(TAB_HEIGHT - 4 - 24) / 2;
        this.container.addChild(tabLabelInventory);

        // Craft タブ
        this.tabBgCraft = new Graphics();
        this.tabBgCraft.rect(0, 0, TAB_INNER_WIDTH, TAB_HEIGHT - 4);
        this.tabBgCraft.fill({ color: 0x333333 }); // 初期は非選択状態
        this.tabBgCraft.x = PADDING + TAB_WIDTH;
        this.tabBgCraft.y = PADDING;
        this.tabBgCraft.interactive = true;
        this.tabBgCraft.cursor = "pointer";
        this.tabBgCraft.on("pointerdown", (e: FederatedPointerEvent) => {
            e.stopPropagation();
            this.switchTab("craft");
        });
        this.container.addChild(this.tabBgCraft);

        const tabLabelCraft = new BitmapText({
            text: "Craft",
            style: { fontFamily: "Roboto", fontSize: 24, fill: 0xdddddd },
        });
        tabLabelCraft.x = PADDING + TAB_WIDTH + 8;
        tabLabelCraft.y = PADDING + (TAB_HEIGHT - 4 - 24) / 2;
        this.container.addChild(tabLabelCraft);

        // ─── 左ペイン（インベントリグリッド + ツールバー）──────────────────────
        const invWidth = INVENTORY_COLS * CELL_SIZE;
        const tbWidth = TOOLBAR_COLS * CELL_SIZE;
        const contentWidth = Math.max(invWidth, tbWidth);
        const invOffsetX = PADDING + (contentWidth - invWidth) / 2;
        const invOffsetY = PADDING + TAB_HEIGHT;

        // インベントリ 8×8 グリッド
        for (let row = 0; row < INVENTORY_ROWS; row++) {
            for (let col = 0; col < INVENTORY_COLS; col++) {
                const i = row * INVENTORY_COLS + col;
                const ref: SlotRef = { area: "inventory", index: i };
                const slotContainer = this.createSlotContainer(ref);
                slotContainer.x = invOffsetX + col * CELL_SIZE;
                slotContainer.y = invOffsetY + row * CELL_SIZE;
                this.container.addChild(slotContainer);
                this.invSlotContainers.push(slotContainer);
                this.invSlotIcons.push(createSlotIcon(slotContainer, CELL_SIZE));
            }
        }

        // 区切り線
        const sepY = invOffsetY + INVENTORY_ROWS * CELL_SIZE + SEPARATOR_HEIGHT / 2;
        const separator = new Graphics();
        separator.moveTo(PADDING, sepY);
        separator.lineTo(PADDING + contentWidth, sepY);
        separator.stroke({ width: 1, color: 0x888888, alpha: 0.7 });
        this.container.addChild(separator);

        // ツールバー部分（手スロット除く 9スロット: index 1〜9）
        const tbOffsetX = PADDING + (contentWidth - tbWidth) / 2;
        const tbOffsetY = invOffsetY + INVENTORY_ROWS * CELL_SIZE + SEPARATOR_HEIGHT;
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            const ref: SlotRef = { area: "toolbar", index: i + 1 };
            const slotContainer = this.createSlotContainer(ref);
            slotContainer.x = tbOffsetX + i * CELL_SIZE;
            slotContainer.y = tbOffsetY;
            this.container.addChild(slotContainer);
            this.tbSlotContainers.push(slotContainer);
            this.tbSlotIcons.push(createSlotIcon(slotContainer, CELL_SIZE));
        }

        // ─── 右ペイン（CraftPane）──────────────────────────────────────────────
        const rightPaneX = leftPaneWidth;
        this.craftPane.top.x = rightPaneX;
        this.craftPane.top.y = PADDING + TAB_HEIGHT;
        this.craftPane.top.visible = false; // 初期は非表示
        this.container.addChild(this.craftPane.top);

        // ─── カーソル追従コンテナ（最前面）────────────────────────────────────
        this.container.addChild(this.cursorContainer);
    }

    private createSlotContainer(ref: SlotRef): Container {
        const slot = new Container();
        slot.hitArea = new Rectangle(0, 0, CELL_SIZE, CELL_SIZE);
        slot.interactive = true;
        slot.cursor = "pointer";

        const border = new Graphics();
        border.rect(0, 0, CELL_SIZE, CELL_SIZE);
        border.stroke({ width: 2, color: 0x888888 });
        slot.addChild(border);

        slot.on("pointerdown", (event: FederatedPointerEvent) => {
            event.stopPropagation();
            if (event.button === 0) {
                this.handleLeftClick(ref, event);
            } else if (event.button === 2) {
                this.handleRightClick(ref, event);
            }
        });

        return slot;
    }

    private setCursorPosition(clientX: number, clientY: number): void {
        const local = this.container.toLocal({ x: clientX, y: clientY });
        this.cursorContainer.x = local.x - CELL_SIZE / 2;
        this.cursorContainer.y = local.y - CELL_SIZE / 2;
    }

    private handleLeftClick(ref: SlotRef, event: FederatedPointerEvent): void {
        if (!this.pickedUp) {
            const stack = this.inventory.getSlot(ref);
            if (!stack) return;
            this.inventory.setSlot(ref, null);
            this.pickedUp = { stack: { ...stack }, source: ref };
            this.setCursorPosition(event.clientX, event.clientY);
            return;
        }

        // 別スロットをクリック → 同種なら統合、異種なら入れ替え
        const targetStack = this.inventory.getSlot(ref);

        if (targetStack && targetStack.itemId === this.pickedUp.stack.itemId) {
            // ── 同種アイテム → スタック統合 ──
            const maxStack = getItemDef(this.pickedUp.stack.itemId)?.maxStack ?? 64;
            const total = targetStack.count + this.pickedUp.stack.count;

            if (total <= maxStack) {
                // 合計が上限以内 → Bスロットに全部収めて持ち上げ解除
                this.inventory.setSlot(ref, { itemId: targetStack.itemId, count: total });
                this.pickedUp = null;
            } else {
                // 合計が上限超過 → Bスロットを上限に設定し、残りを持ち上げ継続
                this.inventory.setSlot(ref, { itemId: targetStack.itemId, count: maxStack });
                this.pickedUp = {
                    stack: { itemId: this.pickedUp.stack.itemId, count: total - maxStack },
                    source: ref,
                };
                this.setCursorPosition(event.clientX, event.clientY);
            }
            return;
        }

        // ── 異なるアイテム or 空スロット → 従来の入れ替え ──
        this.inventory.setSlot(ref, this.pickedUp.stack);

        if (targetStack) {
            this.pickedUp = { stack: { ...targetStack }, source: ref };
            this.setCursorPosition(event.clientX, event.clientY);
        } else {
            this.pickedUp = null;
        }
    }

    private handleRightClick(ref: SlotRef, event: FederatedPointerEvent): void {
        if (!this.pickedUp) {
            const stack = this.inventory.getSlot(ref);
            if (!stack) return;

            // 配置可能アイテムの場合は配置モードへ遷移する
            if (isPlaceable(stack.itemId)) {
                // 副作用: インベントリからアイテムを取り出し
                if (stack.count === 1) {
                    this.inventory.setSlot(ref, null);
                } else {
                    stack.count--;
                }

                // 純粋: UIState を更新
                this.uiState.enterPlacementMode(stack.itemId, ref, getPlacementInfo(stack.itemId)?.defaultVariant ?? "horizontal");
                return;
            }

            const taken: ItemStack = { itemId: stack.itemId, count: 1 };
            if (stack.count === 1) {
                this.inventory.setSlot(ref, null);
            } else {
                stack.count--;
            }
            this.pickedUp = { stack: taken, source: ref };
            this.setCursorPosition(event.clientX, event.clientY);
            return;
        }

        // picked-up 状態で右クリック → 対象スロットに 1 個置く
        const targetStack = this.inventory.getSlot(ref);
        const maxStack = getItemDef(this.pickedUp.stack.itemId)?.maxStack ?? 64;

        if (!targetStack) {
            this.inventory.setSlot(ref, { itemId: this.pickedUp.stack.itemId, count: 1 });
        } else if (targetStack.itemId === this.pickedUp.stack.itemId && targetStack.count < maxStack) {
            targetStack.count++;
        } else {
            return; // 異なるアイテムまたはスタック満杯
        }

        this.pickedUp.stack.count--;

        if (this.pickedUp.stack.count === 0) {
            this.pickedUp = null;
        }
    }

    /** window の mousemove をリッスンしてカーソルアイコンをマウス位置に追従させる。
     *  canvas が position:fixed で画面全体を覆っているため clientX/Y == PixiJS グローバル座標。 */
    private onMouseMove(e: MouseEvent): void {
        if (!this.pickedUp) return;
        this.setCursorPosition(e.clientX, e.clientY);
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape" && this.pickedUp) {
            // ピックアップをキャンセルして元のスロットに戻す
            this.inventory.setSlot(this.pickedUp.source, this.pickedUp.stack);
            this.pickedUp = null;
        }
    }

    /** アクティブなタブを切り替え、タブボタンの見た目と CraftPane の表示を更新する。 */
    private switchTab(tab: "inventory" | "craft"): void {
        this.activeTab = tab;

        // タブボタンの背景色を更新
        this.tabBgInventory.clear();
        this.tabBgInventory.rect(0, 0, 98, 28);
        this.tabBgInventory.fill({ color: tab === "inventory" ? 0x444444 : 0x333333 });

        this.tabBgCraft.clear();
        this.tabBgCraft.rect(0, 0, 98, 28);
        this.tabBgCraft.fill({ color: tab === "craft" ? 0x444444 : 0x333333 });

        // CraftPane の表示/非表示を切り替え
        this.craftPane.top.visible = tab === "craft";
    }

    private updateWindowPosition(): void {
        this.container.x = (window.innerWidth - this.windowWidth) / 2;
        this.container.y = (window.innerHeight - this.windowHeight) / 2;
    }

    get top(): Container {
        return this.container;
    }

    /** ゲームループから毎 tick 呼ぶ。表示中のみ全スロットを状態から再描画する。 */
    tick(): void {
        const mode = this.uiState.mode;
        // mode 変化時に show/hide を呼ぶ（リスナー登録/解除のため毎 tick ではなく遷移時のみ）
        if (mode !== this.prevMode) {
            if (mode === "inventory") {
                this.show("inventory");
            } else if (mode === "craft") {
                this.show("craft", this.uiState.craftStation);
            } else if (this.prevMode === "inventory" || this.prevMode === "craft") {
                this.hide();
            }
            this.prevMode = mode;
        }
        if (!this.container.visible) return;

        for (let i = 0; i < INVENTORY_ROWS * INVENTORY_COLS; i++) {
            updateSlotIcon(this.invSlotIcons[i], this.inventory.getSlot({ area: "inventory", index: i }), CELL_SIZE);
        }
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            updateSlotIcon(this.tbSlotIcons[i], this.inventory.getSlot({ area: "toolbar", index: i + 1 }), CELL_SIZE);
        }

        if (this.pickedUp) {
            updateSlotIcon(this.cursorIcon, this.pickedUp.stack, CELL_SIZE);
            this.cursorContainer.visible = true;
        } else {
            this.cursorContainer.visible = false;
        }

        if (this.activeTab === "craft") {
            this.craftPane.tick();
        }
    }

    /** インベントリウィンドウを表示する。
     *  defaultTab でどのタブを最初に表示するかを指定できる。
     *  station はクラフトタブで使用する作業台の種類。 */
    show(defaultTab: "inventory" | "craft" = "inventory", station: CraftStation = "hand"): void {
        this.craftPane.update(station);
        this.switchTab(defaultTab);
        this.updateWindowPosition();
        this.container.visible = true;
        window.addEventListener("mousemove", this.onMouseMoveBound);
        window.addEventListener("keydown", this.onKeyDownBound);
    }

    /** インベントリウィンドウを非表示にする。 */
    hide(): void {
        this.container.visible = false;
        window.removeEventListener("mousemove", this.onMouseMoveBound);
        window.removeEventListener("keydown", this.onKeyDownBound);
        // ピックアップ状態をキャンセルして元に戻す
        if (this.pickedUp) {
            this.inventory.setSlot(this.pickedUp.source, this.pickedUp.stack);
            this.pickedUp = null;
        }
    }
}
