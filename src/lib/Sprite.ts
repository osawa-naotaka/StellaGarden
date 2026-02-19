import { Assets } from "pixi.js";

export async function loadSprite() {
    await Assets.load("/assets/tileset.spritesheet.json");
    await Assets.load("/assets/walk.spritesheet.json");
    await Assets.load("/assets/icons-items.spritesheet.json");
    await Assets.load("/assets/BirchTree.spritesheet.json");
    await Assets.load("/assets/SpringCrops.spritesheet.json");
}

/*
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
                            removeTerrainFromMap(gameState, sprite);
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
*/
