import { ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { Terrain, Entity } from "../Map/Entity";
import { VoxelMap } from "../lib/VoxelMap";
import { generateTerrain } from "../Map/Terrain";
import type { GameState } from "../State/GameState";

export class TopViewMap {
    private voxelMap: VoxelMap<Terrain>;
    private parent: Container;
    private terrainPlane: Container;
    private entityPlane: Container;
    private entityToSprite: Map<Entity, Sprite>;
    private spriteToEntity: Map<Sprite, Entity>;

    constructor(voxelMap: VoxelMap<Terrain>, parent: Container) {
        this.voxelMap = voxelMap;
        this.parent = parent;
        this.terrainPlane = new Container();
        this.entityPlane = new Container();
        this.entityToSprite = new Map<Entity, Sprite>();
        this.spriteToEntity = new Map<Sprite, Entity>();

        // コンテナを親に追加
        this.parent.addChild(this.terrainPlane);
        this.parent.addChild(this.entityPlane);
    }

    get VoxelMap() {
        return this.voxelMap;
    }

    initializeSprites() {
        // 地形セルのスプライトを生成
        const surface = this.voxelMap.getSurfaceVoxels();
        for(const v of surface) {
            const sprite = this.createSprite(v);
            this.terrainPlane.addChild(sprite);
        }

        // StaticEntityやDynamicEntityのスプライトも同様に生成
        for(const v of surface) {
            for(const e of v.entities) {
                if(e.type === "tree") {
                    const sprite = this.createSprite(e);
                    this.entityPlane.addChild(sprite);
                }
            }
        }
    }

    initializeEvents(gameState: GameState) {
        for(const [entity, sprite] of this.entityToSprite.entries()) {
            // 明度を上げるフィルターを作成
            const brightnessFilter = new ColorMatrixFilter();
            brightnessFilter.brightness(1.5, false); // 明度を50%上げる

            // common handler
            sprite.on("pointerover", () => {
                sprite.filters = [brightnessFilter];
            });

            sprite.on("pointerout", () => {
                sprite.filters = null;
            });

            sprite.on("pointerdown", (event) => {
                if(event.button === 2) { // 右クリック
                    entity.interact(gameState);
                }
            });
        }
    }

    removeVoxel(voxel: Terrain) {
        // 地形セル上のエンティティとスプライトを削除
        for(const e of voxel.entities) {
            this.removeEntity(e);
        }

        // ボクセルのスプライトを削除
        const sprite = this.entityToSprite.get(voxel);
        if(sprite) {
            sprite.parent?.removeChild(sprite);
            this.entityToSprite.delete(voxel);
            this.spriteToEntity.delete(sprite);
        }

        // ボクセルマップからボクセルを削除
        this.voxelMap.remove(voxel);

        // 新しい地形セルのスプライトを作成
        this.createNewSurfaceSprite(voxel);
    }

    private createNewSurfaceSprite(oldVoxel: Terrain): void {
        const newSurface = this.voxelMap.getSurfaceVoxel(oldVoxel.pos);
        if(!newSurface) throw new Error("No surface voxel found");

        const sprite = this.createSprite(newSurface);
        this.terrainPlane.addChild(sprite);
    }

    removeEntity(entity: Entity): void {
        const sprite = this.entityToSprite.get(entity);
        if(sprite) {
            sprite.parent?.removeChild(sprite);
            this.entityToSprite.delete(entity);
            this.spriteToEntity.delete(sprite);
        }
        const voxel = this.voxelMap.get(entity.pos);
        if(voxel instanceof Terrain) {
            voxel.removeEntity(entity);
        }
    }

    private createSprite(entity: Entity): Sprite {
        const sprite = new Sprite(Texture.from(entity.sprite));
        const { w, h, anchorX, anchorY } = entity.spriteProps;

        sprite.anchor.set(anchorX, anchorY);
        sprite.x = entity.pos.x * 16;
        sprite.y = entity.pos.z * 16;

        // スプライトをインタラクティブに設定
        sprite.interactive = true;

        // 当たり判定を設定（セル全体をクリック可能に）
        sprite.hitArea = new Rectangle(-w / 2, -h / 2, w, h);

        // 当たり判定を可視化（デバッグ用の青い線）
        const tileHitAreaDebug = new Graphics();
        tileHitAreaDebug.rect(-w / 2, -h / 2, w, h);
        tileHitAreaDebug.stroke({ width: 1, color: 0x0000ff }); // 青い枠線
        sprite.addChild(tileHitAreaDebug);        

        // スプライトとエンティティの対応を保存
        this.entityToSprite.set(entity, sprite);
        this.spriteToEntity.set(sprite, entity);
        return sprite;
    }
};

export function createTopViewMap(parent: Container): TopViewMap {
    // ボクセルマップを作成して地形を生成
    const voxelMap = new VoxelMap<Terrain>(100, 5, 100, 2);
    generateTerrain(voxelMap);

    // TopViewMapを作成してスプライトを初期化
    const topViewMap = new TopViewMap(voxelMap, parent);
    topViewMap.initializeSprites();

    return topViewMap;
}
