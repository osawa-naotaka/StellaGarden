import { Container, Graphics, Sprite } from "pixi.js";

export class Tile {
    private readonly m_top: Container;
    private readonly m_sprite: Sprite;

    constructor() {
        this.m_top = new Container();
        this.m_sprite = new Sprite();
        this.m_top.addChild(this.m_sprite);
    }

    setDebugFrame(pixelPerTile: number, color: number = 0x00ff00) {
        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(0, 0, pixelPerTile, pixelPerTile);
        hitAreaDebug.stroke({ width: 1, color });
        this.m_top.addChild(hitAreaDebug);
    }

    get top() {
        return this.m_top;
    }

    get sprite() {
        return this.m_sprite;
    }
}
