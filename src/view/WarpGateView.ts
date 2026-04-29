import { BitmapText, Container, type FederatedPointerEvent, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { IInventoryWriter, IReputationSystemReader, ItemStack, SlotRef, TierProgress } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import type { WarpGateStorage } from "../engine/WarpGateStorage";
import type { UIMode, UIState } from "./UIState";

const CELL_SIZE = 60;
const ICON_SIZE = 48;
const PADDING = 20;
const TITLE_HEIGHT = 40;
const SEPARATOR_HEIGHT = 14;
const COLS = 8;
const INV_ROWS = 8;
const EARTH_INV_ROWS = 4;
const TOOLBAR_COLS = 9;

const TIER_HEADER_HEIGHT = 48;
const TIER_ROW_HEIGHT = 60;
const TIER_ICON_SIZE = 48;
const TIER_BAR_HEIGHT = 24;

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
 * Tier 進行表示の1行ぶんの構成要素。tick で内容を書き換えるためにプール化する。
 */
interface TierRowEntry {
    container: Container;
    statusMark: BitmapText;
    label: BitmapText;
    iconSprite: Sprite;
    iconGraphics: Graphics;
    detailText: BitmapText;
    progressBg: Graphics;
    progressFill: Graphics;
}

function createTierRowEntry(): TierRowEntry {
    const container = new Container();

    const statusMark = new BitmapText({
        text: "",
        style: { fontFamily: "Roboto", fontSize: 28, fill: 0xffffff },
    });
    statusMark.x = 0;
    statusMark.y = 4;
    container.addChild(statusMark);

    const label = new BitmapText({
        text: "",
        style: { fontFamily: "Roboto", fontSize: 24, fill: 0xdddddd },
    });
    label.x = 24;
    label.y = 4;
    container.addChild(label);

    const iconSprite = new Sprite();
    iconSprite.width = TIER_ICON_SIZE;
    iconSprite.height = TIER_ICON_SIZE;
    iconSprite.x = 100;
    iconSprite.y = 0;
    iconSprite.visible = false;
    container.addChild(iconSprite);

    const iconGraphics = new Graphics();
    iconGraphics.x = 100;
    iconGraphics.y = 0;
    iconGraphics.visible = false;
    container.addChild(iconGraphics);

    const detailText = new BitmapText({
        text: "",
        style: { fontFamily: "Roboto", fontSize: 24, fill: 0xcccccc },
    });
    detailText.x = 100 + TIER_ICON_SIZE + 6;
    detailText.y = 4;
    container.addChild(detailText);

    const progressBg = new Graphics();
    progressBg.x = 100 + TIER_ICON_SIZE + 6;
    progressBg.y = TIER_ICON_SIZE - TIER_BAR_HEIGHT;
    progressBg.visible = false;
    container.addChild(progressBg);

    const progressFill = new Graphics();
    progressFill.x = 100 + TIER_ICON_SIZE + 6;
    progressFill.y = TIER_ICON_SIZE - TIER_BAR_HEIGHT;
    progressFill.visible = false;
    container.addChild(progressFill);

    return { container, statusMark, label, iconSprite, iconGraphics, detailText, progressBg, progressFill };
}

function updateTierRowEntry(entry: TierRowEntry, progress: TierProgress, columnWidth: number): void {
    const { tier, status, cumulativeShipped, threshold } = progress;

    let mark: string;
    let markColor: number;
    let labelColor: number;
    let detailColor: number;
    let iconAlpha: number;
    if (status === "unlocked") {
        mark = "✓";
        markColor = 0x88dd88;
        labelColor = 0xffffff;
        detailColor = 0xaaaaaa;
        iconAlpha = 1.0;
    } else if (status === "in_progress") {
        mark = "▶";
        markColor = 0xffdd88;
        labelColor = 0xffffff;
        detailColor = 0xeeddaa;
        iconAlpha = 1.0;
    } else {
        mark = "🔒";
        markColor = 0x888888;
        labelColor = 0x999999;
        detailColor = 0x999999;
        iconAlpha = 0.4;
    }

    entry.statusMark.text = mark;
    entry.statusMark.style.fill = markColor;

    entry.label.text = `${tier.label}${tier.isGoal ? " ★" : ""}`;
    entry.label.style.fill = labelColor;

    const def = getItemDef(tier.itemId);
    if (def?.spriteName) {
        entry.iconSprite.texture = Texture.from(def.spriteName);
        entry.iconSprite.alpha = iconAlpha;
        entry.iconSprite.visible = true;
        entry.iconGraphics.visible = false;
    } else if (def) {
        entry.iconGraphics.clear();
        entry.iconGraphics.rect(0, 0, TIER_ICON_SIZE, TIER_ICON_SIZE);
        entry.iconGraphics.fill({ color: def.placeholderColor ?? 0x888888, alpha: iconAlpha });
        entry.iconGraphics.visible = true;
        entry.iconSprite.visible = false;
    }

    // 詳細表示: 解放済 = "出荷済 N個"、進行中 = 進捗バーのみ、未解放 = "X 出荷でアンロック"
    const detailX = 78 + TIER_ICON_SIZE + 6;
    const detailWidth = columnWidth - detailX;

    if (status === "unlocked") {
        // 解放済: この Tier の品目自体の出荷実績は今は表示しない（無いと長くなるため）
        entry.detailText.text = tier.unlock === null ? "released" : `released (${cumulativeShipped} shippment)`;
        entry.detailText.style.fill = detailColor;
        entry.detailText.visible = true;
        entry.progressBg.visible = false;
        entry.progressFill.visible = false;
    } else if (status === "in_progress") {
        const barWidth = Math.min(detailWidth, 120);
        const ratio = threshold > 0 ? Math.min(1, cumulativeShipped / threshold) : 0;
        entry.progressBg.clear();
        entry.progressBg.rect(0, 0, barWidth, TIER_BAR_HEIGHT);
        entry.progressBg.fill({ color: 0x444444 });
        entry.progressBg.visible = true;
        entry.progressFill.clear();
        entry.progressFill.rect(0, 0, Math.max(1, barWidth * ratio), TIER_BAR_HEIGHT);
        entry.progressFill.fill({ color: 0xffdd88 });
        entry.progressFill.visible = true;

        entry.detailText.text = `${cumulativeShipped}/${threshold}`;
        entry.detailText.style.fill = detailColor;
        entry.detailText.y = 0;
        entry.detailText.visible = true;
    } else {
        const sourceItemDef = tier.unlock ? getItemDef(tier.unlock.sourceItemId) : null;
        const sourceLabel = sourceItemDef?.itemId ?? "?";
        entry.detailText.text = tier.unlock ? `${sourceLabel} unlock until ${tier.unlock.threshold}` : "";
        entry.detailText.style.fill = detailColor;
        entry.detailText.y = 4;
        entry.detailText.visible = true;
        entry.progressBg.visible = false;
        entry.progressFill.visible = false;
    }
}

/**
 * warp gate UI:
 * - 左にプレイヤーインベントリ + ツールバー
 * - 右上に現在の評価値と出荷プレビュー
 * - 右中に地球側インベントリ（4×8 に縮小）
 * - 右下に Tier アンロック進行表示
 */
export class WarpGateView {
    private container: Container;
    private inventory: IInventoryWriter;
    private warpGateStorage: WarpGateStorage;
    private reputationSystem: IReputationSystemReader;
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
    private tierRows: TierRowEntry[] = [];

    private onMouseMoveBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(inventory: IInventoryWriter, warpGateStorage: WarpGateStorage, reputationSystem: IReputationSystemReader, uiState: UIState) {
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
        const rightInventoryHeight = TITLE_HEIGHT + EARTH_INV_ROWS * CELL_SIZE;

        // Tier 表示の高さ: TIER_DEFS の displayRow ごとに1行ぶんの高さ
        const allTierProgress = reputationSystem.getAllTierProgress();
        const maxDisplayRow = allTierProgress.reduce((max, p) => Math.max(max, p.tier.displayRow), 0);
        const tierRowCount = maxDisplayRow + 1;
        const tierAreaHeight = TIER_HEADER_HEIGHT + tierRowCount * TIER_ROW_HEIGHT;

        const rightSideHeight = rightInfoHeight + SEPARATOR_HEIGHT + rightInventoryHeight + SEPARATOR_HEIGHT + tierAreaHeight;
        const leftSideHeight = TITLE_HEIGHT + INV_ROWS * CELL_SIZE + SEPARATOR_HEIGHT + CELL_SIZE;

        const contentHeight = Math.max(leftSideHeight, rightSideHeight);
        this.windowWidth = totalWidth;
        this.windowHeight = contentHeight + PADDING * 2;

        const bg = new Graphics();
        bg.rect(0, 0, this.windowWidth, this.windowHeight);
        bg.fill({ color: 0x333333, alpha: 0.95 });
        bg.interactive = true;
        bg.on("pointerdown", (e: FederatedPointerEvent) => e.stopPropagation());
        this.container.addChild(bg);

        const leftX = PADDING;
        const leftTitle = new BitmapText({ text: "Inventory", style: { fontFamily: "Roboto", fontSize: 24, fill: 0xffffff } });
        leftTitle.x = leftX;
        leftTitle.y = PADDING;
        this.container.addChild(leftTitle);

        const invY = PADDING + TITLE_HEIGHT;
        for (let row = 0; row < INV_ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const idx = row * COLS + col;
                const slotContainer = this.createSlotContainer(leftX + col * CELL_SIZE, invY + row * CELL_SIZE, { area: "inventory", index: idx });
                this.container.addChild(slotContainer);
                this.invSlotIcons.push(createSlotIcon(slotContainer));
            }
        }

        const tbY = invY + INV_ROWS * CELL_SIZE + SEPARATOR_HEIGHT;
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            const slotContainer = this.createSlotContainer(leftX + i * CELL_SIZE, tbY, { area: "toolbar", index: i + 1 });
            this.container.addChild(slotContainer);
            this.tbSlotIcons.push(createSlotIcon(slotContainer));
        }

        const rightX = leftPaneWidth + PADDING;

        const reputationTitle = new BitmapText({ text: "Reputation", style: { fontFamily: "Roboto", fontSize: 24, fill: 0xffffff } });
        reputationTitle.x = rightX;
        reputationTitle.y = PADDING;
        this.container.addChild(reputationTitle);

        this.reputationValueText = new BitmapText({
            text: "0 pt",
            style: { fontFamily: "Roboto", fontSize: 48, fill: 0xffdd88 },
        });
        this.reputationValueText.x = rightX;
        this.reputationValueText.y = PADDING + 22;
        this.container.addChild(this.reputationValueText);

        this.shipmentPreviewText = new BitmapText({
            text: "Shipment: +0 pt",
            style: { fontFamily: "Roboto", fontSize: 24, fill: 0xdddddd },
        });
        this.shipmentPreviewText.x = rightX;
        this.shipmentPreviewText.y = PADDING + 150;
        this.container.addChild(this.shipmentPreviewText);

        const gateTitleY = PADDING + rightInfoHeight + SEPARATOR_HEIGHT;
        const gateTitle = new BitmapText({ text: "Earth Inventory", style: { fontFamily: "Roboto", fontSize: 24, fill: 0xffffff } });
        gateTitle.x = rightX;
        gateTitle.y = gateTitleY;
        this.container.addChild(gateTitle);

        const gateY = gateTitleY + TITLE_HEIGHT;
        for (let row = 0; row < EARTH_INV_ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const idx = row * COLS + col;
                const slotContainer = this.createSlotContainer(rightX + col * CELL_SIZE, gateY + row * CELL_SIZE, { area: "warp_gate", index: idx });
                this.container.addChild(slotContainer);
                this.warpGateSlotIcons.push(createSlotIcon(slotContainer));
            }
        }

        // ─── Tier 進行表示 ─────────────────────────────────────────────
        const tierY = gateTitleY + TITLE_HEIGHT + EARTH_INV_ROWS * CELL_SIZE + SEPARATOR_HEIGHT;
        const tierTitle = new BitmapText({ text: "Tier Progression", style: { fontFamily: "Roboto", fontSize: 24, fill: 0xffffff } });
        tierTitle.x = rightX;
        tierTitle.y = tierY;
        this.container.addChild(tierTitle);

        // displayRow ごとに 1〜2 個の Tier を横並びに配置する
        const tierAreaWidth = COLS * CELL_SIZE;
        const halfWidth = Math.floor(tierAreaWidth / 2);
        const rowsByDisplayRow: TierProgress[][] = [];
        for (const progress of allTierProgress) {
            const r = progress.tier.displayRow;
            if (!rowsByDisplayRow[r]) rowsByDisplayRow[r] = [];
            rowsByDisplayRow[r].push(progress);
        }

        for (let r = 0; r < tierRowCount; r++) {
            const rowProgress = rowsByDisplayRow[r] ?? [];
            const isPair = rowProgress.length >= 2;
            for (let c = 0; c < rowProgress.length; c++) {
                const entry = createTierRowEntry();
                entry.container.x = rightX + c * (isPair ? halfWidth : 0);
                entry.container.y = tierY + TIER_HEADER_HEIGHT + r * TIER_ROW_HEIGHT;
                this.container.addChild(entry.container);
                this.tierRows.push(entry);
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

        for (let i = 0; i < INV_ROWS * COLS; i++) {
            updateSlotIcon(this.invSlotIcons[i], this.inventory.getSlot({ area: "inventory", index: i }));
        }
        for (let i = 0; i < TOOLBAR_COLS; i++) {
            updateSlotIcon(this.tbSlotIcons[i], this.inventory.getSlot({ area: "toolbar", index: i + 1 }));
        }
        for (let i = 0; i < EARTH_INV_ROWS * COLS; i++) {
            updateSlotIcon(this.warpGateSlotIcons[i], this.warpGateStorage.getSlot(i));
        }

        this.reputationValueText.text = `${this.reputationSystem.getPoints()} pt`;
        this.shipmentPreviewText.text = `Shipment: +${this.calculateShipmentPreviewPoints()} pt`;

        const allTierProgress = this.reputationSystem.getAllTierProgress();
        const tierAreaWidth = COLS * CELL_SIZE;
        const halfWidth = Math.floor(tierAreaWidth / 2);

        // tierRows の生成順は createコンストラクタで displayRow 昇順 + 並行 Tier の順なので
        // allTierProgress の順序と一致する想定
        for (let i = 0; i < this.tierRows.length && i < allTierProgress.length; i++) {
            const progress = allTierProgress[i];
            const sameRow = allTierProgress.filter((p) => p.tier.displayRow === progress.tier.displayRow);
            const columnWidth = sameRow.length >= 2 ? halfWidth : tierAreaWidth;
            updateTierRowEntry(this.tierRows[i], progress, columnWidth);
        }

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
