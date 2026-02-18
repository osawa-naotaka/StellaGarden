import { Assets, ColorMatrixFilter, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Entity } from "../Map/Entity";

export async function loadSprite() {
    await Assets.load("/assets/tileset.spritesheet.json");
    await Assets.load("/assets/walk.spritesheet.json");
    await Assets.load("/assets/icons-items.spritesheet.json");
    await Assets.load("/assets/BirchTree.spritesheet.json");
}

export function createSpriteFromEntity(entity: Entity): Sprite | null {
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
        return null;
    }

    const sprite = new Sprite(Texture.from(sprite_name));
    sprite.anchor.set(anchor_x, anchor_y);
    sprite.x = entity.pos.x * 16;
    sprite.y = entity.pos.z * 16;

    // スプライトをインタラクティブに設定
    sprite.interactive = true;

    // 菱形の当たり判定を設定（透明部分を無視）
    // タイルサイズに合わせて菱形の頂点を定義
    sprite.hitArea = new Rectangle(-8, -8, 16, 16);

    // 当たり判定を可視化（デバッグ用の青い線）
    const tileHitAreaDebug = new Graphics();
    tileHitAreaDebug.rect(-8, -8, 16, 16);
    tileHitAreaDebug.stroke({ width: 1, color: 0x0000ff }); // 青い枠線
    sprite.addChild(tileHitAreaDebug);

    // 明度を上げるフィルターを作成
    const brightnessFilter = new ColorMatrixFilter();
    brightnessFilter.brightness(1.5, false); // 明度を50%上げる

    // ホバー時のハイライト
    sprite.on("pointerover", () => {
        sprite.filters = [brightnessFilter];
    });

    sprite.on("pointerout", () => {
        sprite.filters = null; // フィルターを解除
    });

    return sprite;
}

export function registerEventHandlers(sprite: Sprite, entity: Entity) {
    // 明度を上げるフィルターを作成
    const brightnessFilter = new ColorMatrixFilter();
    brightnessFilter.brightness(1.5, false); // 明度を50%上げる

    // common handler
    sprite.on("pointerover", () => {
        console.log(`Hovered over ${entity.type} at (${entity.pos.x}, ${entity.pos.y}, ${entity.pos.z})`);
        sprite.filters = [brightnessFilter];
    });

    sprite.on("pointerout", () => {
        console.log(`Pointer out from ${entity.type} at (${entity.pos.x}, ${entity.pos.y}, ${entity.pos.z})`);
        sprite.filters = null; // フィルターを解除
    });


    switch (entity.type) {
        case "soil":
        case "grass":
            sprite.on("pointerdown", () => {
                console.log(`Clicked on ${entity.type} at (${entity.pos.x}, ${entity.pos.y}, ${entity.pos.z})`);
            });
            break;
        case "tree":
            sprite.on("pointerdown", () => {
                console.log(`Clicked on ${entity.type} at (${entity.pos.x}, ${entity.pos.y}, ${entity.pos.z})`);
            });
            break;
        default:
            break;
    }
}