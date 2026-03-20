import { Assets } from "pixi.js";

export async function loadSprite() {
    await Assets.load("/assets/farmrpg.spritesheet.json");
    await Assets.load("/assets/TilesetGrassWaterSpring.spritesheet.json");
    await Assets.load("/assets/TilesetGrassSpring.spritesheet.json");
    await Assets.load("/assets/TilledSoilAndWetSoil.spritesheet.json");
    await Assets.load("/assets/ss.spritesheet.json");
    await Assets.load("/assets/roboto.fnt");
}
