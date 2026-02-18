import { Container, Sprite } from "pixi.js";
import type { Entity } from "../Map/Entity";
import { VoxelMap } from "../lib/VoxelMap";
import { generateTerrain, getTerrainEntity } from "../Map/Terrain";
import { createSpriteFromEntity, registerEntityEventHandler } from "../lib/Sprite";
import type { GameState } from "../State/GameState";

export type TopViewMap = {
    voxelMap: VoxelMap<Entity>;
    parent: Container;
    terrainPlane: Container;
    entityPlane: Container;
    entityToSprite: Map<Entity, Sprite>;
    spriteToEntity: Map<Sprite, Entity>;
};

export function createTopViewMap(parent: Container): TopViewMap {
    const entityToSprite = new Map<Entity, Sprite>();
    const spriteToEntity = new Map<Sprite, Entity>();

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
            terrainPlane.addChild(sprite);
            entityToSprite.set(se, sprite);
            spriteToEntity.set(sprite, se);
        }
    }

    // StaticEntityやDynamicEntityのスプライトも同様に生成
    for(const v of surface) {
        for(const e of v) {
            if(e.type === "tree") {
                const sprite = createSpriteFromEntity(e);
                entityPlane.addChild(sprite);
                entityToSprite.set(e, sprite);
                spriteToEntity.set(sprite, e);
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

export function registerEntityEventHandlers(gameState: GameState) {
    for (const [entity, sprite] of gameState.topViewMap.entityToSprite.entries()) {
        registerEntityEventHandler(gameState, sprite, entity);
    }
}

export function removeVoxelFromMap(gameState: GameState, sprite: Sprite) {
    const entity = gameState.topViewMap.spriteToEntity.get(sprite);
    if(entity) {
        gameState.topViewMap.voxelMap.remove(entity);
        sprite.parent?.removeChild(sprite);
        gameState.topViewMap.entityToSprite.delete(entity);
        gameState.topViewMap.spriteToEntity.delete(sprite);
    }
}

export function createNewSurfaceSpriteFromVoxel(gameState: GameState, removed: Entity): [Sprite, Entity] {
    const v = gameState.topViewMap.voxelMap.getSurfaceVoxel(removed.pos);
    if(!v) throw new Error("No surface voxel found");

    const entity = getTerrainEntity(v);
    if(!entity) throw new Error("No terrain entity found");

    const sprite = createSpriteFromEntity(entity);
    if(!sprite) throw new Error("Failed to create sprite from entity");

    gameState.topViewMap.terrainPlane.addChild(sprite);
    gameState.topViewMap.entityToSprite.set(entity, sprite);
    gameState.topViewMap.spriteToEntity.set(sprite, entity);
    
    return [sprite, entity];
}

export function removeEntityFromVoxel(gameState: GameState, sprite: Sprite) {
    const entity = gameState.topViewMap.spriteToEntity.get(sprite);
    if(!entity) throw new Error("Entity not found for sprite");
    
    gameState.topViewMap.voxelMap.remove(entity);
    sprite.parent?.removeChild(sprite);
    gameState.topViewMap.entityToSprite.delete(entity);
    gameState.topViewMap.spriteToEntity.delete(sprite);
}