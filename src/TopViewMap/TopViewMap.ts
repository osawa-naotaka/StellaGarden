import { type Application, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture } from "pixi.js";
import { getSpriteNameFromVoxel } from "../Entity/Terrain";
import type { VoxelMap } from "../lib/VoxelMap";

const TILE_SIZE = 16;
const VIEWPORT_SIZE = 64; // 画面に表示するタイル数
const BUFFER = 5; // 各辺の余白タイル数
export const POOL_SIZE = VIEWPORT_SIZE + 2 * BUFFER; // 74
const CHUNK_SIZE = 16; // チャンクのタイル数

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

    // スプライトプールを作成し、初期ビューポートを設定する
    initializeSprites(centerX: number, centerZ: number) {
        for (let i = 0; i < (CHUNK_SIZE + 2) * (CHUNK_SIZE + 2); i++) {
            const sprite = new Sprite(Texture.EMPTY);
            sprite.interactive = true;
            sprite.hitArea = new Rectangle(0, 0, TILE_SIZE, TILE_SIZE);
            
            this.tileSpritePool.push(sprite);
            const container = new Container();
            container.addChild(sprite);

            // デバッグ用ヒット範囲の可視化
            const hitAreaDebug = new Graphics();
            hitAreaDebug.rect(0, 0, TILE_SIZE, TILE_SIZE);
            hitAreaDebug.stroke({ width: 1, color: 0x0000ff });

            container.addChild(hitAreaDebug);
            this.tileContainerPool.push(container);

            this.chunkContainer.addChild(container);
        }

        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                const chunkSprite = new Sprite(Texture.EMPTY);
                chunkSprite.x = x * CHUNK_SIZE * TILE_SIZE;
                chunkSprite.y = y * CHUNK_SIZE * TILE_SIZE;
                this.chunkSpritePool.push(chunkSprite);
                this.terrainPlane.addChild(chunkSprite);

                const renderTexture = RenderTexture.create({
                    width: CHUNK_SIZE * TILE_SIZE,
                    height: CHUNK_SIZE * TILE_SIZE,
                });
                this.chunkTexturePool.push(renderTexture);
            }
        }

        this.updateViewport(centerX, centerZ);
    }

    renderChunk(chunkX: number, chunkZ: number, worldX: number, worldZ: number): Texture {
        const chunkIndex = (chunkZ % 4) * 4 + (chunkX % 4);
        const renderTexture = this.chunkTexturePool[chunkIndex];

        for (let col = -1; col < CHUNK_SIZE + 1; col++) {
            for (let row = -1; row < CHUNK_SIZE + 1; row++) {
                const x = Math.floor(worldX) + row;
                const z = Math.floor(worldZ) + col;

                const position = this.voxelMap.getSurfacePosition({ x, y: 0, z });
                if (position === null) throw new Error(`Failed to get surface position for chunk (${chunkX}, ${chunkZ}) at world (${x}, ${z})`);
                const voxel = this.voxelMap.get(position);
                if (voxel === null) throw new Error(`Failed to get voxel for chunk (${chunkX}, ${chunkZ}) at world (${x}, ${z})`);

                const spriteName = getSpriteNameFromVoxel(voxel, position);
                const sprite = this.tileSpritePool[(col + 1) * (CHUNK_SIZE + 2) + (row + 1)];
                if (!sprite) throw new Error(`Failed to get sprite from pool for chunk (${chunkX}, ${chunkZ}) at world (${x}, ${z})`);
                sprite.texture = Texture.from(spriteName);

                const container = this.tileContainerPool[(col + 1) * (CHUNK_SIZE + 2) + (row + 1)];
                container.x = row * TILE_SIZE - (worldX - Math.floor(worldX)) * TILE_SIZE;
                container.y = col * TILE_SIZE - (worldZ - Math.floor(worldZ)) * TILE_SIZE;

                this.chunkContainer.addChild(container);
            }
        }

        this.app.renderer.render({ container: this.chunkContainer, target: renderTexture, clear: true });

        return renderTexture;
    }

    // プレイヤー位置を受け取り、タイル位置が変わった場合のみスプライトを更新する
    updateViewport(playerX: number, playerZ: number) {
        const newOriginX = playerX - Math.floor(POOL_SIZE / 2);
        const newOriginZ = playerZ - Math.floor(POOL_SIZE / 2);

        if (!this.viewportInitialized || newOriginX !== this.viewOriginX || newOriginZ !== this.viewOriginZ) {
            this.viewOriginX = newOriginX;
            this.viewOriginZ = newOriginZ;
            this.viewportInitialized = true;
            this.refreshSprites();
        }
    }

    // entity spriteを全破棄し、terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites() {
        // terrain pool spriteを更新
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                const worldX = this.viewOriginX + row * CHUNK_SIZE;
                const worldZ = this.viewOriginZ + col * CHUNK_SIZE;
                const sprite = this.chunkSpritePool[col * 4 + row];

                const texture = this.renderChunk(row, col, worldX, worldZ);
                sprite.texture = texture;
                sprite.visible = true;
            }
        }
    }
}
