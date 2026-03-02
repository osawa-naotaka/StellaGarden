import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { IInventoryWriter, ItemStack, SlotRef } from "../_boundary/interfaces";
import { ITEM_DEFS } from "../engine/ItemDefs";

const CELL_SIZE = 40;
const ICON_SIZE = 32;
const PADDING = 10;
const TITLE_HEIGHT = 28;
const SEPARATOR_HEIGHT = 14;
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

    const def = ITEM_DEFS[stack.itemId];
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
        style: { fontFamily: "Roboto", fontSize: 11, fill: 0xffffff },
    });
    countText.y = cellSize - 13;
    countText.visible = false;
    container.addChild(countText);

    return { sprite, graphics, countText };
}

/** Eキーで開閉できる 8×8 インベントリウィンドウ。
 *  画面中央に表示し、ウィンドウ下部にツールバースロットも表示する。
 *  スロット間のアイテム移動（左クリック全交換・右クリック1個移動）をサポートする。 */
export class InventoryView {
    private container: Container;
    private inventory: IInventoryWriter;

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

    private onMouseMoveBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(inventory: IInventoryWriter) {
        this.inventory = inventory;
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
        this.cursorIcon = createSlotIcon(this.cursorContainer, CELL_SIZE);

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

        // 同じスロットを再クリック → 元に戻す
        if (ref.area === this.pickedUp.source.area && ref.index === this.pickedUp.source.index) {
            this.inventory.setSlot(ref, this.pickedUp.stack);
            this.pickedUp = null;
            return;
        }

        // 別スロットをクリック → 入れ替え
        const targetStack = this.inventory.getSlot(ref);
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
        const maxStack = ITEM_DEFS[this.pickedUp.stack.itemId].maxStack;

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

    private updateWindowPosition(): void {
        this.container.x = (window.innerWidth - this.windowWidth) / 2;
        this.container.y = (window.innerHeight - this.windowHeight) / 2;
    }

    get top(): Container {
        return this.container;
    }

    /** ゲームループから毎 tick 呼ぶ。表示中のみ全スロットを状態から再描画する。 */
    tick(): void {
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
    }

    /** インベントリウィンドウを表示する。 */
    show(): void {
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
