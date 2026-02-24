import { BitmapText } from "pixi.js";
import type { GameState } from "../State/GameState";

export class DebugText {
    private textObject: BitmapText;
    private gameState: GameState;

    constructor(gameState: GameState) {
        this.gameState = gameState;
        this.textObject = new BitmapText({
            text: this.getText(),
            style: {
                fontFamily: "RobotoBold",
                fontSize: 16,
                fill: 0xffffff,
            },
        });
        this.textObject.x = 10;
        this.textObject.y = 10;
    }

    get textView() {
        return this.textObject;
    }

    update() {
        this.textObject.text = this.getText();
    }

    private getText() {
        return `X: ${this.gameState.player.playerPositionInWorld.x.toFixed(1)}, Z: ${this.gameState.player.playerPositionInWorld.z.toFixed(1)}\nZoom: ${this.gameState.player.zoomLevel.toFixed(2)}\nPointer: (${this.gameState.player.pointerPositionInWorld.x.toFixed(1)}, ${this.gameState.player.pointerPositionInWorld.z.toFixed(1)})`;
    }
}
