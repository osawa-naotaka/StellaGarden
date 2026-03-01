import { BitmapText } from "pixi.js";
import type { IPlayerStateReader } from "../_boundary/interfaces";

export class DebugText {
    private textObject: BitmapText;
    private playerState: IPlayerStateReader;

    constructor(playerState: IPlayerStateReader) {
        this.playerState = playerState;
        this.textObject = new BitmapText({
            text: this.getText(),
            style: {
                fontFamily: "Roboto",
                fontSize: 32,
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
        return `X: ${this.playerState.posInWorld.x.toFixed(1)}, Z: ${this.playerState.posInWorld.z.toFixed(1)}\nZoom: ${this.playerState.zoomLevel.toFixed(2)}\nPointer: (${this.playerState.pointerPosInWorld.x.toFixed(1)}, ${this.playerState.pointerPosInWorld.z.toFixed(1)})`;
    }
}
