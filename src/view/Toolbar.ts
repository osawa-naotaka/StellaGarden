import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Player } from "../model/Player";

const CELL_SIZE = 32;
const TOOLBAR_HEIGHT = CELL_SIZE;
const ICON_SIZE = 16;

export class Toolbar {
    private player: Player;
    private toolbar: Container;
    private slots: Container[];
    private selectedBorder: Graphics;
    private updateToolbarPositionFn: () => void;
    private toolbarWidth: number;

    constructor(player: Player) {
        this.player = player;
        this.toolbarWidth = CELL_SIZE * player.toolbar.length;
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

        for (let i = 0; i < this.player.toolbar.length; i++) {
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
        toolbar.y = window.innerHeight - TOOLBAR_HEIGHT - 20; // 画面下部から20pxの余白

        // 背景（半透明の黒）
        const background = new Graphics();
        background.rect(0, 0, this.toolbarWidth, TOOLBAR_HEIGHT);
        background.fill({ color: 0x000000, alpha: 0.7 });
        background.interactive = true; // 背景でイベントをキャッチ
        background.on("pointerdown", (event) => {
            event.stopPropagation(); // イベントの伝播を止める
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

        // 当たり判定を明示的に設定（セル全体をクリック可能に）
        slot.hitArea = new Rectangle(0, 0, CELL_SIZE, CELL_SIZE);

        // 枠線を描画する関数
        const slotBorder = new Graphics();
        slotBorder.rect(0, 0, CELL_SIZE, CELL_SIZE);
        slotBorder.stroke({
            width: 2,
            color: 0xffffff,
        });
        slot.addChild(slotBorder);

        slot.on("pointerdown", (event) => {
            event.stopPropagation(); // イベントの伝播を止める
            this.player.selectToolbarSlot(index);
            this.selectedBorder.x = index * CELL_SIZE;
        });

        return slot;
    }

    get top() {
        return this.toolbar;
    }

    initializeSprites() {
        for (let i = 0; i < this.player.toolbar.length; i++) {
            const iconName = this.player.toolbar[i];
            if (iconName) {
                const slot = this.slots[i];
                const sprite = new Sprite(Texture.from(iconName));
                sprite.width = ICON_SIZE;
                sprite.height = ICON_SIZE;
                sprite.x = (CELL_SIZE - ICON_SIZE) / 2;
                sprite.y = (CELL_SIZE - ICON_SIZE) / 2;
                slot.addChild(sprite);
            }
        }
    }

    get updateToolbarPosition() {
        return this.updateToolbarPositionFn;
    }
}
