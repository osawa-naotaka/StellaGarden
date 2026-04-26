import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { IInventoryWriter, ItemStack, SlotRef } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import type { ReputationSystem } from "../engine/ReputationSystem";
import type { WarpGateStorage } from "../engine/WarpGateStorage";
import type { UIMode, UIState } from "./UIState";

const CELL_SIZE = 60;
const ICON_SIZE = 48;
const PADDING = 10;
const TITLE_HEIGHT = 24;
const SEPARATOR_HEIGHT = 14;
const COLS = 8;
const ROWS = 8;
const TOOLBAR_COLS = 9;

interface SlotIcon {
    sprite: Sprite;
    graphics: Graphics;
    countText: BitmapText;
}

function updateSlotIcon(icon: SlotIcon, stack: ItemStack | null): void {
    if (!stack) {
        icon.sprite.visible = false;
        icon.graphics.visible = false;
        icon.countText.visible = false;
        return;
    }
    const def = getItemDef(stack.itemId);
    if (!def) return;
    const offset = (CELL_SIZE - ICON_SIZE) / 2;

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
        icon.countText.x = CELL_SIZE - icon.countText.width - 2;
        icon.countText.visible = true;
    } else {
        icon.countText.visible = false;
    }
}

function createSlotIcon(container: Container): SlotIcon {
    const offset = (CELL_SIZE - ICON_SIZE) / 2;

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
    countText.y = CELL_SIZE - 13;
    countText.visible = false;
    container.addChild(countText);

    return { sprite, graphics, countText };
}

type WarpGateSlotArea = "inventory" | "toolbar" | "warp_gate";
type WarpGateSlotRef = { area: WarpGateSlotArea; index: number };

/**
 * warp gate UI:
 * - 左にプレイヤーインベントリ + ツールバー
 * - 右上に現在の評価値
 * - 右下に地球側インベントリ
 */
export class WarpGateView {
    private container: Container;
    private inventory: IInventoryWriter;
    private warpGateStorage: WarpGateStorage;
    private reputationSystem: ReputationSystem;
    private uiState: UIState;
    private prevMode: UIMode = "normal";

    private invSlotIcons: SlotIcon[] = [];
    private tbSlotIcons: SlotIcon[] = [];
    private warpGateSlotIcons: SlotIcon[] = [];

    private pickedUp: { stack: ItemStack; source: WarpGateSlotRef } | null = null;
    private cursorContainer: Container;
    private cursorIcon: SlotIcon;

    private windowWidth: number;
    private windowHeight: number;

    private reputationValueText: BitmapText;
    private shipmentPreviewText: BitmapText;

    private onMouseMoveBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(inventory: IInventoryWriter, warpGateStorage: WarpGateStorage, reputationSystem: ReputationSystem, uiState: UIState) {
        this.inventory = inventory;
        this.warpGateStorage = warpGateStorage;
        this.reputationSystem = reputationSystem;
        this.uiState = uiState;
        this.container = new Container();
        this.container.visible = false;

        const leftPaneWidth = Math.max(COLS, TOOLBAR_COLS) * CELL_SIZE + PADDING * 2;
        const rightPaneWidth = COLS * CELL_SIZE + PADDING * 2;
        const totalWidth = leftPaneWidth + rightPaneWidth + PADDING;
        const rightInfoHeight = TITLE_HEIGHT + 64;
        const rightInventoryHeight = TITLE_HEIGHT + ROWS * CELL_SIZE;
        const contentHeight = Math.max(
            TITLE_HEIGHT + ROWS * CELL_SIZE + SEPARATOR_HEIGHT + CELL_SIZE,
            rightInfoHeight + SEPARATOR_HEIGHT + rightInventoryHeight,
        );
        this.windowWidth = totalWidth;
        this.windowHeight = contentHeight + PADDING * 2;

        const bg = new Graphics();
        bg.rect(0, 0, this.windowWidth, this.windowHeight);
        bg.fill({ color: 0x333333, alpha: 0.95 });
        bg.interactive = true;
        bg.on("pointerdown", (e: FederatedPointerEvent) => e.stopPropagation());
        this.container.addChild(bg);

        const leftX = PADDING;
        const leftTitle = new BitmapText({ text: "Inventory", style: { fontFamily: "Roboto", fontSize: 14, fill: 0xffffff } });
        leftTitle.x = leftX;
        leftTitle.y = PADDING;
        this.container.addChild(leftTitle);

        const invY = PADDING + TITLE_HEIGHT;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const idx = row * COLS + col;
                const slotContainer = this.createSlotContainer(leftX + col * CELL_SIZE, invY + row * CELL_SIZE, { area: "inventory", index: idx });
                this.container.addChild(slotContainer);
                this.invSlotIcons.push(createSlotIcon(slotContainer));
            }
        }

        const tbY = invY + ROWS * CELL_SIZE + SEPARATOR_HEIGHT;
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            const slotContainer = this.createSlotContainer(leftX + i * CELL_SIZE, tbY, { area: "toolbar", index: i + 1 });
            this.container.addChild(slotContainer);
            this.tbSlotIcons.push(createSlotIcon(slotContainer));
        }

        const rightX = leftPaneWidth + PADDING;

        const reputationTitle = new BitmapText({ text: "Reputation", style: { fontFamily: "Roboto", fontSize: 14, fill: 0xffffff } });
        reputationTitle.x = rightX;
        reputationTitle.y = PADDING;
        this.container.addChild(reputationTitle);

        this.reputationValueText = new BitmapText({
            text: "0 pt",
            style: { fontFamily: "Roboto", fontSize: 22, fill: 0xffdd88 },
        });
        this.reputationValueText.x = rightX;
        this.reputationValueText.y = PADDING + 22;
        this.container.addChild(this.reputationValueText);

        this.shipmentPreviewText = new BitmapText({
            text: "Shipment: +0 pt",
            style: { fontFamily: "Roboto", fontSize: 12, fill: 0xdddddd },
        });
        this.shipmentPreviewText.x = rightX;
        this.shipmentPreviewText.y = PADDING + 50;
        this.container.addChild(this.shipmentPreviewText);

        const gateTitleY = PADDING + rightInfoHeight + SEPARATOR_HEIGHT;
        const gateTitle = new BitmapText({ text: "Earth Inventory", style: { fontFamily: "Roboto", fontSize: 14, fill: 0xffffff } });
        gateTitle.x = rightX;
        gateTitle.y = gateTitleY;
        this.container.addChild(gateTitle);

        const gateY = gateTitleY + TITLE_HEIGHT;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const idx = row * COLS + col;
                const slotContainer = this.createSlotContainer(rightX + col * CELL_SIZE, gateY + row * CELL_SIZE, { area: "warp_gate", index: idx });
                this.container.addChild(slotContainer);
                this.warpGateSlotIcons.push(createSlotIcon(slotContainer));
            }
        }

        this.cursorContainer = new Container();
        this.cursorContainer.visible = false;
        this.cursorIcon = createSlotIcon(this.cursorContainer);
        this.container.addChild(this.cursorContainer);

        this.onMouseMoveBound = this.onMouseMove.bind(this);
        this.onKeyDownBound = this.onKeyDown.bind(this);
    }

    get top(): Container {
        return this.container;
    }

    tick(): void {
        const mode = this.uiState.mode;
        if (mode !== this.prevMode) {
            if (mode === "warp_gate") {
                this.show();
            } else if (this.prevMode === "warp_gate") {
                this.hide();
            }
            this.prevMode = mode;
        }
        if (!this.container.visible) return;

        for (let i = 0; i < ROWS * COLS; i++) {
            updateSlotIcon(this.invSlotIcons[i], this.inventory.getSlot({ area: "inventory", index: i }));
        }
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            updateSlotIcon(this.tbSlotIcons[i], this.inventory.getSlot({ area: "toolbar", index: i + 1 }));
        }
        for (let i = 0; i < ROWS * COLS; i++) {
            updateSlotIcon(this.warpGateSlotIcons[i], this.warpGateStorage.getSlot(i));
        }

        this.reputationValueText.text = `${this.reputationSystem.getPoints()} pt`;
        this.shipmentPreviewText.text = `Shipment: +${this.calculateShipmentPreviewPoints()} pt`;

        if (this.pickedUp) {
            updateSlotIcon(this.cursorIcon, this.pickedUp.stack);
            this.cursorContainer.visible = true;
        } else {
            this.cursorContainer.visible = false;
        }
    }

    private show(): void {
        this.container.x = (window.innerWidth - this.windowWidth) / 2;
        this.container.y = (window.innerHeight - this.windowHeight) / 2;
        this.container.visible = true;
        window.addEventListener("mousemove", this.onMouseMoveBound);
        window.addEventListener("keydown", this.onKeyDownBound);
    }

    private hide(): void {
        this.container.visible = false;
        window.removeEventListener("mousemove", this.onMouseMoveBound);
        window.removeEventListener("keydown", this.onKeyDownBound);
        if (this.pickedUp) {
            this.setSlotByRef(this.pickedUp.source, this.pickedUp.stack);
            this.pickedUp = null;
        }
    }

    private createSlotContainer(x: number, y: number, ref: WarpGateSlotRef): Container {
        const slotContainer = new Container();
        slotContainer.x = x;
        slotContainer.y = y;

        const slotBg = new Graphics();
        slotBg.rect(0, 0, CELL_SIZE, CELL_SIZE);
        slotBg.fill({ color: 0x555555 });
        slotBg.stroke({ width: 1, color: 0x888888 });
        slotBg.interactive = true;
        slotBg.hitArea = new Rectangle(0, 0, CELL_SIZE, CELL_SIZE);

        slotBg.on("pointerdown", (event: FederatedPointerEvent) => {
            event.stopPropagation();
            if (event.button === 0) {
                this.handleLeftClick(ref);
            } else if (event.button === 2) {
                this.handleRightClick(ref);
            }
        });

        slotContainer.addChild(slotBg);
        return slotContainer;
    }

    private getSlotByRef(ref: WarpGateSlotRef): ItemStack | null {
        if (ref.area === "warp_gate") {
            return this.warpGateStorage.getSlot(ref.index);
        }
        return this.inventory.getSlot(ref as SlotRef);
    }

    private setSlotByRef(ref: WarpGateSlotRef, stack: ItemStack | null): void {
        if (ref.area === "warp_gate") {
            this.warpGateStorage.setSlot(ref.index, stack);
            return;
        }
        this.inventory.setSlot(ref as SlotRef, stack);
    }

    private handleLeftClick(ref: WarpGateSlotRef): void {
        const targetStack = this.getSlotByRef(ref);

        if (!this.pickedUp) {
            if (targetStack) {
                this.pickedUp = { stack: { ...targetStack }, source: ref };
                this.setSlotByRef(ref, null);
            }
            return;
        }

        if (!targetStack) {
            this.setSlotByRef(ref, this.pickedUp.stack);
            this.pickedUp = null;
            return;
        }

        if (targetStack.itemId === this.pickedUp.stack.itemId) {
            const maxStack = getItemDef(this.pickedUp.stack.itemId)?.maxStack ?? 64;
            const canAdd = maxStack - targetStack.count;
            const adding = Math.min(canAdd, this.pickedUp.stack.count);
            targetStack.count += adding;
            this.setSlotByRef(ref, targetStack);
            this.pickedUp.stack.count -= adding;
            if (this.pickedUp.stack.count === 0) {
                this.pickedUp = null;
            }
            return;
        }

        this.setSlotByRef(ref, this.pickedUp.stack);
        this.pickedUp = { stack: targetStack, source: ref };
    }

    private handleRightClick(ref: WarpGateSlotRef): void {
        if (!this.pickedUp) {
            const stack = this.getSlotByRef(ref);
            if (!stack) return;

            const taken: ItemStack = { itemId: stack.itemId, count: 1 };
            if (stack.count === 1) {
                this.setSlotByRef(ref, null);
            } else {
                this.setSlotByRef(ref, { itemId: stack.itemId, count: stack.count - 1 });
            }
            this.pickedUp = { stack: taken, source: ref };
            return;
        }

        const targetStack = this.getSlotByRef(ref);
        if (!targetStack) {
            this.setSlotByRef(ref, { itemId: this.pickedUp.stack.itemId, count: 1 });
            this.pickedUp.stack.count -= 1;
            if (this.pickedUp.stack.count === 0) this.pickedUp = null;
            return;
        }

        if (targetStack.itemId === this.pickedUp.stack.itemId) {
            const maxStack = getItemDef(this.pickedUp.stack.itemId)?.maxStack ?? 64;
            if (targetStack.count < maxStack) {
                targetStack.count += 1;
                this.setSlotByRef(ref, targetStack);
                this.pickedUp.stack.count -= 1;
                if (this.pickedUp.stack.count === 0) this.pickedUp = null;
            }
        }
    }

    private calculateShipmentPreviewPoints(): number {
        let total = 0;
        const slots = this.warpGateStorage.getSlots();
        for (const stack of slots) {
            if (!stack) continue;
            total += this.reputationSystem.calculateStackPoints(stack.itemId, stack.count);
        }
        return total;
    }

    private onMouseMove(e: MouseEvent): void {
        const bounds = this.container.getBounds();
        this.cursorContainer.x = e.clientX - bounds.x;
        this.cursorContainer.y = e.clientY - bounds.y;
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            this.uiState.mode = "normal";
            this.uiState.warpGatePos = null;
        }
    }
}
