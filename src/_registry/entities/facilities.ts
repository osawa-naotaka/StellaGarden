/**
 * axe で撤去可能な施設エンティティの一括登録。
 * 個別に固有ロジックが必要になった場合は個別ファイルに分離する。
 */
import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { removeFacilityAtPos } from "../facilityUtil";

function registerAxeRemovableFacility(entityType: number, spriteName: string): void {
    registerEntity({
        entityType,

        getSprites(): EntitySpriteInfo[] {
            return [[spriteName, 0, 0]];
        },

        onInteract(ctx: InteractionContext): boolean {
            if (ctx.tool !== "axe") return false;
            return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, entityType);
        },
    });
}

registerAxeRemovableFacility(ENTITY_TYPES.compost_bin, "ss_sprite_053_3.png");
registerAxeRemovableFacility(ENTITY_TYPES.threshing_machine, "ss_sprite_054.png");
registerAxeRemovableFacility(ENTITY_TYPES.screw_presses, "ss_sprite_055.png");
registerAxeRemovableFacility(ENTITY_TYPES.soaking_basket, "ss_sprite_056.png");
registerAxeRemovableFacility(ENTITY_TYPES.scutching_board, "ss_sprite_057.png");
registerAxeRemovableFacility(ENTITY_TYPES.spinning_wheel, "ss_sprite_058.png");
registerAxeRemovableFacility(ENTITY_TYPES.loom, "ss_sprite_059.png");
