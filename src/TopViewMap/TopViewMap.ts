import { Application, Container, Sprite, Texture } from "pixi.js";
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
    private terrainPlane: Container;
    private chunkRenderer: ChunkRenderer;
    private chunkSpritePool: Sprite[]; // チャンクごとのスプライトリスト

    constructor(voxelMap: VoxelMap, parent: Container, app: Application) {
        this.voxelMap = voxelMap;
        this.terrainPlane = new Container();
        this.chunkSpritePool = [];
        this.chunkRenderer = new ChunkRenderer(app, {
            pixelPerTile: PIXEL_PER_TILE,
            tilePerChunk: TILE_PER_CHUNK,
            numRenderTextures: CHUNK_PER_VIEWPORT * CHUNK_PER_VIEWPORT,
        });

        parent.addChild(this.terrainPlane);
    }

    get VoxelMap() {
        return this.voxelMap;
    }

    get top() {
        return this.terrainPlane;
    }

    // チャンクスプライトを初期化して親コンテナに配置する。スプライトは全て空のテクスチャで初期化され、後でビューポートに合わせて更新される。
    initializeSprites() {
        for (let y = 0; y < CHUNK_PER_VIEWPORT; y++) {
            for (let x = 0; x < CHUNK_PER_VIEWPORT; x++) {
                const chunkSprite = new Sprite(Texture.EMPTY);
                chunkSprite.x = x * TILE_PER_CHUNK * PIXEL_PER_TILE;
                chunkSprite.y = y * TILE_PER_CHUNK * PIXEL_PER_TILE;
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
        const halfViewportSize = Math.floor((CHUNK_PER_VIEWPORT * TILE_PER_CHUNK) / 2);
        const left = center.x - halfViewportSize;
        const right = center.x + halfViewportSize;
        const top = center.z - halfViewportSize;
        const bottom = center.z + halfViewportSize;

        return { left, right, top, bottom };
    }

    // terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites(viewportOrigin: Pos2D) {
        // terrain pool spriteを更新
        for (let col = 0; col < CHUNK_PER_VIEWPORT; col++) {
            for (let row = 0; row < CHUNK_PER_VIEWPORT; row++) {
                const worldX = viewportOrigin.x + row * TILE_PER_CHUNK;
                const worldZ = viewportOrigin.z + col * TILE_PER_CHUNK;
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
