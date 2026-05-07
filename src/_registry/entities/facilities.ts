/**
 * axe で撤去可能な施設エンティティの一括登録。
 * 個別に固有ロジックが必要になった場合は個別ファイルに分離する。
 */
import type { ItemId } from "../../_boundary/interfaces";
import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

function registerAxeRemovableFacility(
    entityType: number,
    itemId: ItemId,
    displayName: string,
    spriteName: string,
    entitySize: { w: number; h: number },
    inventorySpriteName?: string,
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
        displayName,
        spriteName: inventorySpriteName ?? spriteName,
        maxStack: 64,
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

registerAxeRemovableFacility(ENTITY_TYPES.anvil, "anvil", "金床", "ss_sprite_079.png", { w: 1, h: 1 });
// threshing_machine は ManualProcessing.ts に移行済み
registerAxeRemovableFacility(ENTITY_TYPES.screw_presses, "screw_presses", "搾油機", "ss_sprite_055.png", { w: 2, h: 2 }, "ss_sprite_064.png");
registerAxeRemovableFacility(ENTITY_TYPES.scutching_board, "scutching_board", "叩き台", "ss_sprite_057.png", { w: 1, h: 1 }, "ss_sprite_057.png");
registerAxeRemovableFacility(ENTITY_TYPES.spinning_wheel, "spinning_wheel", "紡ぎ車", "ss_sprite_058.png", { w: 2, h: 1 }, "ss_sprite_066.png");
registerAxeRemovableFacility(ENTITY_TYPES.loom, "loom", "織機", "ss_sprite_059.png", { w: 2, h: 2 }, "ss_sprite_067.png");
