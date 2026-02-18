import { Assets, ColorMatrixFilter, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Entity } from "../Map/Entity";
import type { GameState } from "../State/GameState";
import { createNewSurfaceSpriteFromVoxel, removeEntityFromVoxel, removeVoxelFromMap } from "../TopViewMap/TopViewMap";

export async function loadSprite() {
    await Assets.load("/assets/tileset.spritesheet.json");
    await Assets.load("/assets/walk.spritesheet.json");
    await Assets.load("/assets/icons-items.spritesheet.json");
    await Assets.load("/assets/BirchTree.spritesheet.json");
}

export function createSpriteFromEntity(entity: Entity): Sprite {
    let sprite_name = "";
    let anchor_x = 0.5;
    let anchor_y = 0.5;

    if (entity.type === "soil") {
        if (entity.pos.y === 4) {
            sprite_name = "ground_darkest_5";
        } else if (entity.pos.y === 3) {
            sprite_name = "ground_darker_5";
        } else {
            sprite_name = "ground_normal_5";
        }
    } else if (entity.type === "grass") {
        if (entity.pos.y === 4) {
            sprite_name = "grass_darkest_5";
        } else if (entity.pos.y === 3) {
            sprite_name = "grass_darker_5";
        } else {
            sprite_name = "grass_normal_5";
        }
    } else if (entity.type === "water") {
        sprite_name = "water";
    } else if (entity.type === "tree") {
        sprite_name = "birch_tree_sapling";
        anchor_y = 0.8; // 樹木は下中央を基準点に
    } else {
        throw new Error(`Unknown entity type: ${entity.type}`);
    }

    const sprite = new Sprite(Texture.from(sprite_name));
    sprite.anchor.set(anchor_x, anchor_y);
    sprite.x = entity.pos.x * 16;
    sprite.y = entity.pos.z * 16;

    // スプライトをインタラクティブに設定
    sprite.interactive = true;

    sprite.hitArea = new Rectangle(-8, -8, 16, 16);

    // 当たり判定を可視化（デバッグ用の青い線）
    const tileHitAreaDebug = new Graphics();
    tileHitAreaDebug.rect(-8, -8, 16, 16);
    tileHitAreaDebug.stroke({ width: 1, color: 0x0000ff }); // 青い枠線
    sprite.addChild(tileHitAreaDebug);

    return sprite;
}

export function registerEntityEventHandler(gameState: GameState, sprite: Sprite, entity: Entity) {
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


    switch (entity.type) {
        case "soil":
        case "grass":
            sprite.on("pointerdown", (ev) => {
                if (ev.button === 2) { // 左クリック
                    if (gameState.toolbar.slotEntry[gameState.toolbar.selectedSlot] === "shovel") { // シャベルが選択されている場合
                        if (entity.pos.y > 0) { // 底ではない場合
                            removeVoxelFromMap(gameState, sprite);
                            const [newSprite, newEntity] = createNewSurfaceSpriteFromVoxel(gameState, entity);
                            registerEntityEventHandler(gameState, newSprite, newEntity);
                        }
                    }
                }
            });
            break;
        case "tree":
            sprite.on("pointerdown", (ev) => {
                if (ev.button === 2) { // 左クリック
                    if (gameState.toolbar.slotEntry[gameState.toolbar.selectedSlot] === "axe") { // 斧が選択されている場合
                        removeEntityFromVoxel(gameState, sprite);
                    }
                }
            });
            break;
        default:
            break;
    }
}