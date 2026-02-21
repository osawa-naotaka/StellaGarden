import { ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { type Entity, StaticEntity, Terrain } from "../Entity/Entity";
import { VoxelMap } from "../lib/VoxelMap";
import type { GameState } from "../State/GameState";

const TILE_SIZE = 16;
const VIEWPORT_SIZE = 65; // 画面に表示するタイル数
const BUFFER = 5;          // 各辺の余白タイル数
export const POOL_SIZE = VIEWPORT_SIZE + 2 * BUFFER; // 75

export class TopViewMap {
    private voxelMap: VoxelMap<Terrain>;
    private worldContainer: Container;
    private terrainPlane: Container;
    private entityPlane: Container;

    // terrain用: POOL_SIZE×POOL_SIZE のスプライトプール（row*POOL_SIZE+col でインデックス）
    private terrainSpritePool: Sprite[];
    // entity用: 現在ビューポート内のエンティティスプライト一覧
    private entitySpriteList: Sprite[];

    // イベント用動的参照（terrainスプライトは viewport 更新時に更新）
    private spriteToEntity: Map<Sprite, Entity>;
    // entity スプライト専用の逆引き（removeEntityで使用）
    private entityToSprite: Map<Entity, Sprite>;

    // 現在のビューポート起点（ワールド座標）
    private viewOriginX = 0;
    private viewOriginZ = 0;
    private viewportInitialized = false;

    // initializeEvents 後に保存（entity sprite 作成時のイベント登録に使用）
    private gameState: GameState | null = null;

    constructor(voxelMap: VoxelMap<Terrain>, worldContainer: Container) {
        this.voxelMap = voxelMap;
        this.worldContainer = worldContainer;
        this.terrainPlane = new Container();
        this.entityPlane = new Container();
        this.terrainSpritePool = [];
        this.entitySpriteList = [];
        this.spriteToEntity = new Map();
        this.entityToSprite = new Map();

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

    // gameStateを保存し、全スプライトにイベントハンドラを設定する
    initializeEvents(gameState: GameState) {
        this.gameState = gameState;
        for (const sprite of this.terrainSpritePool) {
            this.setEventHandlers(sprite, gameState);
        }
        for (const sprite of this.entitySpriteList) {
            this.setEventHandlers(sprite, gameState);
        }
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
            const entity = this.spriteToEntity.get(sprite);
            if (entity) {
                this.entityToSprite.delete(entity);
                this.spriteToEntity.delete(sprite);
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
                    const voxel = this.voxelMap.getSurfaceVoxel({ x: worldX, y: 0, z: worldZ });
                    if (voxel) {
                        sprite.texture = Texture.from(voxel.sprite);
                        sprite.x = worldX * TILE_SIZE;
                        sprite.y = worldZ * TILE_SIZE;
                        sprite.visible = true;
                        this.spriteToEntity.set(sprite, voxel);

                        // このタイル上のエンティティスプライトを作成
                        for (const entity of voxel.entities) {
                            const entitySprite = this.createEntitySprite(entity);
                            this.entitySpriteList.push(entitySprite);
                            this.entityPlane.addChild(entitySprite);
                        }
                    } else {
                        sprite.visible = false;
                    }
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
    private createEntitySprite(entity: Entity): Sprite {
        const sprite = new Sprite(Texture.from(entity.sprite));
        const { w, h, anchorX, anchorY } = entity.spriteProps;

        sprite.anchor.set(anchorX, anchorY);
        sprite.x = entity.pos.x * TILE_SIZE;
        sprite.y = entity.pos.z * TILE_SIZE;
        sprite.interactive = true;
        sprite.hitArea = new Rectangle(-w * anchorX, -h * anchorY, w, h);

        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(-w * anchorX, -h * anchorY, w, h);
        hitAreaDebug.stroke({ width: 1, color: 0x0000ff });
        sprite.addChild(hitAreaDebug);

        this.entityToSprite.set(entity, sprite);
        this.spriteToEntity.set(sprite, entity);

        if (this.gameState) {
            this.setEventHandlers(sprite, this.gameState);
        }

        return sprite;
    }

    // イベントハンドラを設定する
    // terrain spriteはspriteToEntityを動的に参照するため、プール再利用時も正しく動作する
    setEventHandlers(sprite: Sprite, gameState: GameState) {
        const brightnessFilter = new ColorMatrixFilter();
        brightnessFilter.brightness(1.5, false);

        sprite.on("pointerover", () => {
            sprite.filters = [brightnessFilter];
        });
        sprite.on("pointerout", () => {
            sprite.filters = null;
        });
        sprite.on("pointerdown", (event) => {
            if (event.button === 2) {
                const entity = this.spriteToEntity.get(sprite);
                if (entity) entity.interact(gameState);
            }
        });
    }

    // ボクセルを削除し、プール内のスプライトを新しい表面ボクセルで更新する
    removeVoxel(voxel: Terrain) {
        // このボクセル上のエンティティスプライトを削除
        for (const e of voxel.entities) {
            this.removeEntityFromSprite(e);
        }

        // ボクセルをマップから削除
        this.voxelMap.remove(voxel);

        // プール内の対応スプライトを特定して更新
        const col = voxel.pos.x - this.viewOriginX;
        const row = voxel.pos.z - this.viewOriginZ;

        if (col >= 0 && col < POOL_SIZE && row >= 0 && row < POOL_SIZE) {
            const sprite = this.terrainSpritePool[row * POOL_SIZE + col];
            const newSurface = this.voxelMap.getSurfaceVoxel(voxel.pos);

            if (newSurface) {
                sprite.texture = Texture.from(newSurface.sprite);
                this.spriteToEntity.set(sprite, newSurface);

                // 新しい表面のエンティティスプライトを追加
                for (const entity of newSurface.entities) {
                    const entitySprite = this.createEntitySprite(entity);
                    this.entitySpriteList.push(entitySprite);
                    this.entityPlane.addChild(entitySprite);
                }
            } else {
                sprite.visible = false;
            }
        }
    }

    // エンティティを削除する（ボクセルのエンティティリストからも除去）
    removeEntity(entity: Entity): void {
        this.removeEntityFromSprite(entity);
        const voxel = this.voxelMap.get(entity.pos);
        if (voxel instanceof Terrain) {
            voxel.removeEntity(entity as StaticEntity);
        }
    }

    // エンティティのスプライトのみを削除する（内部処理用）
    private removeEntityFromSprite(entity: Entity): void {
        const sprite = this.entityToSprite.get(entity);
        if (sprite) {
            sprite.parent?.removeChild(sprite);
            this.entityToSprite.delete(entity);
            this.spriteToEntity.delete(sprite);
            const idx = this.entitySpriteList.indexOf(sprite);
            if (idx >= 0) this.entitySpriteList.splice(idx, 1);
            sprite.destroy();
        }
    }
}
