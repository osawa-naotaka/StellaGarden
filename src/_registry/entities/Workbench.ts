import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { removeFacilityAtPos } from "../facilityUtil";

registerEntity({
    entityType: ENTITY_TYPES.workbench,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_004.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去
        if (ctx.tool === "axe") {
            return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.workbench);
        }
        // pickaxe で撤去（撤去ツール扱い）
        if (ctx.tool === "pickaxe") return false;
        // それ以外 → クラフトUI を開く
        ctx.eventBroker.publish("open_craft_ui", { pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z } });
        return true;
    },
});
