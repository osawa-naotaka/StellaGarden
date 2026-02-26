import { type Application, Container, Graphics, RenderTexture, type Texture } from "pixi.js";
import type { GameState } from "../model/GameState";
import { Tile } from "../view/Tile";
import type { Pos2D, Pos3D, VoxelMap } from "./VoxelMap";

export const CHUNK_RENDER_MARGIN = 2; // チャンクのタイル数に対して、ビューポート端で部分的に見えるタイルを考慮して余分に描画するタイル数

export class ChunkRenderer {
    private app: Application;
    private pixelPerTile: number;
    private tilePerChunk: number;
    private numRenderTextures: number;

    private renderTexturePool: RenderTexture[] = [];
    private voxelPool: number[] = [];
    private surfacePosPool: Pos3D[] = [];
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
        const edgeLen = this.tilePerChunk + 2 * CHUNK_RENDER_MARGIN; // チャンク内のタイル数 + ビューポート端で部分的に見えるタイル数
        for (let i = 0; i < edgeLen * edgeLen; i++) {
            const tile = new Tile();
            tile.setDebugFrame(this.pixelPerTile, 0x0000ff);
            this.chunkContainer.addChild(tile.top);
            this.tilePool.push(tile);
        }

        const voxelPoolSize = (edgeLen + 2) * (edgeLen + 2); // タイル数 + チャンク描画時に参照する周囲のタイル数
        this.voxelPool = new Array(voxelPoolSize).fill(0);
        this.surfacePosPool = new Array(voxelPoolSize).fill({ x: 0, y: 0, z: 0 });

        for (let i = 0; i < this.numRenderTextures; i++) {
            const renderTexture = RenderTexture.create({
                width: this.tilePerChunk * this.pixelPerTile,
                height: this.tilePerChunk * this.pixelPerTile,
            });
            this.renderTexturePool.push(renderTexture);
        }

        // debug frame for chunk boundary
        const chunkFrameDebug = new Graphics();
        chunkFrameDebug.rect(0, 0, this.pixelPerTile * this.tilePerChunk, this.pixelPerTile * this.tilePerChunk);
        chunkFrameDebug.stroke({ width: 2, color: 0xff0000 });
        this.chunkContainer.addChild(chunkFrameDebug);
    }

    renderChunk(
        gameState: GameState,
        voxelMap: VoxelMap,
        world: Pos2D,
        renderTextureIndex: number,
        setupSpriteFn: (gameState: GameState, tile: Tile, voxel: number[], position: Pos3D[]) => void,
    ): Texture {
        this.resetTilePoolVisibility();
        const renderTexture = this.renderTexturePool[renderTextureIndex];

        // チャンク内のタイルは、CHUNK_RENDER_MARGINタイル分の余白を持たせて描画する（ビューポート端のタイルが一部分だけ見えるケースに対応するため）
        for (let col = -CHUNK_RENDER_MARGIN-1; col < this.tilePerChunk + CHUNK_RENDER_MARGIN+1; col++) {
            for (let row = -CHUNK_RENDER_MARGIN-1; row < this.tilePerChunk + CHUNK_RENDER_MARGIN+1; row++) {
                const x = Math.floor(world.x) + row;
                const z = Math.floor(world.z) + col;

                const position = voxelMap.getSurfacePosition({ x, y: 0, z });
                const voxel = voxelMap.get(position);
                this.voxelPool[this.voxelPoolPositionToIndex(row, col)] = voxel;
                this.surfacePosPool[this.voxelPoolPositionToIndex(row, col)] = position;
            }
        }

        const voxelBuf = new Array(3 * 3);
        const surfacePosBuf = new Array(3 * 3);

        for (let col = -CHUNK_RENDER_MARGIN; col < this.tilePerChunk + CHUNK_RENDER_MARGIN; col++) {
            for (let row = -CHUNK_RENDER_MARGIN; row < this.tilePerChunk + CHUNK_RENDER_MARGIN; row++) {
                const tile = this.tilePool[this.tilePositionToIndex(row, col)];
                tile.sprites[0].visible = true;
                tile.top.x = row * this.pixelPerTile - (world.x % 1) * this.pixelPerTile;
                tile.top.y = col * this.pixelPerTile - (world.z % 1) * this.pixelPerTile;

                for (let y = -1; y <= 1; y++) {
                    for (let x = -1; x <= 1; x++) {
                        const checkX = row + x;
                        const checkZ = col + y;
                        surfacePosBuf[(y + 1) * 3 + (x + 1)] = this.surfacePosPool[this.voxelPoolPositionToIndex(checkX, checkZ)];
                        voxelBuf[(y + 1) * 3 + (x + 1)] = this.voxelPool[this.voxelPoolPositionToIndex(checkX, checkZ)];
                    }
                }
                setupSpriteFn(gameState, tile, voxelBuf, surfacePosBuf);
            }
        }

        this.app.renderer.render({ container: this.chunkContainer, target: renderTexture, clear: true });
        return renderTexture;
    }

    private resetTilePoolVisibility() {
        for (const tile of this.tilePool) {
            tile.init();
        }
    }

    private voxelPoolPositionToIndex(row: number, col: number): number {
        return (col + CHUNK_RENDER_MARGIN + 1) * (this.tilePerChunk + 2 * CHUNK_RENDER_MARGIN + 2) + (row + CHUNK_RENDER_MARGIN + 1);
    }

    private tilePositionToIndex(row: number, col: number): number {
        // rowとcolは-CHUNK_RENDER_MARGIN-1からTILE_PER_CHUNK + CHUNK_RENDER_MARGIN+1までの範囲を取るため、インデックスに変換する際に+CHUNK_RENDER_MARGIN+1して0から始まるようにする
        return (col + CHUNK_RENDER_MARGIN) * (this.tilePerChunk + 2 * CHUNK_RENDER_MARGIN) + (row + CHUNK_RENDER_MARGIN);
    }
}
