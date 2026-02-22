import { Application, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture } from "pixi.js";
import { VoxelMap, type Pos3D } from "../lib/VoxelMap";
import { getSpriteNameFromVoxel } from "../Entity/Terrain";

const TILE_SIZE = 16;
const VIEWPORT_SIZE = 64; // 画面に表示するタイル数
const BUFFER = 5;          // 各辺の余白タイル数
export const POOL_SIZE = VIEWPORT_SIZE + 2 * BUFFER; // 74
const CHUNK_SIZE = 16;         // チャンクのタイル数

export class TopViewMap {
    private app: Application;
    private voxelMap: VoxelMap;
    private worldContainer: Container;
    private terrainPlane: Container;

    // terrain用: POOL_SIZE×POOL_SIZE のスプライトプール（row*POOL_SIZE+col でインデックス）
    private tileSpritePool: Sprite[];
    private chunkTexturePool: Texture[]; // チャンクごとのテクスチャリスト
    private chunkSpritePool: Sprite[]; // チャンクごとのスプライトリスト

    // 現在のビューポート起点（ワールド座標）
    private viewOriginX = 0;
    private viewOriginZ = 0;
    private viewportInitialized = false;

    constructor(voxelMap: VoxelMap, worldContainer: Container, app: Application) {
        this.app = app;
        this.voxelMap = voxelMap;
        this.worldContainer = worldContainer;
        this.terrainPlane = new Container();
        this.tileSpritePool = [];
        this.chunkTexturePool = [];
        this.chunkSpritePool = [];

        this.worldContainer.addChild(this.terrainPlane);
    }

    get VoxelMap() {
        return this.voxelMap;
    }

    // スプライトプールを作成し、初期ビューポートを設定する
    initializeSprites(centerX: number, centerZ: number) {
        for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
            const sprite = this.createPoolSprite();
            this.tileSpritePool.push(sprite);
        }
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                const chunkSprite = this.createChunkSprite(x, y);
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
        const chunkContainer = new Container();

        for (let col = -1; col < CHUNK_SIZE + 1; col++) {
            for (let row = -1; row < CHUNK_SIZE + 1; row++) {
                const x = Math.floor(worldX) + row;
                const z = Math.floor(worldZ) + col;

                const position = this.voxelMap.getSurfacePosition({ x, y: 0, z });
                if (position === null) throw new Error(`Failed to get surface position for chunk (${chunkX}, ${chunkZ}) at world (${x}, ${z})`);
                const voxel = this.voxelMap.get(position);
                if (voxel === null) throw new Error(`Failed to get voxel for chunk (${chunkX}, ${chunkZ}) at world (${x}, ${z})`);

                const sprite = new Sprite(Texture.from(getSpriteNameFromVoxel(voxel, position)));
                sprite.x = row * TILE_SIZE - (worldX - Math.floor(worldX)) * TILE_SIZE;
                sprite.y = col * TILE_SIZE - (worldZ - Math.floor(worldZ)) * TILE_SIZE;
                chunkContainer.addChild(sprite);
            }
        }

        this.app.renderer.render({ container: chunkContainer, target: renderTexture, clear: true });

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

    // terrain用プールスプライトを生成（テクスチャは後で設定）
    private createPoolSprite(): Sprite {
        const sprite = new Sprite(Texture.EMPTY);
        sprite.interactive = true;
        sprite.hitArea = new Rectangle(0, 0, TILE_SIZE, TILE_SIZE);

        // デバッグ用ヒット範囲の可視化
        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(0, 0, TILE_SIZE, TILE_SIZE);
        hitAreaDebug.stroke({ width: 1, color: 0x0000ff });
        sprite.addChild(hitAreaDebug);

        return sprite;
    }

    private createChunkSprite(chunkX: number, chunkZ: number): Sprite {
        const sprite = new Sprite(Texture.EMPTY);
        sprite.x = chunkX * CHUNK_SIZE * TILE_SIZE;
        sprite.y = chunkZ * CHUNK_SIZE * TILE_SIZE;
        return sprite;
    }

    /*
    private updateChunkSprite(sprite: Sprite, chunkX: number, chunkZ: number) {

        const chunkIndex = (chunkZ % 4) * 4 + (chunkX % 4);
        const texture = this.chunkTexturePool[chunkIndex];
        return new Sprite(texture);
    }
        */

    /*
    // エンティティ（木など）用スプライトを生成
    private createEntitySprite(entity: number, pos: Pos3D): Sprite {
        const sprite = new Sprite(Texture.from(getSpriteNameFromVoxel(entity & 0x0000FF00, pos)));

        sprite.anchor.set(0.5, 0.8);
        sprite.x = pos.x * TILE_SIZE;
        sprite.y = pos.z * TILE_SIZE;
        sprite.interactive = true;
        sprite.hitArea = new Rectangle(-32 * 0.5, -48 * 0.8, 32, 48);

        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(-32 * 0.5, -48 * 0.8, 32, 48);
        hitAreaDebug.stroke({ width: 1, color: 0x0000ff });
        sprite.addChild(hitAreaDebug);

        return sprite;
    }
        */

    // ボクセルを削除し、プール内のスプライトを新しい表面ボクセルで更新する
    removeVoxel(pos: Pos3D): void {
        const voxel = this.voxelMap.get(pos);
        if (!voxel) return;

        // ボクセルをマップから削除
        this.voxelMap.remove(pos);

        // プール内の対応スプライトを特定して更新
        const col = pos.x - this.viewOriginX;
        const row = pos.z - this.viewOriginZ;

        if (col >= 0 && col < POOL_SIZE && row >= 0 && row < POOL_SIZE) {
            const sprite = this.tileSpritePool[row * POOL_SIZE + col];

            const newSurfacePos = this.voxelMap.getSurfacePosition(pos);
            if (newSurfacePos === null) throw new Error(`Failed to get new surface position after removing voxel at (${pos.x}, ${pos.z})`);

            const newSurfaceVoxel = this.voxelMap.get(newSurfacePos);
            if (newSurfaceVoxel === null) throw new Error(`Failed to get new surface voxel after removing voxel at (${pos.x}, ${pos.z})`);

            sprite.texture = Texture.from(getSpriteNameFromVoxel(newSurfaceVoxel, newSurfacePos));
            sprite.visible = true;
        }
    }

}
