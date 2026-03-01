import { BitmapText, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { IInventoryWriter, ItemStack } from "../_boundary/interfaces";
import { ITEM_DEFS } from "../engine/ItemDefs";

const CELL_SIZE = 40;
const TOOLBAR_HEIGHT = CELL_SIZE;
const ICON_SIZE = 32;

/** スロットに事前確保した表示オブジェクト群。tick ごとに内容を上書きして使い回す。 */
interface SlotIcon {
    sprite: Sprite;
    graphics: Graphics;
    countText: BitmapText;
}

/** SlotIcon の内容を現在の ItemStack に合わせて更新する（アロケーションなし）。 */
function updateSlotIcon(icon: SlotIcon, stack: ItemStack | null): void {
    if (!stack) {
        icon.sprite.visible = false;
        icon.graphics.visible = false;
        icon.countText.visible = false;
        return;
    }

    const def = ITEM_DEFS[stack.itemId];
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

export class Toolbar {
    private inventory: IInventoryWriter;
    private toolbar: Container;
    private slots: Container[];
    private slotIcons: SlotIcon[] = [];
    private selectedBorder: Graphics;
    private updateToolbarPositionFn: () => void;
    private toolbarWidth: number;

    constructor(inventory: IInventoryWriter) {
        this.inventory = inventory;
        this.toolbarWidth = CELL_SIZE * inventory.toolbarSlots.length;
        this.toolbar = this.createToolbarContainer();

        this.selectedBorder = new Graphics();
        this.selectedBorder.rect(0, 0, CELL_SIZE, CELL_SIZE);
        this.selectedBorder.visible = true;
        this.selectedBorder.stroke({
            width: 4,
            color: 0xffffff,
        });
        this.toolbar.addChild(this.selectedBorder);

        // 各セルを作成
        this.slots = [];

        for (let i = 0; i < this.inventory.toolbarSlots.length; i++) {
            const slot = this.createSlot(i);
            this.toolbar.addChild(slot);
            this.slots.push(slot);
        }

        this.updateToolbarPositionFn = () => {
            this.toolbar.x = (window.innerWidth - this.toolbarWidth) / 2;
            this.toolbar.y = window.innerHeight - TOOLBAR_HEIGHT - 20;
        };
    }

    private createToolbarContainer(): Container {
        const toolbar = new Container();
        toolbar.x = (window.innerWidth - this.toolbarWidth) / 2;
        toolbar.y = window.innerHeight - TOOLBAR_HEIGHT - 20;

        const background = new Graphics();
        background.rect(0, 0, this.toolbarWidth, TOOLBAR_HEIGHT);
        background.fill({ color: 0x000000, alpha: 0.7 });
        background.interactive = true;
        background.on("pointerdown", (event) => {
            event.stopPropagation();
        });
        toolbar.addChild(background);

        return toolbar;
    }

    private createSlot(index: number): Container {
        const slot = new Container();
        slot.x = index * CELL_SIZE;
        slot.y = 0;
        slot.interactive = true;
        slot.cursor = "pointer";

        slot.hitArea = new Rectangle(0, 0, CELL_SIZE, CELL_SIZE);

        const slotBorder = new Graphics();
        slotBorder.rect(0, 0, CELL_SIZE, CELL_SIZE);
        slotBorder.stroke({
            width: 2,
            color: 0xffffff,
        });
        slot.addChild(slotBorder);

        // アイコン表示オブジェクトを事前確保
        const offset = (CELL_SIZE - ICON_SIZE) / 2;

        const sprite = new Sprite();
        sprite.width = ICON_SIZE;
        sprite.height = ICON_SIZE;
        sprite.x = offset;
        sprite.y = offset;
        sprite.visible = false;
        slot.addChild(sprite);

        const graphics = new Graphics();
        graphics.visible = false;
        slot.addChild(graphics);

        const countText = new BitmapText({
            text: "0",
            style: { fontFamily: "Roboto", fontSize: 10, fill: 0xffffff },
        });
        countText.y = CELL_SIZE - 12;
        countText.visible = false;
        slot.addChild(countText);

        this.slotIcons.push({ sprite, graphics, countText });

        slot.on("pointerdown", (event) => {
            event.stopPropagation();
            this.inventory.selectSlot(index);
        });

        return slot;
    }

    get top() {
        return this.toolbar;
    }

    /** ゲームループから毎 tick 呼ぶ。全スロットを状態から再描画する。 */
    tick(): void {
        this.selectedBorder.x = this.inventory.selectedIndex * CELL_SIZE;

        for (let i = 0; i < this.inventory.toolbarSlots.length; i++) {
            updateSlotIcon(this.slotIcons[i], this.inventory.toolbarSlots[i] ?? null);
        }
    }

    get updateToolbarPosition() {
        return this.updateToolbarPositionFn;
    }
}
