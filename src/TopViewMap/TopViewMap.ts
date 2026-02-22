import { type Application, Container, Graphics, RenderTexture, Sprite, Texture } from "pixi.js";
import { getSpriteNameFromVoxel } from "../Entity/Terrain";
import type { VoxelMap } from "../lib/VoxelMap";

export const PIXEL_PER_TILE = 16; // タイル1枚のサイズ（ピクセル）。スプライトのサイズと一致させる必要がある。
export const TILE_PER_CHUNK = 16; // チャンクのタイル数
export const CHUNK_PER_VIEWPORT = 4;
export const TILE_PER_VIEWPORT = TILE_PER_CHUNK * CHUNK_PER_VIEWPORT; // ビューポートのタイル数（横・縦）

export class TopViewMap {
    private app: Application;
    private voxelMap: VoxelMap;
    private parent: Container;
    private terrainPlane: Container;

    // terrain用: POOL_SIZE×POOL_SIZE のスプライトプール（row*POOL_SIZE+col でインデックス）
    private tileSpritePool: Sprite[];
    private tileContainerPool: Container[];
    private chunkTexturePool: Texture[]; // チャンクごとのテクスチャリスト
    private chunkSpritePool: Sprite[]; // チャンクごとのスプライトリスト
    private chunkContainer: Container;

    // 現在のビューポート起点（ワールド座標）
    private viewOriginX = 0;
    private viewOriginZ = 0;
    private viewportInitialized = false;

    constructor(voxelMap: VoxelMap, parent: Container, app: Application) {
        this.app = app;
        this.voxelMap = voxelMap;
        this.parent = parent;
        this.terrainPlane = new Container();
        this.tileSpritePool = [];
        this.tileContainerPool = [];
        this.chunkTexturePool = [];
        this.chunkSpritePool = [];
        this.chunkContainer = new Container();

        this.parent.addChild(this.terrainPlane);
    }

    get VoxelMap() {
        return this.voxelMap;
    }

    private createEmptyTile(): { top: Container; sprite: Sprite } {
        const top = new Container();

        const sprite = new Sprite(Texture.EMPTY);
        top.addChild(sprite);

        // デバッグ用ヒット範囲の可視化
        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(0, 0, PIXEL_PER_TILE, PIXEL_PER_TILE);
        hitAreaDebug.stroke({ width: 1, color: 0x0000ff });

        top.addChild(hitAreaDebug);

        this.chunkContainer.addChild(top);
        return { top, sprite };
    }

    // スプライトプールを作成し、初期ビューポートを設定する
    initializeSprites(centerX: number, centerZ: number) {
        for (let i = 0; i < (TILE_PER_CHUNK + 2) * (TILE_PER_CHUNK + 2); i++) {
            const { top, sprite } = this.createEmptyTile();

            this.tileSpritePool.push(sprite);
            this.tileContainerPool.push(top);

            this.chunkContainer.addChild(top);
        }

        for (let y = 0; y < CHUNK_PER_VIEWPORT; y++) {
            for (let x = 0; x < CHUNK_PER_VIEWPORT; x++) {
                const chunkSprite = new Sprite(Texture.EMPTY);
                chunkSprite.x = x * TILE_PER_CHUNK * PIXEL_PER_TILE;
                chunkSprite.y = y * TILE_PER_CHUNK * PIXEL_PER_TILE;
                this.chunkSpritePool.push(chunkSprite);
                this.terrainPlane.addChild(chunkSprite);

                const renderTexture = RenderTexture.create({
                    width: TILE_PER_CHUNK * PIXEL_PER_TILE,
                    height: TILE_PER_CHUNK * PIXEL_PER_TILE,
                });
                this.chunkTexturePool.push(renderTexture);
            }
        }

        this.updateViewport(centerX, centerZ);
    }

    renderChunk(chunkX: number, chunkZ: number, worldX: number, worldZ: number): Texture {
        const chunkIndex = (chunkZ % CHUNK_PER_VIEWPORT) * CHUNK_PER_VIEWPORT + (chunkX % CHUNK_PER_VIEWPORT);
        const renderTexture = this.chunkTexturePool[chunkIndex];

        for (let col = -1; col < TILE_PER_CHUNK + 1; col++) {
            for (let row = -1; row < TILE_PER_CHUNK + 1; row++) {
                const x = Math.floor(worldX) + row;
                const z = Math.floor(worldZ) + col;

                const position = this.voxelMap.getSurfacePosition({ x, y: 0, z });
                const voxel = this.voxelMap.get(position);

                const spriteName = getSpriteNameFromVoxel(voxel, position);
                const sprite = this.tileSpritePool[(col + 1) * (TILE_PER_CHUNK + 2) + (row + 1)];
                sprite.texture = Texture.from(spriteName);

                const container = this.tileContainerPool[(col + 1) * (TILE_PER_CHUNK + 2) + (row + 1)];
                container.x = row * PIXEL_PER_TILE - (worldX - Math.floor(worldX)) * PIXEL_PER_TILE;
                container.y = col * PIXEL_PER_TILE - (worldZ - Math.floor(worldZ)) * PIXEL_PER_TILE;

                this.chunkContainer.addChild(container);
            }
        }

        this.app.renderer.render({ container: this.chunkContainer, target: renderTexture, clear: true });

        return renderTexture;
    }

    // プレイヤー位置を受け取り、ボクセルマップ中のどの領域がビューポートに入るかを計算する
    calcViewCorners(playerX: number, playerZ: number): { left: number; right: number; top: number; bottom: number } {
        const halfViewportSize = Math.floor((CHUNK_PER_VIEWPORT * TILE_PER_CHUNK) / 2);
        const left = playerX - halfViewportSize;
        const right = playerX + halfViewportSize;
        const top = playerZ - halfViewportSize;
        const bottom = playerZ + halfViewportSize;

        return { left, right, top, bottom };
    }

    // プレイヤー位置を受け取り、タイル位置が変わった場合のみスプライトを更新する
    updateViewport(playerX: number, playerZ: number) {
        const { left, top } = this.calcViewCorners(playerX, playerZ);

        if (!this.viewportInitialized || left !== this.viewOriginX || top !== this.viewOriginZ) {
            this.viewOriginX = left;
            this.viewOriginZ = top;
            this.viewportInitialized = true;
            this.refreshSprites();
        }
    }

    // entity spriteを全破棄し、terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites() {
        // terrain pool spriteを更新
        for (let col = 0; col < CHUNK_PER_VIEWPORT; col++) {
            for (let row = 0; row < CHUNK_PER_VIEWPORT; row++) {
                const worldX = this.viewOriginX + row * TILE_PER_CHUNK;
                const worldZ = this.viewOriginZ + col * TILE_PER_CHUNK;
                const sprite = this.chunkSpritePool[col * 4 + row];

                const texture = this.renderChunk(row, col, worldX, worldZ);
                sprite.texture = texture;
                sprite.visible = true;
            }
        }
    }
}
