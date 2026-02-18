import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { GameState } from "../State/GameState";

const slotEntry = [
    "watering_can",
    "pickaxe",
    "axe",
    "sickle",
    "shovel",
    "potato_icon",
    null,
    null,
    null,    
];

const CELL_SIZE = 32;
const TOOLBAR_WIDTH = CELL_SIZE * slotEntry.length;
const TOOLBAR_HEIGHT = CELL_SIZE;
const ICON_SIZE = 16;

export type Toolbar = {
    parent: Container;
    toolbar: Container;
    slots: Container[];
    slotEntry: (string | null)[];
    selectedSlot: number;
    drawFunctions: ((isSelected: boolean) => void)[];
    updateToolbarPositionFn: () => void;
};

export function createToolbar(parent: Container): Toolbar {
    const toolbar = new Container();
    toolbar.x = (window.innerWidth - TOOLBAR_WIDTH) / 2;
    toolbar.y = window.innerHeight - TOOLBAR_HEIGHT - 20; // 画面下部から20pxの余白

    // 背景（半透明の黒）
    const background = new Graphics();
    background.rect(0, 0, TOOLBAR_WIDTH, TOOLBAR_HEIGHT);
    background.fill({ color: 0x000000, alpha: 0.7 });
    background.interactive = true; // 背景でイベントをキャッチ
    background.on("pointerdown", (event) => {
        event.stopPropagation(); // イベントの伝播を止める
    });
    toolbar.addChild(background);

    // 選択状態を管理
    let selectedSlot = 0;

    // 各セルを作成
    const slots: Graphics[] = [];
    const drawFunctions: ((isSelected: boolean) => void)[] = [];

    for (let i = 0; i < slotEntry.length; i++) {
        const slot = new Graphics();
        slot.x = i * CELL_SIZE;
        slot.y = 0;
        slot.interactive = true;
        slot.cursor = "pointer";

        // 当たり判定を明示的に設定（セル全体をクリック可能に）
        slot.hitArea = new Rectangle(0, 0, CELL_SIZE, CELL_SIZE);

        // 枠線を描画する関数
        const drawSlotBorder = (isSelected: boolean) => {
            slot.clear();
            slot.rect(0, 0, CELL_SIZE, CELL_SIZE);
            // 透明な塗りつぶしを追加（当たり判定のため）
            slot.fill({ color: 0x000000, alpha: 0.01 });
            slot.stroke({
                width: isSelected ? 4 : 2,
                color: 0xffffff
            });
        };

        // 描画関数を配列に保存
        drawFunctions.push(drawSlotBorder);

        // 初期描画
        drawSlotBorder(i === selectedSlot);

        const iconName = slotEntry[i];
        if (iconName) {
            const icon = new Container();
            const sprite = new Sprite(Texture.from(iconName));
            sprite.width = ICON_SIZE;
            sprite.height = ICON_SIZE;
            sprite.x = (CELL_SIZE - ICON_SIZE) / 2;
            sprite.y = (CELL_SIZE - ICON_SIZE) / 2;
            icon.addChild(sprite);
            slot.addChild(icon);
        }

        toolbar.addChild(slot);
        slots.push(slot);
    }

    const updateToolbarPositionFn = () => {
        toolbar.x = (window.innerWidth - TOOLBAR_WIDTH) / 2;
        toolbar.y = window.innerHeight - TOOLBAR_HEIGHT - 20;
    };

    parent.addChild(toolbar);

    return {
        parent,
        toolbar,
        slots,
        slotEntry,
        selectedSlot,
        drawFunctions,
        updateToolbarPositionFn
    };
}

export function registerToolbarEventHandlers(gameState: GameState) {
    for (let i = 0; i < gameState.toolbar.slots.length; i++) {
        const slot = gameState.toolbar.slots[i];
        slot.on("pointerdown", (event) => {
            event.stopPropagation(); // イベントの伝播を止める

            // 前の選択を解除
            gameState.toolbar.drawFunctions[gameState.toolbar.selectedSlot](false);

            // 新しい選択を設定
            gameState.toolbar.selectedSlot = i;
            gameState.toolbar.drawFunctions[i](true);
        });
    }
}