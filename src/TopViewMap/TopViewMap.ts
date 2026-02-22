import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { VoxelMap, type Pos3D } from "../lib/VoxelMap";
import { getSpriteNameFromVoxel } from "../Entity/Terrain";

const TILE_SIZE = 16;
const VIEWPORT_SIZE = 65; // 画面に表示するタイル数
const BUFFER = 5;          // 各辺の余白タイル数
export const POOL_SIZE = VIEWPORT_SIZE + 2 * BUFFER; // 75

export class TopViewMap {
    private voxelMap: VoxelMap;
    private worldContainer: Container;
    private terrainPlane: Container;
    private entityPlane: Container;

    // terrain用: POOL_SIZE×POOL_SIZE のスプライトプール（row*POOL_SIZE+col でインデックス）
    private terrainSpritePool: Sprite[];
    // entity用: 現在ビューポート内のエンティティスプライト一覧
    private entitySpriteList: Sprite[];

    // イベント用動的参照（terrainスプライトは viewport 更新時に更新）
    private spriteToEntityPos: Map<Sprite, Pos3D>;
    // entity スプライト専用の逆引き（removeEntityで使用）
    private entityPosToSprite: Map<Pos3D, Sprite>;

    // 現在のビューポート起点（ワールド座標）
    private viewOriginX = 0;
    private viewOriginZ = 0;
    private viewportInitialized = false;

    constructor(voxelMap: VoxelMap, worldContainer: Container) {
        this.voxelMap = voxelMap;
        this.worldContainer = worldContainer;
        this.terrainPlane = new Container();
        this.entityPlane = new Container();
        this.terrainSpritePool = [];
        this.entitySpriteList = [];
        this.spriteToEntityPos = new Map();
        this.entityPosToSprite = new Map();

        this.worldContainer.addChild(this.terrainPlane);
        this.worldContainer.addChild(this.entityPlane);
    }

    get VoxelMap() {
        return this.voxelMap;
    }

    // スプライトプールを作成し、初期ビューポートを設定する
    initializeSprites(centerX: number, centerZ: number) {
        for (let i = 0; i < POOL_SIZE * POOL_SIZE; i++) {
            const sprite = this.createPoolSprite();
            this.terrainSpritePool.push(sprite);
            this.terrainPlane.addChild(sprite);
        }
        this.updateViewport(centerX, centerZ);
    }

    // プレイヤー位置を受け取り、タイル位置が変わった場合のみスプライトを更新する
    updateViewport(playerX: number, playerZ: number) {
        const newOriginX = Math.round(playerX) - Math.floor(POOL_SIZE / 2);
        const newOriginZ = Math.round(playerZ) - Math.floor(POOL_SIZE / 2);

        if (!this.viewportInitialized || newOriginX !== this.viewOriginX || newOriginZ !== this.viewOriginZ) {
            this.viewOriginX = newOriginX;
            this.viewOriginZ = newOriginZ;
            this.viewportInitialized = true;
            this.refreshSprites();
        }
    }

    // entity spriteを全破棄し、terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites() {
        // entity spritesをクリア
        for (const sprite of this.entitySpriteList) {
            const pos = this.spriteToEntityPos.get(sprite);
            if (pos) {
                this.entityPosToSprite.delete(pos);
                this.spriteToEntityPos.delete(sprite);
            }
            sprite.parent?.removeChild(sprite);
            sprite.destroy();
        }
        this.entitySpriteList = [];

        // terrain pool spriteを更新
        for (let row = 0; row < POOL_SIZE; row++) {
            for (let col = 0; col < POOL_SIZE; col++) {
                const worldX = this.viewOriginX + col;
                const worldZ = this.viewOriginZ + row;
                const sprite = this.terrainSpritePool[row * POOL_SIZE + col];

                const inBounds =
                    worldX >= 0 && worldX < this.voxelMap.width &&
                    worldZ >= 0 && worldZ < this.voxelMap.depth;

                if (inBounds) {
                    const position = this.voxelMap.getSurfacePosition({ x: worldX, y: 0, z: worldZ });
                    if (position === null) throw new Error(`Failed to get surface position for terrain at (${worldX}, ${worldZ})`);
                    const voxel = this.voxelMap.get(position);
                    if (voxel === null) throw new Error(`Failed to get voxel for terrain at (${worldX}, ${worldZ})`);
                    sprite.texture = Texture.from(getSpriteNameFromVoxel(voxel, position));
                    sprite.x = worldX * TILE_SIZE;
                    sprite.y = worldZ * TILE_SIZE;
                    sprite.visible = true;
                    this.spriteToEntityPos.set(sprite, position);

                    // TODO:このセルのエンティティスプライトを追加
                } else {
                    sprite.visible = false;
                }
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

        this.entityPosToSprite.set(pos, sprite);
        this.spriteToEntityPos.set(sprite, pos);

        return sprite;
    }

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
            const sprite = this.terrainSpritePool[row * POOL_SIZE + col];

            const newSurfacePos = this.voxelMap.getSurfacePosition(pos);
            if (newSurfacePos === null) throw new Error(`Failed to get new surface position after removing voxel at (${pos.x}, ${pos.z})`);

            const newSurfaceVoxel = this.voxelMap.get(newSurfacePos);
            if (newSurfaceVoxel === null) throw new Error(`Failed to get new surface voxel after removing voxel at (${pos.x}, ${pos.z})`);

            sprite.texture = Texture.from(getSpriteNameFromVoxel(newSurfaceVoxel, newSurfacePos));
            sprite.visible = true;
            this.spriteToEntityPos.set(sprite, newSurfacePos);
        }
    }

}
