import { BitmapText, Container, Graphics, Sprite, Texture } from "pixi.js";

export class Tile {
    private readonly m_top: Container;
    private readonly m_spritesContainer: Container;
    private readonly m_sprites: Sprite[];
    private readonly m_debugYText: BitmapText;

    constructor() {
        this.m_top = new Container();
        this.m_spritesContainer = new Container();
        this.m_top.addChild(this.m_spritesContainer);
        this.m_sprites = [new Sprite()];
        this.m_spritesContainer.addChild(this.m_sprites[0]);
        this.m_debugYText = new BitmapText({ text: "", style: { fontFamily: "Roboto", fontSize: 16, fill: 0xffffff } });
        this.m_debugYText.visible = false;
        this.m_top.addChild(this.m_debugYText);
    }

    init() {
        for (const sprite of this.m_sprites) {
            sprite.texture = Texture.EMPTY;
            sprite.visible = false;
        }
        this.m_debugYText.visible = false;
    }

    setDebugYLabel(y: number, pixelPerTile: number) {
        this.m_debugYText.text = String(y);
        this.m_debugYText.x = pixelPerTile - this.m_debugYText.width - 1;
        this.m_debugYText.y = pixelPerTile - this.m_debugYText.height;
        this.m_debugYText.visible = true;
    }

    setDebugFrame(pixelPerTile: number, color: number = 0x00ff00) {
        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(0, 0, pixelPerTile, pixelPerTile);
        hitAreaDebug.stroke({ width: 1, color });
        this.m_top.addChild(hitAreaDebug);
    }

    ensureNumSprites(num: number) {
        while (this.m_sprites.length < num) {
            const sprite = new Sprite();
            this.m_sprites.push(sprite);
            this.m_spritesContainer.addChild(sprite);
        }
    }

    get top() {
        return this.m_top;
    }

    get sprites() {
        return this.m_sprites;
    }
}
