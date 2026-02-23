import { type Application, Container, Sprite, Texture } from "pixi.js";
import { getTerrainSpriteNameFromVoxel } from "../Entity/Terrain";
import { ChunkRenderer } from "../lib/ChunkRenderer";
import type { Tile } from "../lib/Tile";
import type { Pos2D, Pos3D, VoxelMap } from "../lib/VoxelMap";

export const PIXEL_PER_TILE = 16; // タイル1枚のサイズ（ピクセル）。スプライトのサイズと一致させる必要がある。
export const TILE_PER_CHUNK = 16; // チャンクのタイル数
export const CHUNK_PER_VIEWPORT = 4;
export const TILE_PER_VIEWPORT = TILE_PER_CHUNK * CHUNK_PER_VIEWPORT; // ビューポートのタイル数（横・縦）

export class TopViewMap {
    private voxelMap: VoxelMap;
    private parent: Container;
    private terrainPlane: Container;

    private chunkRenderer: ChunkRenderer;

    private chunkSpritePool: Sprite[]; // チャンクごとのスプライトリスト

    // 現在のビューポート起点（ワールド座標）
    private viewOrigin: Pos2D;
    private viewportInitialized = false;

    constructor(voxelMap: VoxelMap, parent: Container, app: Application) {
        this.voxelMap = voxelMap;
        this.parent = parent;
        this.terrainPlane = new Container();
        this.chunkSpritePool = [];
        this.chunkRenderer = new ChunkRenderer(app, {
            pixelPerTile: PIXEL_PER_TILE,
            tilePerChunk: TILE_PER_CHUNK,
            numRenderTextures: CHUNK_PER_VIEWPORT * CHUNK_PER_VIEWPORT,
        });
        this.viewOrigin = { x: 0, z: 0 };

        this.parent.addChild(this.terrainPlane);
    }

    get VoxelMap() {
        return this.voxelMap;
    }

    get top() {
        return this.terrainPlane;
    }

    // スプライトプールを作成し、初期ビューポートを設定する
    initializeSprites(center: Pos2D) {
        for (let y = 0; y < CHUNK_PER_VIEWPORT; y++) {
            for (let x = 0; x < CHUNK_PER_VIEWPORT; x++) {
                const chunkSprite = new Sprite(Texture.EMPTY);
                chunkSprite.x = x * TILE_PER_CHUNK * PIXEL_PER_TILE;
                chunkSprite.y = y * TILE_PER_CHUNK * PIXEL_PER_TILE;
                this.chunkSpritePool.push(chunkSprite);
                this.terrainPlane.addChild(chunkSprite);
            }
        }

        this.updateViewport(center);
    }

    /*
    setMouseListeners() {
        this.terrainPlane.interactive = true;
        this.terrainPlane.on("pointermove", (e) => {
            this.globalPos.x = e.global.x;
            this.globalPos.z = e.global.y;
            this.pointerMoved = true;
            this.updatePointerPosition();
        });
    }

    updatePointerPosition() {
        this.pointer.x = this.viewOrigin.x + this.globalPos.x / this.parent.scale.x / PIXEL_PER_TILE;
        this.pointer.z = this.viewOrigin.z + this.globalPos.z / this.parent.scale.y / PIXEL_PER_TILE;
    }

    get pointerPositionInWorld() {
        return this.pointer;
    }
    */

    /*
    private isMouseOverTile(x: number, z: number): boolean {
        const tileX = Math.floor(this.pointer.x);
        const tileZ = Math.floor(this.pointer.z);
        return x === tileX && z === tileZ;
    }

    private tilePositionToIndex(row: number, col: number): number {
        // rowとcolは-1からTILE_PER_CHUNKまでの範囲を取るため、インデックスに変換する際に+1して0から始まるようにする
        return (col + 1) * (TILE_PER_CHUNK + 2) + (row + 1);
    }
    */

    // ビューポートの中心位置を受け取り、ボクセルマップ中のどの領域がビューポートに入るかを計算する
    calcViewCorners(center: Pos2D): { left: number; right: number; top: number; bottom: number } {
        const halfViewportSize = Math.floor((CHUNK_PER_VIEWPORT * TILE_PER_CHUNK) / 2);
        const left = center.x - halfViewportSize;
        const right = center.x + halfViewportSize;
        const top = center.z - halfViewportSize;
        const bottom = center.z + halfViewportSize;

        return { left, right, top, bottom };
    }

    // プレイヤー位置を受け取り、タイル位置が変わった場合のみスプライトを更新する
    updateViewport(center: Pos2D) {
        const { left, top } = this.calcViewCorners(center);

        if (!this.viewportInitialized || left !== this.viewOrigin.x || top !== this.viewOrigin.z) {
            this.viewOrigin.x = left;
            this.viewOrigin.z = top;
            this.viewportInitialized = true;
            this.refreshSprites();
        }
    }

    // entity spriteを全破棄し、terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites() {
        // terrain pool spriteを更新
        for (let col = 0; col < CHUNK_PER_VIEWPORT; col++) {
            for (let row = 0; row < CHUNK_PER_VIEWPORT; row++) {
                const worldX = this.viewOrigin.x + row * TILE_PER_CHUNK;
                const worldZ = this.viewOrigin.z + col * TILE_PER_CHUNK;
                const sprite = this.chunkSpritePool[col * CHUNK_PER_VIEWPORT + row];

                const texture = this.chunkRenderer.renderChunk(this.voxelMap, { x: worldX, z: worldZ }, col * CHUNK_PER_VIEWPORT + row, setupSpriteFromVoxel);
                sprite.texture = texture;
                sprite.visible = true;
            }
        }
    }
}

function setupSpriteFromVoxel(tile: Tile, voxel: number, position: Pos3D) {
    const spriteName = getTerrainSpriteNameFromVoxel(voxel, position);
    tile.sprite.texture = Texture.from(spriteName);
    tile.sprite.visible = true;
}
