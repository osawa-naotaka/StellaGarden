import { Container, Sprite } from "pixi.js";
import { Terrain, type Entity } from "../Map/Entity";
import { VoxelMap } from "../lib/VoxelMap";
import { generateTerrain } from "../Map/Terrain";
import { createSpriteFromEntity, registerEntityEventHandler } from "../lib/Sprite";
import type { GameState } from "../State/GameState";

export type TopViewMap = {
    voxelMap: VoxelMap<Terrain>;
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
    const voxelMap = new VoxelMap<Terrain>(100, 5, 100, 2);
    generateTerrain(voxelMap);

    // Terrainセルに対応するスプライトを生成
    const surface = voxelMap.getSurfaceVoxels();
    for(const v of surface) {
        if(v) {
            const sprite = createSpriteFromEntity(v);
            terrainPlane.addChild(sprite);
            entityToSprite.set(v, sprite);
            spriteToEntity.set(sprite, v);
        }
    }

    // StaticEntityやDynamicEntityのスプライトも同様に生成
    for(const v of surface) {
        for(const e of v.entities) {
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

export function removeTerrainFromMap(gameState: GameState, sprite: Sprite) {
    const entity = gameState.topViewMap.spriteToEntity.get(sprite);
    if(entity instanceof Terrain) {
        // 地形セルの上にあるエンティティとスプライトを削除
        for(const e of entity.entities) {
            const s = gameState.topViewMap.entityToSprite.get(e);
            if(!s) throw new Error("Sprite not found for entity on top of terrain");

            s.parent?.removeChild(s);
            gameState.topViewMap.entityToSprite.delete(e);
            gameState.topViewMap.spriteToEntity.delete(s);
        }

        // 地形セルのスプライトを削除
        sprite.parent?.removeChild(sprite);
        gameState.topViewMap.entityToSprite.delete(entity);
        gameState.topViewMap.spriteToEntity.delete(sprite);
        gameState.topViewMap.voxelMap.remove(entity);
    }
}

export function createNewSurfaceSpriteFromVoxel(gameState: GameState, removed: Entity): [Sprite, Entity] {
    const terrain = gameState.topViewMap.voxelMap.getSurfaceVoxel(removed.pos);
    if(!terrain) throw new Error("No surface voxel found");

    const sprite = createSpriteFromEntity(terrain);
    if(!sprite) throw new Error("Failed to create sprite from entity");

    gameState.topViewMap.terrainPlane.addChild(sprite);
    gameState.topViewMap.entityToSprite.set(terrain, sprite);
    gameState.topViewMap.spriteToEntity.set(sprite, terrain);
    
    return [sprite, terrain];
}

export function removeEntityFromVoxel(gameState: GameState, sprite: Sprite) {
    const entity = gameState.topViewMap.spriteToEntity.get(sprite);
    if(!entity) throw new Error("Entity not found for sprite");
    
    const voxel = gameState.topViewMap.voxelMap.get(entity.pos);
    if(!voxel) throw new Error("Voxel not found for entity position");

    if(voxel instanceof Terrain) {
        voxel.remomveEntity(entity);
        sprite.parent?.removeChild(sprite);
        gameState.topViewMap.entityToSprite.delete(entity);
        gameState.topViewMap.spriteToEntity.delete(sprite);
    } else {
        throw new Error("Expected voxel to be Terrain");
    }
}