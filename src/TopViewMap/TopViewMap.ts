import { Container } from "pixi.js";
import type { Entity } from "../Map/Entity";
import { VoxelMap } from "../lib/VoxelMap";
import { generateTerrain, getTerrainEntity } from "../Map/Terrain";
import { createSpriteFromEntity, registerEventHandlers } from "../lib/Sprite";

export type TopViewMap = {
    voxelMap: VoxelMap<Entity>;
    parent: Container;
    terrainPlane: Container;
    entityPlane: Container;
    entityToSprite: WeakMap<Entity, Container>;
    spriteToEntity: WeakMap<Container, Entity>;
};

export function createTopViewMap(parent: Container): TopViewMap {
    const entityToSprite = new  WeakMap<Entity, Container>();
    const spriteToEntity = new WeakMap<Container, Entity>();

    // 地形とエンティティを描画するためのコンテナを作成
    const terrainPlane = new Container();
    const entityPlane = new Container();

    // ボクセルマップを作成して地形を生成
    const voxelMap = new VoxelMap<Entity>(100, 5, 100, 2);
    generateTerrain(voxelMap);

    // Terrainセルに対応するスプライトを生成
    const surface = voxelMap.getSurfaceVoxels();
    for(const v of surface) {
        const se = getTerrainEntity(v);
        if(se) {
            const sprite = createSpriteFromEntity(se);
            if(sprite) {
                registerEventHandlers(sprite, se);
                terrainPlane.addChild(sprite);
                entityToSprite.set(se, sprite);
                spriteToEntity.set(sprite, se);
            }
        }
    }

    // StaticEntityやDynamicEntityのスプライトも同様に生成
    for(const v of surface) {
        for(const e of v) {
            if(e.type === "tree") {
                const sprite = createSpriteFromEntity(e);
                if(sprite) {
                    registerEventHandlers(sprite, e);
                    entityPlane.addChild(sprite);
                    entityToSprite.set(e, sprite);
                    spriteToEntity.set(sprite, e);
                }
            }
        }
    }

    // コンテナを親に追加
    parent.addChild(terrainPlane);
    parent.addChild(entityPlane);

    return {
        voxelMap,
        parent,
        terrainPlane,
        entityPlane,
        entityToSprite,
        spriteToEntity,
    }
}

