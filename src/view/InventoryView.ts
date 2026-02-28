import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Inventory, ItemStack, SlotRef } from "../engine/Inventory";
import { ITEM_DEFS } from "../engine/ItemDefs";
import type { Toolbar } from "./Toolbar";

const CELL_SIZE = 40;
const ICON_SIZE = 32;
const PADDING = 10;
const TITLE_HEIGHT = 28;
const SEPARATOR_HEIGHT = 14;
const INVENTORY_COLS = 8;
const INVENTORY_ROWS = 8;
const TOOLBAR_COLS = 9;

/** ItemStack のアイコンを描画した Container を返す（カーソルやスロット内用）。 */
function buildItemIcon(stack: ItemStack, cellSize: number): Container {
    const icon = new Container();
    const def = ITEM_DEFS[stack.itemId];

    if (def.spriteName) {
        const sprite = new Sprite(Texture.from(def.spriteName));
        sprite.width = ICON_SIZE;
        sprite.height = ICON_SIZE;
        sprite.x = (cellSize - ICON_SIZE) / 2;
        sprite.y = (cellSize - ICON_SIZE) / 2;
        icon.addChild(sprite);
    } else {
        // 仮アイコン（Graphics）
        const g = new Graphics();
        g.rect((cellSize - ICON_SIZE) / 2, (cellSize - ICON_SIZE) / 2, ICON_SIZE, ICON_SIZE);
        g.fill({ color: def.placeholderColor ?? 0x888888 });
        icon.addChild(g);
    }

    if (stack.count >= 2) {
        const countText = new BitmapText({
            text: String(stack.count),
            style: { fontFamily: "Roboto", fontSize: 11, fill: 0xffffff },
        });
        countText.x = cellSize - countText.width - 2;
        countText.y = cellSize - 13;
        icon.addChild(countText);
    }

    return icon;
}

/** スロットコンテナのコンテンツ（インデックス 1 以降）を更新する。
 *  インデックス 0 は枠線として保持する。 */
function refreshSlotContent(slotContainer: Container, stack: ItemStack | null): void {
    while (slotContainer.children.length > 1) {
        slotContainer.removeChildAt(1);
    }
    if (stack) {
        slotContainer.addChild(buildItemIcon(stack, CELL_SIZE));
    }
}

/** Eキーで開閉できる 8×8 インベントリウィンドウ。
 *  画面中央に表示し、ウィンドウ下部にツールバースロットも表示する。
 *  スロット間のアイテム移動（左クリック全交換・右クリック1個移動）をサポートする。 */
export class InventoryView {
    private container: Container;
    private inventory: Inventory;
    private toolbar: Toolbar;

    private invSlotContainers: Container[] = [];
    private tbSlotContainers: Container[] = [];

    /** ピックアップ状態：カーソルに持っているアイテムと元スロット。 */
    private pickedUp: { stack: ItemStack; source: SlotRef } | null = null;
    /** カーソル追従アイコン用コンテナ。PickedUp 時のみ表示。 */
    private cursorContainer: Container;

    /** ウィンドウの幅・高さ（位置計算に使用）。 */
    private windowWidth: number;
    private windowHeight: number;

    private onMouseMoveBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(inventory: Inventory, toolbar: Toolbar) {
        this.inventory = inventory;
        this.toolbar = toolbar;
        this.container = new Container();
        this.container.visible = false;

        const invWidth = INVENTORY_COLS * CELL_SIZE;
        const tbWidth = TOOLBAR_COLS * CELL_SIZE;
        const contentWidth = Math.max(invWidth, tbWidth);
        const contentHeight = TITLE_HEIGHT + INVENTORY_ROWS * CELL_SIZE + SEPARATOR_HEIGHT + CELL_SIZE;
        this.windowWidth = contentWidth + PADDING * 2;
        this.windowHeight = contentHeight + PADDING * 2;

        this.cursorContainer = new Container();
        this.cursorContainer.visible = false;

        this.onMouseMoveBound = this.onMouseMove.bind(this);
        this.onKeyDownBound = this.onKeyDown.bind(this);

        this.buildUI(contentWidth);
        this.updateWindowPosition();
    }

    private buildUI(contentWidth: number): void {
        // 背景
        const bg = new Graphics();
        bg.rect(0, 0, this.windowWidth, this.windowHeight);
        bg.fill({ color: 0x2a2a2a, alpha: 0.92 });
        bg.stroke({ width: 2, color: 0x888888 });
        bg.interactive = true;
        bg.on("pointerdown", (e) => e.stopPropagation());
        this.container.addChild(bg);

        // タイトル
        const title = new BitmapText({
            text: "Inventory",
            style: { fontFamily: "Roboto", fontSize: 20, fill: 0xdddddd },
        });
        title.x = PADDING;
        title.y = PADDING;
        this.container.addChild(title);

        const invWidth = INVENTORY_COLS * CELL_SIZE;
        const tbWidth = TOOLBAR_COLS * CELL_SIZE;
        const invOffsetX = PADDING + (contentWidth - invWidth) / 2;
        const invOffsetY = PADDING + TITLE_HEIGHT;

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
            }
        }

        // 区切り線
        const sepY = invOffsetY + INVENTORY_ROWS * CELL_SIZE + SEPARATOR_HEIGHT / 2;
        const separator = new Graphics();
        separator.moveTo(PADDING, sepY);
        separator.lineTo(PADDING + contentWidth, sepY);
        separator.stroke({ width: 1, color: 0x888888, alpha: 0.7 });
        this.container.addChild(separator);

        // ツールバー部分（9スロット）
        const tbOffsetX = PADDING + (contentWidth - tbWidth) / 2;
        const tbOffsetY = invOffsetY + INVENTORY_ROWS * CELL_SIZE + SEPARATOR_HEIGHT;
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            const ref: SlotRef = { area: "toolbar", index: i };
            const slotContainer = this.createSlotContainer(ref);
            slotContainer.x = tbOffsetX + i * CELL_SIZE;
            slotContainer.y = tbOffsetY;
            this.container.addChild(slotContainer);
            this.tbSlotContainers.push(slotContainer);
        }

        // カーソル追従コンテナ（最前面）
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
                this.handleLeftClick(ref);
            } else if (event.button === 2) {
                this.handleRightClick(ref);
            }
        });

        return slot;
    }

    private getSlotContainer(ref: SlotRef): Container | null {
        if (ref.area === "inventory") return this.invSlotContainers[ref.index] ?? null;
        return this.tbSlotContainers[ref.index] ?? null;
    }

    private refreshSlotByRef(ref: SlotRef): void {
        const container = this.getSlotContainer(ref);
        if (container) {
            refreshSlotContent(container, this.inventory.getSlot(ref));
        }
        if (ref.area === "toolbar") {
            this.toolbar.refreshSlot(ref.index);
        }
    }

    private refreshAll(): void {
        for (let i = 0; i < INVENTORY_ROWS * INVENTORY_COLS; i++) {
            const ref: SlotRef = { area: "inventory", index: i };
            refreshSlotContent(this.invSlotContainers[i], this.inventory.getSlot(ref));
        }
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            const ref: SlotRef = { area: "toolbar", index: i };
            refreshSlotContent(this.tbSlotContainers[i], this.inventory.getSlot(ref));
        }
    }

    private handleLeftClick(ref: SlotRef): void {
        if (!this.pickedUp) {
            const stack = this.inventory.getSlot(ref);
            if (!stack) return;
            // スタックをスロットから取り出してカーソルに持つ
            this.inventory.setSlot(ref, null);
            this.pickedUp = { stack: { ...stack }, source: ref };
            this.refreshSlotByRef(ref);
            this.showCursorIcon();
            return;
        }

        // 同じスロットを再クリック → 元に戻す
        if (ref.area === this.pickedUp.source.area && ref.index === this.pickedUp.source.index) {
            this.inventory.setSlot(ref, this.pickedUp.stack);
            this.pickedUp = null;
            this.refreshSlotByRef(ref);
            this.hideCursorIcon();
            return;
        }

        // 別スロットをクリック → 入れ替え
        const targetStack = this.inventory.getSlot(ref);
        const prevSource = this.pickedUp.source;
        this.inventory.setSlot(ref, this.pickedUp.stack);
        this.refreshSlotByRef(ref);

        if (targetStack) {
            // 持ち替え（picked-up を更新）
            this.pickedUp = { stack: { ...targetStack }, source: ref };
            this.showCursorIcon();
        } else {
            this.pickedUp = null;
            this.hideCursorIcon();
        }

        this.refreshSlotByRef(prevSource);
    }

    private handleRightClick(ref: SlotRef): void {
        if (!this.pickedUp) {
            // スロットから 1 個取り出してカーソルに持つ
            const stack = this.inventory.getSlot(ref);
            if (!stack) return;

            const taken: ItemStack = { itemId: stack.itemId, count: 1 };
            if (stack.count === 1) {
                this.inventory.setSlot(ref, null);
            } else {
                stack.count--;
            }
            this.pickedUp = { stack: taken, source: ref };
            this.refreshSlotByRef(ref);
            this.showCursorIcon();
            return;
        }

        // picked-up 状態で右クリック → 対象スロットに 1 個置く
        const targetStack = this.inventory.getSlot(ref);
        const maxStack = ITEM_DEFS[this.pickedUp.stack.itemId].maxStack;

        if (!targetStack) {
            this.inventory.setSlot(ref, { itemId: this.pickedUp.stack.itemId, count: 1 });
        } else if (targetStack.itemId === this.pickedUp.stack.itemId && targetStack.count < maxStack) {
            targetStack.count++;
        } else {
            return; // 異なるアイテムまたはスタック満杯
        }

        this.pickedUp.stack.count--;
        this.refreshSlotByRef(ref);

        if (this.pickedUp.stack.count === 0) {
            this.pickedUp = null;
            this.hideCursorIcon();
        } else {
            this.showCursorIcon();
        }
    }

    private showCursorIcon(): void {
        if (!this.pickedUp) return;
        this.cursorContainer.removeChildren();
        this.cursorContainer.addChild(buildItemIcon(this.pickedUp.stack, CELL_SIZE));
        this.cursorContainer.visible = true;
    }

    private hideCursorIcon(): void {
        this.cursorContainer.visible = false;
        this.cursorContainer.removeChildren();
    }

    /** window の mousemove をリッスンしてカーソルアイコンをマウス位置に追従させる。
     *  canvas が position:fixed で画面全体を覆っているため clientX/Y == PixiJS グローバル座標。 */
    private onMouseMove(e: MouseEvent): void {
        if (!this.pickedUp) return;
        const local = this.container.toLocal({ x: e.clientX, y: e.clientY });
        this.cursorContainer.x = local.x - CELL_SIZE / 2;
        this.cursorContainer.y = local.y - CELL_SIZE / 2;
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape" && this.pickedUp) {
            // ピックアップをキャンセルして元のスロットに戻す
            this.inventory.setSlot(this.pickedUp.source, this.pickedUp.stack);
            this.refreshSlotByRef(this.pickedUp.source);
            this.pickedUp = null;
            this.hideCursorIcon();
        }
    }

    private updateWindowPosition(): void {
        this.container.x = (window.innerWidth - this.windowWidth) / 2;
        this.container.y = (window.innerHeight - this.windowHeight) / 2;
    }

    /** スプライトが利用可能になった後に呼ぶ。全スロットのアイコンを初期描画する。 */
    initializeSprites(): void {
        this.refreshAll();
    }

    get top(): Container {
        return this.container;
    }

    /** インベントリウィンドウを表示する。開くたびに全スロットを最新状態で再描画する。 */
    show(): void {
        this.updateWindowPosition();
        this.refreshAll();
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
            this.refreshSlotByRef(this.pickedUp.source);
            this.pickedUp = null;
            this.hideCursorIcon();
        }
    }
}
