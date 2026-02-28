import { BitmapText, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Inventory, ItemStack } from "../engine/Inventory";
import { ITEM_DEFS } from "../engine/ItemDefs";

const CELL_SIZE = 40;
const TOOLBAR_HEIGHT = CELL_SIZE;
const ICON_SIZE = 32;

function createItemIcon(stack: ItemStack): Container {
    const icon = new Container();
    const def = ITEM_DEFS[stack.itemId];

    if (def.spriteName) {
        const sprite = new Sprite(Texture.from(def.spriteName));
        sprite.width = ICON_SIZE;
        sprite.height = ICON_SIZE;
        sprite.x = (CELL_SIZE - ICON_SIZE) / 2;
        sprite.y = (CELL_SIZE - ICON_SIZE) / 2;
        icon.addChild(sprite);
    } else {
        // 仮アイコン（Graphics）
        const g = new Graphics();
        g.rect((CELL_SIZE - ICON_SIZE) / 2, (CELL_SIZE - ICON_SIZE) / 2, ICON_SIZE, ICON_SIZE);
        g.fill({ color: def.placeholderColor ?? 0x888888 });
        icon.addChild(g);
    }

    // スタック数（2個以上の場合のみ表示）
    if (stack.count >= 2) {
        const countText = new BitmapText({
            text: String(stack.count),
            style: { fontFamily: "Roboto", fontSize: 10, fill: 0xffffff },
        });
        countText.x = CELL_SIZE - countText.width - 2;
        countText.y = CELL_SIZE - 12;
        icon.addChild(countText);
    }

    return icon;
}

export class Toolbar {
    private inventory: Inventory;
    private toolbar: Container;
    private slots: Container[];
    private selectedBorder: Graphics;
    private updateToolbarPositionFn: () => void;
    private toolbarWidth: number;

    constructor(inventory: Inventory) {
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

        slot.on("pointerdown", (event) => {
            event.stopPropagation();
            this.inventory.selectSlot(index);
            this.selectedBorder.x = index * CELL_SIZE;
        });

        return slot;
    }

    get top() {
        return this.toolbar;
    }

    /** スプライトが利用可能になった後に呼ぶ。全スロットのアイコンを初期描画する。 */
    initializeSprites() {
        for (let i = 0; i < this.inventory.toolbarSlots.length; i++) {
            this.refreshSlot(i);
        }
    }

    /** 指定スロットのアイコン表示を更新する。アイテム変化後に呼ぶ。 */
    refreshSlot(index: number): void {
        const slot = this.slots[index];
        if (!slot) return;

        // インデックス 0 は枠線（保持）、以降のコンテンツを削除して再描画
        while (slot.children.length > 1) {
            slot.removeChildAt(1);
        }

        const stack = this.inventory.toolbarSlots[index];
        if (stack) {
            slot.addChild(createItemIcon(stack));
        }
    }

    /** 全ツールバースロットのアイコン表示を更新する。 */
    refreshAll(): void {
        for (let i = 0; i < this.inventory.toolbarSlots.length; i++) {
            this.refreshSlot(i);
        }
    }

    get updateToolbarPosition() {
        return this.updateToolbarPositionFn;
    }
}
