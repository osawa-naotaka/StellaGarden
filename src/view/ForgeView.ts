import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { IInventoryWriter, ItemStack, IVoxelWriter, SlotRef } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import type { ForgeSlotKind, ForgeStorage } from "../engine/ForgeStorage";
import type { UIMode, UIState } from "./UIState";

const CELL_SIZE = 40;
const ICON_SIZE = 32;
const PADDING = 10;
const TITLE_HEIGHT = 24;
const SEPARATOR_HEIGHT = 14;
const COLS = 8;
const ROWS = 8;
const TOOLBAR_COLS = 9;
const LABEL_WIDTH = 36;

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

type ForgeSlotArea = "inventory" | "toolbar" | "forge_ingredient" | "forge_fuel" | "forge_output";
type ForgeSlotRef = { area: ForgeSlotArea; index: number };

/**
 * 炉UI: 左にプレイヤーインベントリ+ツールバー、右に3スロット縦並び（材料・燃料・結果）を表示する。
 * UIState.mode === "forge" のとき表示し、Escape で閉じる。
 */
export class ForgeView {
    private container: Container;
    private inventory: IInventoryWriter;
    private forgeStorage: ForgeStorage;
    private voxelMap: IVoxelWriter;
    private uiState: UIState;
    private prevMode: UIMode = "normal";

    private invSlotIcons: SlotIcon[] = [];
    private tbSlotIcons: SlotIcon[] = [];
    private forgeSlotIcons: Map<ForgeSlotKind, SlotIcon> = new Map();

    private pickedUp: { stack: ItemStack; source: ForgeSlotRef } | null = null;
    private cursorContainer: Container;
    private cursorIcon: SlotIcon;

    private windowWidth: number;
    private windowHeight: number;

    private onMouseMoveBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(inventory: IInventoryWriter, forgeStorage: ForgeStorage, voxelMap: IVoxelWriter, uiState: UIState) {
        this.inventory = inventory;
        this.forgeStorage = forgeStorage;
        this.voxelMap = voxelMap;
        this.uiState = uiState;
        this.container = new Container();
        this.container.visible = false;

        const leftPaneWidth = Math.max(COLS, TOOLBAR_COLS) * CELL_SIZE + PADDING * 2;
        const rightPaneWidth = LABEL_WIDTH + CELL_SIZE + PADDING * 2;
        const totalWidth = leftPaneWidth + rightPaneWidth + PADDING;
        const contentHeight = TITLE_HEIGHT + ROWS * CELL_SIZE + SEPARATOR_HEIGHT + CELL_SIZE;
        this.windowWidth = totalWidth;
        this.windowHeight = contentHeight + PADDING * 2;

        // 背景
        const bg = new Graphics();
        bg.rect(0, 0, this.windowWidth, this.windowHeight);
        bg.fill({ color: 0x333333, alpha: 0.95 });
        bg.interactive = true;
        bg.on("pointerdown", (e: FederatedPointerEvent) => e.stopPropagation());
        this.container.addChild(bg);

        // ── 左ペイン: インベントリ ──
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

        // ── 右ペイン: 炉スロット ──
        const rightX = leftPaneWidth + PADDING;

        const forgeTitle = new BitmapText({ text: "Forge", style: { fontFamily: "Roboto", fontSize: 14, fill: 0xffffff } });
        forgeTitle.x = rightX;
        forgeTitle.y = PADDING;
        this.container.addChild(forgeTitle);

        const forgeSlotStartY = PADDING + TITLE_HEIGHT;
        const forgeSlotDefs: { kind: ForgeSlotKind; label: string; area: ForgeSlotArea }[] = [
            { kind: "ingredient", label: "材料", area: "forge_ingredient" },
            { kind: "fuel", label: "燃料", area: "forge_fuel" },
            { kind: "output", label: "結果", area: "forge_output" },
        ];

        for (let i = 0; i < forgeSlotDefs.length; i++) {
            const { kind, label, area } = forgeSlotDefs[i];
            const slotY = forgeSlotStartY + i * (CELL_SIZE + PADDING);

            const labelText = new BitmapText({ text: label, style: { fontFamily: "Roboto", fontSize: 12, fill: 0xdddddd } });
            labelText.x = rightX;
            labelText.y = slotY + (CELL_SIZE - labelText.height) / 2;
            this.container.addChild(labelText);

            const slotContainer = this.createSlotContainer(rightX + LABEL_WIDTH, slotY, { area, index: 0 });
            this.container.addChild(slotContainer);
            this.forgeSlotIcons.set(kind, createSlotIcon(slotContainer));
        }

        // カーソルアイコン
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
            if (mode === "forge") {
                this.show();
            } else if (this.prevMode === "forge") {
                this.hide();
            }
            this.prevMode = mode;
        }
        if (!this.container.visible) return;

        const forgePos = this.uiState.forgePos;
        if (!forgePos) return;

        // インベントリスロット更新
        for (let i = 0; i < ROWS * COLS; i++) {
            updateSlotIcon(this.invSlotIcons[i], this.inventory.getSlot({ area: "inventory", index: i }));
        }
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            updateSlotIcon(this.tbSlotIcons[i], this.inventory.getSlot({ area: "toolbar", index: i + 1 }));
        }

        // 炉スロット更新
        const kinds: ForgeSlotKind[] = ["ingredient", "fuel", "output"];
        for (const kind of kinds) {
            const icon = this.forgeSlotIcons.get(kind);
            if (icon) {
                updateSlotIcon(icon, this.forgeStorage.getSlot(forgePos, kind));
            }
        }

        // カーソルアイコン
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

    private createSlotContainer(x: number, y: number, ref: ForgeSlotRef): Container {
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
                this.handleLeftClick(ref, event);
            } else if (event.button === 2) {
                this.handleRightClick(ref, event);
            }
        });

        slotContainer.addChild(slotBg);
        return slotContainer;
    }

    private getSlotByRef(ref: ForgeSlotRef): ItemStack | null {
        const pos = this.uiState.forgePos;
        switch (ref.area) {
            case "forge_ingredient":
                if (!pos) return null;
                return this.forgeStorage.getSlot(pos, "ingredient");
            case "forge_fuel":
                if (!pos) return null;
                return this.forgeStorage.getSlot(pos, "fuel");
            case "forge_output":
                if (!pos) return null;
                return this.forgeStorage.getSlot(pos, "output");
            default:
                return this.inventory.getSlot(ref as SlotRef);
        }
    }

    private setSlotByRef(ref: ForgeSlotRef, stack: ItemStack | null): void {
        const pos = this.uiState.forgePos;
        switch (ref.area) {
            case "forge_ingredient":
                if (!pos) return;
                this.forgeStorage.setSlot(pos, "ingredient", stack, this.voxelMap);
                return;
            case "forge_fuel":
                if (!pos) return;
                this.forgeStorage.setSlot(pos, "fuel", stack, this.voxelMap);
                return;
            case "forge_output":
                if (!pos) return;
                this.forgeStorage.setSlot(pos, "output", stack, this.voxelMap);
                return;
            default:
                this.inventory.setSlot(ref as SlotRef, stack);
        }
    }

    /**
     * ドロップ先スロットが受け入れ可能かを判定する。
     * - forge_ingredient: "meteoric_iron" のみ許容
     * - forge_fuel: "charcoal" のみ許容
     * - forge_output: ドロップ常に不可
     * - inventory / toolbar: 常に許容
     */
    private canDropTo(ref: ForgeSlotRef, stack: ItemStack): boolean {
        switch (ref.area) {
            case "forge_ingredient":
                return stack.itemId === "meteoric_iron";
            case "forge_fuel":
                return stack.itemId === "charcoal";
            case "forge_output":
                return false;
            default:
                return true;
        }
    }

    private handleLeftClick(ref: ForgeSlotRef, event: FederatedPointerEvent): void {
        const targetStack = this.getSlotByRef(ref);

        if (!this.pickedUp) {
            // ピックアップ
            if (targetStack) {
                this.pickedUp = { stack: { ...targetStack }, source: ref };
                this.setCursorPosition(event.clientX, event.clientY);
                this.setSlotByRef(ref, null);
            }
        } else {
            // ドロップ先バリデーション
            if (!this.canDropTo(ref, this.pickedUp.stack)) return;

            if (!targetStack) {
                this.setSlotByRef(ref, this.pickedUp.stack);
                this.pickedUp = null;
            } else if (targetStack.itemId === this.pickedUp.stack.itemId) {
                // 同じアイテム: スタック
                const maxStack = getItemDef(this.pickedUp.stack.itemId)?.maxStack ?? 64;
                const canAdd = maxStack - targetStack.count;
                const adding = Math.min(canAdd, this.pickedUp.stack.count);
                targetStack.count += adding;
                this.setSlotByRef(ref, targetStack);
                this.pickedUp.stack.count -= adding;
                if (this.pickedUp.stack.count === 0) {
                    this.pickedUp = null;
                }
            } else {
                // 異なるアイテム: 交換
                this.setSlotByRef(ref, this.pickedUp.stack);
                this.pickedUp = { stack: targetStack, source: ref };
            }
        }
    }

    private handleRightClick(ref: ForgeSlotRef, event: FederatedPointerEvent): void {
        if (!this.pickedUp) {
            // 1個だけピックアップ
            const stack = this.getSlotByRef(ref);
            if (!stack) return;
            const taken: ItemStack = { itemId: stack.itemId, count: 1 };
            if (stack.count === 1) {
                this.setSlotByRef(ref, null);
            } else {
                this.setSlotByRef(ref, { itemId: stack.itemId, count: stack.count - 1 });
            }
            this.pickedUp = { stack: taken, source: ref };
            this.setCursorPosition(event.clientX, event.clientY);
        } else {
            // ドロップ先バリデーション
            if (!this.canDropTo(ref, this.pickedUp.stack)) return;

            // 1個だけドロップ
            const targetStack = this.getSlotByRef(ref);
            if (!targetStack) {
                this.setSlotByRef(ref, { itemId: this.pickedUp.stack.itemId, count: 1 });
                this.pickedUp.stack.count -= 1;
                if (this.pickedUp.stack.count === 0) this.pickedUp = null;
            } else if (targetStack.itemId === this.pickedUp.stack.itemId) {
                const maxStack = getItemDef(this.pickedUp.stack.itemId)?.maxStack ?? 64;
                if (targetStack.count < maxStack) {
                    targetStack.count += 1;
                    this.setSlotByRef(ref, targetStack);
                    this.pickedUp.stack.count -= 1;
                    if (this.pickedUp.stack.count === 0) this.pickedUp = null;
                }
            }
        }
    }

    private setCursorPosition(clientX: number, clientY: number): void {
        const bounds = this.container.getBounds();
        this.cursorContainer.x = clientX - bounds.x - CELL_SIZE / 2;
        this.cursorContainer.y = clientY - bounds.y - CELL_SIZE / 2;
    }

    private onMouseMove(e: MouseEvent): void {
        const bounds = this.container.getBounds();
        this.cursorContainer.x = e.clientX - bounds.x;
        this.cursorContainer.y = e.clientY - bounds.y;
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            this.uiState.mode = "normal";
            this.uiState.forgePos = null;
        }
    }
}
