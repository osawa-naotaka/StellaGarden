import { defaultPowerConnectionPositions, registerPowerSink } from "../../engine/PowerSinkRegistry";
import { recomputeAllShaftPowerFlow } from "../../engine/ShaftPowerFlow";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const WINCH_SIZE = { w: 1, h: 2 } as const;

registerPowerSink({
    entityType: ENTITY_TYPES.winch,
    getSize: () => WINCH_SIZE,
    getPowerConnectionPositions: defaultPowerConnectionPositions,
});

registerEntity({
    entityType: ENTITY_TYPES.winch,

    getEntitySize() {
        return WINCH_SIZE;
    },

    getSprites(): EntitySpriteInfo[] {
        return [["winch", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去
        if (ctx.tool === "axe") {
            const removed = removeFacilityByContext(ctx);
            if (removed) recomputeAllShaftPowerFlow(ctx.voxelMap);
            return removed;
        }
        return false;
    },
});

registerItem({
    itemId: "winch",
    displayName: "ウインチ",
    spriteName: "winch",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.winch,
        getFieldSpriteName() {
            return "winch";
        },
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.winch, WINCH_SIZE);
            recomputeAllShaftPowerFlow(voxelMap);
        },
    },
});
