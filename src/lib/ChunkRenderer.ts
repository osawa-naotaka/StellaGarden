import { type Application, ColorMatrixFilter, Container, RenderTexture, type Texture } from "pixi.js";
import { Tile } from "./Tile";
import type { Pos2D, Pos3D, VoxelMap } from "./VoxelMap";

export class ChunkRenderer {
    private app: Application;
    private pixelPerTile: number;
    private tilePerChunk: number;
    private numRenderTextures: number;

    private renderTexturePool: RenderTexture[] = [];
    private tilePool: Tile[] = [];
    private chunkContainer: Container;

    constructor(app: Application, opt: { pixelPerTile?: number; tilePerChunk?: number; numRenderTextures?: number }) {
        this.app = app;
        this.pixelPerTile = opt.pixelPerTile || 16;
        this.tilePerChunk = opt.tilePerChunk || 16;
        this.numRenderTextures = opt.numRenderTextures || 16;
        this.chunkContainer = new Container();

        this.initializePool();
    }

    private initializePool() {
        for (let i = 0; i < (this.tilePerChunk + 2) * (this.tilePerChunk + 2); i++) {
            const tile = new Tile();
            tile.setDebugFrame(this.pixelPerTile);
            this.tilePool.push(tile);
        }

        for (let i = 0; i < this.numRenderTextures; i++) {
            const renderTexture = RenderTexture.create({
                width: this.tilePerChunk * this.pixelPerTile,
                height: this.tilePerChunk * this.pixelPerTile,
            });
            this.renderTexturePool.push(renderTexture);
        }
    }

    renderChunk(voxelMap: VoxelMap, world: Pos2D, renderTextureIndex: number, setupSpriteFn: (tile: Tile, voxel: number, position: Pos3D) => void): Texture {
        this.resetTilePoolVisibility();
        const renderTexture = this.renderTexturePool[renderTextureIndex];

        // チャンク内のタイルは、1タイル分の余白を持たせて描画する（ビューポート端のタイルが一部分だけ見えるケースに対応するため）
        for (let col = -1; col < this.tilePerChunk + 1; col++) {
            for (let row = -1; row < this.tilePerChunk + 1; row++) {
                const x = Math.floor(world.x) + row;
                const z = Math.floor(world.z) + col;

                const position = voxelMap.getSurfacePosition({ x, y: 0, z });
                const voxel = voxelMap.get(position);

                const tile = this.tilePool[this.tilePositionToIndex(row, col)];
                tile.sprite.visible = true;

                tile.top.x = row * this.pixelPerTile - (world.x % 1) * this.pixelPerTile;
                tile.top.y = col * this.pixelPerTile - (world.z % 1) * this.pixelPerTile;

                setupSpriteFn(tile, voxel, position);
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

                this.chunkContainer.addChild(tile.top);
            }
        }

        this.app.renderer.render({ container: this.chunkContainer, target: renderTexture, clear: true });
        return renderTexture;
    }

    private resetTilePoolVisibility() {
        for (const tile of this.tilePool) {
            tile.sprite.visible = false;
        }
    }

    private tilePositionToIndex(row: number, col: number): number {
        // rowとcolは-1からTILE_PER_CHUNKまでの範囲を取るため、インデックスに変換する際に+1して0から始まるようにする
        return (col + 1) * (this.tilePerChunk + 2) + (row + 1);
    }
}
