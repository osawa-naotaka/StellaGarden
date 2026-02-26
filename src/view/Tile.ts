import { Container, Graphics, Sprite, Texture } from "pixi.js";

export class Tile {
    private readonly m_top: Container;
    private readonly m_sprites: Sprite[];

    constructor() {
        this.m_top = new Container();
        this.m_sprites = [new Sprite()];
        this.m_top.addChild(this.m_sprites[0]);
    }

    init() {
        for (const sprite of this.m_sprites) {
            sprite.texture = Texture.EMPTY;
            sprite.visible = false;
        }
    }

    setDebugFrame(pixelPerTile: number, color: number = 0x00ff00) {
        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(0, 0, pixelPerTile, pixelPerTile);
        hitAreaDebug.stroke({ width: 1, color });
        this.m_top.addChild(hitAreaDebug);
    }

    useNSprites(num: number) {
        while (this.m_sprites.length < num) {
            const sprite = new Sprite();
            this.m_sprites.push(sprite);
            this.m_top.addChild(sprite);
        }
    }

    get top() {
        return this.m_top;
    }

    get sprites() {
        return this.m_sprites;
    }
}
