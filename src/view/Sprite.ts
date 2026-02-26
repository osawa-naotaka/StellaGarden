import { Assets } from "pixi.js";

export async function loadSprite() {
    await Assets.load("/assets/tileset.spritesheet.json");
    await Assets.load("/assets/walk.spritesheet.json");
    await Assets.load("/assets/icons-items.spritesheet.json");
    await Assets.load("/assets/BirchTree.spritesheet.json");
    await Assets.load("/assets/SpringCrops.spritesheet.json");
    await Assets.load("/assets/TilesetGrassWaterSpring.spritesheet.json");
    await Assets.load("/assets/TilesetGrassCliffTilesetSpring.spritesheet.json");
    await Assets.load("/assets/RobotoBold.fnt");
}
