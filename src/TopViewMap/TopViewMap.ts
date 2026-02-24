import { type Application, Container, Sprite, Texture } from "pixi.js";
import { getTerrainSpriteNameFromVoxel } from "../Entity/Terrain";
import { ChunkRenderer } from "../lib/ChunkRenderer";
import type { Tile } from "../lib/Tile";
import type { Pos2D, Pos3D, VoxelMap } from "../lib/VoxelMap";

export class TopViewMap {
    private voxelMap: VoxelMap;
    private terrainPlane: Container;
    private chunkRenderer: ChunkRenderer;
    private chunkSpritePool: Sprite[]; // チャンクごとのスプライトリスト

    private pixelPerTile: number;
    private tilePerChunk: number;
    private chunkPerViewport: Pos2D;

    constructor(voxelMap: VoxelMap, app: Application, opt: { pixelPerTile: number; tilePerChunk: number; chunkPerViewport: Pos2D }) {
        this.voxelMap = voxelMap;
        this.terrainPlane = new Container();
        this.chunkSpritePool = [];
        this.pixelPerTile = opt.pixelPerTile;
        this.tilePerChunk = opt.tilePerChunk;
        this.chunkPerViewport = opt.chunkPerViewport;
        this.chunkRenderer = new ChunkRenderer(app, {
            pixelPerTile: opt.pixelPerTile,
            tilePerChunk: opt.tilePerChunk,
            numRenderTextures: opt.chunkPerViewport.x * opt.chunkPerViewport.z,
        });
    }

    get top() {
        return this.terrainPlane;
    }

    // チャンクスプライトを初期化して親コンテナに配置する。スプライトは全て空のテクスチャで初期化され、後でビューポートに合わせて更新される。
    initializeSprites() {
        for (let y = 0; y < this.chunkPerViewport.z; y++) {
            for (let x = 0; x < this.chunkPerViewport.x; x++) {
                const chunkSprite = new Sprite(Texture.EMPTY);
                chunkSprite.x = x * this.tilePerChunk * this.pixelPerTile;
                chunkSprite.y = y * this.tilePerChunk * this.pixelPerTile;
                this.chunkSpritePool.push(chunkSprite);
                this.terrainPlane.addChild(chunkSprite);
            }
        }
    }

    // プレイヤー位置を受け取り、タイル位置が変わった場合のみスプライトを更新する
    updateViewport(positionInWorld: Pos2D) {
        const { left, top } = this.calcViewCorners(positionInWorld);
        this.refreshSprites({ x: left, z: top });
    }

    // ビューポートの中心位置を受け取り、ボクセルマップ中のどの領域がビューポートに入るかを計算する
    private calcViewCorners(center: Pos2D): { left: number; right: number; top: number; bottom: number } {
        const halfViewportSizeW = Math.floor((this.chunkPerViewport.x * this.tilePerChunk) / 2);
        const halfViewportSizeH = Math.floor((this.chunkPerViewport.z * this.tilePerChunk) / 2);
        const left = center.x - halfViewportSizeW;
        const right = center.x + halfViewportSizeW;
        const top = center.z - halfViewportSizeH;
        const bottom = center.z + halfViewportSizeH;

        return { left, right, top, bottom };
    }

    // terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites(viewportOrigin: Pos2D) {
        // terrain pool spriteを更新
        for (let col = 0; col < this.chunkPerViewport.z; col++) {
            for (let row = 0; row < this.chunkPerViewport.x; row++) {
                const worldX = viewportOrigin.x + row * this.tilePerChunk;
                const worldZ = viewportOrigin.z + col * this.tilePerChunk;
                const sprite = this.chunkSpritePool[col * this.chunkPerViewport.x + row];

                const texture = this.chunkRenderer.renderChunk(
                    this.voxelMap,
                    { x: worldX, z: worldZ },
                    col * this.chunkPerViewport.x + row,
                    setupSpriteFromVoxel,
                );
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
