import { type Application, Container, Graphics, RenderTexture, type Texture } from "pixi.js";
import type { IVoxelReader, Pos2D, Pos3D } from "../_boundary/interfaces";
import { Tile } from "../view/Tile";
import { DEBUG } from "./debugFlag";

export const CHUNK_RENDER_MARGIN = 2;

/** チャンクの各タイルにスプライトを設定するコールバック型。
 *  neighborVoxels / neighborPositions は 3x3 の近傍データ（中心 = インデックス4）。 */
export type SetupTileFn = (tile: Tile, neighborVoxels: bigint[], neighborPositions: Pos3D[]) => void;

export class ChunkRenderer {
    private readonly app: Application;
    private readonly pixelPerTile: number;
    private readonly tilePerChunk: number;

    private readonly renderTexturePool: RenderTexture[] = [];
    private readonly tilePool: Tile[] = [];
    private readonly chunkContainer: Container;

    // ボクセル参照テーブル（近傍参照のため描画範囲より広く確保）
    private readonly voxelLookup: bigint[];
    private readonly positionLookup: Pos3D[];

    // 各タイルの 3x3 近傍バッファ（renderChunk 内で使い回すためクラスフィールドに置く）
    private readonly neighborVoxels = new Array<bigint>(9);
    private readonly neighborPositions = new Array<Pos3D>(9);

    // lookupIndex / tileIndex で使うストライドをキャッシュ
    private readonly lookupStride: number;
    private readonly tileStride: number;

    constructor(app: Application, opt: { pixelPerTile?: number; tilePerChunk?: number; numRenderTextures?: number }) {
        this.app = app;
        this.pixelPerTile = opt.pixelPerTile ?? 16;
        this.tilePerChunk = opt.tilePerChunk ?? 16;
        const numRenderTextures = opt.numRenderTextures ?? 16;

        this.chunkContainer = new Container();

        // drawEdge: マージン込みの描画範囲の辺のタイル数
        const drawEdge = this.tilePerChunk + 2 * CHUNK_RENDER_MARGIN;
        // lookupEdge: 近傍参照のためにさらに各辺 1 タイル拡張した参照テーブルの辺のタイル数
        const lookupEdge = drawEdge + 2;

        this.tileStride = drawEdge;
        this.lookupStride = lookupEdge;

        for (let i = 0; i < drawEdge * drawEdge; i++) {
            const tile = new Tile();
            if (DEBUG) tile.setDebugFrame(this.pixelPerTile, 0x0000ff);
            this.chunkContainer.addChild(tile.top);
            this.tilePool.push(tile);
        }

        this.voxelLookup = new Array(lookupEdge * lookupEdge).fill(0);
        this.positionLookup = new Array(lookupEdge * lookupEdge).fill({ x: 0, y: 0, z: 0 });

        for (let i = 0; i < numRenderTextures; i++) {
            this.renderTexturePool.push(
                RenderTexture.create({
                    width: this.tilePerChunk * this.pixelPerTile,
                    height: this.tilePerChunk * this.pixelPerTile,
                }),
            );
        }

        // デバッグ用チャンク境界線
        const debugFrame = new Graphics();
        debugFrame.rect(0, 0, this.pixelPerTile * this.tilePerChunk, this.pixelPerTile * this.tilePerChunk);
        debugFrame.stroke({ width: 2, color: 0xff0000 });
        if (DEBUG) this.chunkContainer.addChild(debugFrame);
    }

    /**
     * RenderTexture プールの容量を確保する。
     * count が現在のプール数以下なら何もしない。不足分のみ追加する。
     */
    ensureCapacity(count: number): void {
        while (this.renderTexturePool.length < count) {
            this.renderTexturePool.push(
                RenderTexture.create({
                    width: this.tilePerChunk * this.pixelPerTile,
                    height: this.tilePerChunk * this.pixelPerTile,
                }),
            );
        }
    }

    /**
     * チャンク 1 枚を RenderTexture に描画して返す。
     * @param voxelMap ボクセルデータ
     * @param world チャンク左上のワールド座標（タイル単位、小数可）
     * @param renderTextureIndex 使用する RenderTexture のインデックス
     * @param setupTile タイルのスプライトを設定するコールバック
     */
    renderChunk(voxelMap: IVoxelReader, world: Pos2D, renderTextureIndex: number, setupTile: SetupTileFn): Texture {
        this.clearTiles();
        const renderTexture = this.renderTexturePool[renderTextureIndex];

        // Step 1: ボクセル参照テーブルを構築
        // 描画範囲より 1 タイル広い範囲を取得して、端タイルの近傍参照に備える
        for (let col = -CHUNK_RENDER_MARGIN - 1; col < this.tilePerChunk + CHUNK_RENDER_MARGIN + 1; col++) {
            for (let row = -CHUNK_RENDER_MARGIN - 1; row < this.tilePerChunk + CHUNK_RENDER_MARGIN + 1; row++) {
                const worldPos = { x: Math.floor(world.x) + row, y: 0, z: Math.floor(world.z) + col };
                const surfacePos = voxelMap.getSurfacePosition(worldPos);
                const groundPos = voxelMap.getGroundSurfacePosition(worldPos);
                const idx = this.lookupIndex(row, col);
                this.positionLookup[idx] = groundPos;
                this.voxelLookup[idx] = voxelMap.get(surfacePos);
            }
        }

        // Step 2: 各タイルの位置を設定し、コールバックでスプライトを構成する
        for (let col = -CHUNK_RENDER_MARGIN; col < this.tilePerChunk + CHUNK_RENDER_MARGIN; col++) {
            for (let row = -CHUNK_RENDER_MARGIN; row < this.tilePerChunk + CHUNK_RENDER_MARGIN; row++) {
                const tile = this.tilePool[this.tileIndex(row, col)];
                tile.top.x = row * this.pixelPerTile - (world.x % 1) * this.pixelPerTile;
                tile.top.y = col * this.pixelPerTile - (world.z % 1) * this.pixelPerTile;

                // 3x3 近傍のボクセル情報をバッファに詰める（中心 = インデックス 4）
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ni = (dy + 1) * 3 + (dx + 1);
                        const li = this.lookupIndex(row + dx, col + dy);
                        this.neighborVoxels[ni] = this.voxelLookup[li];
                        this.neighborPositions[ni] = this.positionLookup[li];
                    }
                }

                setupTile(tile, this.neighborVoxels, this.neighborPositions);
            }
        }

        // Step 3: chunkContainer を RenderTexture に焼き付ける
        this.app.renderer.render({ container: this.chunkContainer, target: renderTexture, clear: true });
        return renderTexture;
    }

    private clearTiles() {
        for (const tile of this.tilePool) {
            tile.init();
        }
    }

    /** ボクセル参照テーブル用インデックス（lookupEdge × lookupEdge の行列） */
    private lookupIndex(row: number, col: number): number {
        return (col + CHUNK_RENDER_MARGIN + 1) * this.lookupStride + (row + CHUNK_RENDER_MARGIN + 1);
    }

    /** タイルプール用インデックス（drawEdge × drawEdge の行列） */
    private tileIndex(row: number, col: number): number {
        return (col + CHUNK_RENDER_MARGIN) * this.tileStride + (row + CHUNK_RENDER_MARGIN);
    }
}
