import { Sprite, Application, Container, Texture, ColorMatrixFilter, RenderTexture, Graphics } from "pixi.js";
import type { Pos2D, Pos3D, VoxelMap } from "./VoxelMap";


export class ChunkRenderer {
    private app: Application;
    private pixelPerTile: number;
    private tilePerChunk: number;
    private numRenderTextures: number;

    private renderTexturePool: RenderTexture[] = [];
    private tileSpritePool: Sprite[] = [];
    private tileContainerPool: Container[] = [];
    private chunkContainer: Container;

    constructor(app: Application, opt: { pixelPerTile?: number, tilePerChunk?: number, numRenderTextures?: number }) {
        this.app = app;
        this.pixelPerTile = opt.pixelPerTile || 16;
        this.tilePerChunk = opt.tilePerChunk || 16;
        this.numRenderTextures = opt.numRenderTextures || 16;
        this.chunkContainer = new Container();

        this.initializePool();
    }

    private initializePool() {
        for (let i = 0; i < (this.tilePerChunk + 2) * (this.tilePerChunk + 2); i++) {
            const sprite = new Sprite(Texture.EMPTY);
            const container = new Container();
            container.addChild(sprite);

            const hitAreaDebug = new Graphics();
            hitAreaDebug.rect(0, 0, this.pixelPerTile, this.pixelPerTile);
            hitAreaDebug.stroke({ width: 1, color: 0x0000ff });
            container.addChild(hitAreaDebug);

            this.tileSpritePool.push(sprite);
            this.tileContainerPool.push(container);
        }

        for (let i = 0; i < this.numRenderTextures; i++) {
            const renderTexture = RenderTexture.create({
                width: this.tilePerChunk * this.pixelPerTile,
                height: this.tilePerChunk * this.pixelPerTile,
            });
            this.renderTexturePool.push(renderTexture);
        }
    }

    renderChunk(voxelMap: VoxelMap, world: Pos2D, renderTextureIndex: number, setupSpriteFn: (sprite: Sprite, container: Container, voxel: number, position: Pos3D) => void): Texture {
        this.resetTilePoolVisibility();
        const renderTexture = this.renderTexturePool[renderTextureIndex];
        
        // チャンク内のタイルは、1タイル分の余白を持たせて描画する（ビューポート端のタイルが一部分だけ見えるケースに対応するため）
        for (let col = -1; col < this.tilePerChunk + 1; col++) {
            for (let row = -1; row < this.tilePerChunk + 1; row++) {
                const x = Math.floor(world.x) + row;
                const z = Math.floor(world.z) + col;

                const position = voxelMap.getSurfacePosition({ x, y: 0, z });
                const voxel = voxelMap.get(position);

                const sprite = this.tileSpritePool[this.tilePositionToIndex(row, col)];
                sprite.visible = true;

                const container = this.tileContainerPool[this.tilePositionToIndex(row, col)];
                container.x = row * this.pixelPerTile - (world.x % 1) * this.pixelPerTile;
                container.y = col * this.pixelPerTile - (world.z % 1) * this.pixelPerTile;

                setupSpriteFn(sprite, container, voxel, position);
                /*
                const spriteName = getTerrainSpriteNameFromVoxel(voxel, position);
                const sprite = this.tileSpritePool[this.tilePositionToIndex(row, col)];
                sprite.texture = Texture.from(spriteName);
                sprite.visible = true;

                if (this.isMouseOverTile(x, z)) {
                    const filter = new ColorMatrixFilter();
                    filter.brightness(1.5, false);
                    sprite.filters = [filter];
                } else {
                    sprite.filters = [];
                }
                    */


                this.chunkContainer.addChild(container);
            }
        }

        this.app.renderer.render({ container: this.chunkContainer, target: renderTexture, clear: true });
        return renderTexture;
    }

    private resetTilePoolVisibility() {
        for (const sprite of this.tileSpritePool) {
            sprite.visible = false;
        }
    }

    private tilePositionToIndex(row: number, col: number): number {
        // rowとcolは-1からTILE_PER_CHUNKまでの範囲を取るため、インデックスに変換する際に+1して0から始まるようにする
        return (col + 1) * (this.tilePerChunk + 2) + (row + 1);
    }    
}