/**
 * axe で撤去可能な施設エンティティの一括登録。
 * 個別に固有ロジックが必要になった場合は個別ファイルに分離する。
 */
import type { ItemId } from "../../_boundary/interfaces";
import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

function registerAxeRemovableFacility(
    entityType: number,
    itemId: ItemId,
    spriteName: string,
    entitySize: { w: number; h: number },
): void {
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

    registerItem({
        itemId,
        placement: {
            entityType,
            entitySize,
            fieldSpriteName: spriteName,
            onPlace(voxelMap, pos) {
                placeFacility(voxelMap, pos, entityType, entitySize);
            },
        },
    });
}

registerAxeRemovableFacility(ENTITY_TYPES.compost_bin, "compost_bin", "ss_sprite_053_3.png", { w: 2, h: 2 });
registerAxeRemovableFacility(ENTITY_TYPES.threshing_machine, "threshing_machine", "ss_sprite_054.png", { w: 2, h: 1 });
registerAxeRemovableFacility(ENTITY_TYPES.screw_presses, "screw_presses", "ss_sprite_055.png", { w: 2, h: 2 });
registerAxeRemovableFacility(ENTITY_TYPES.soaking_basket, "soaking_basket", "ss_sprite_056.png", { w: 3, h: 1 });
registerAxeRemovableFacility(ENTITY_TYPES.scutching_board, "scutching_board", "ss_sprite_057.png", { w: 1, h: 1 });
registerAxeRemovableFacility(ENTITY_TYPES.spinning_wheel, "spinning_wheel", "ss_sprite_058.png", { w: 2, h: 1 });
registerAxeRemovableFacility(ENTITY_TYPES.loom, "loom", "ss_sprite_059.png", { w: 2, h: 2 });
