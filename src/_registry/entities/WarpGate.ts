import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const WARP_SPRITES: EntitySpriteInfo[][] = [[["ss_sprite_105_1.png", 0, 0]], [["ss_sprite_105_2.png", 0, 0]], [["ss_sprite_105_3.png", 0, 0]]];
const ANIM_FRAME_MS = 100;

registerEntity({
    entityType: ENTITY_TYPES.warp_gate,

    getEntitySize() {
        return { w: 2, h: 3 };
    },

    getSprites(): EntitySpriteInfo[] {
        const frame = Math.floor(Date.now() / ANIM_FRAME_MS) % 3;
        return WARP_SPRITES[frame];
    },

    onInteract(ctx: InteractionContext): boolean {
        // axe で撤去
        if (ctx.tool !== "axe") return false;
        const warpGate = ctx.storageVault.get<SlotStorage>("warp_gate");
        const extraItems = warpGate.collectAllStacks(ctx.anchorPos);
        const removed = removeFacilityByContext(ctx, extraItems);
        if (removed) warpGate.remove(ctx.anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_warp_gate_ui", { pos: ctx.anchorPos });
        return true;
    },
});

// ── アイテム登録（点火前の焚き火を配置するアイテム）──

registerItem({
    itemId: "warp_gate",
    displayName: "転移ゲート",
    spriteName: "ss_sprite_104.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.warp_gate,
        fieldSpriteName: "ss_sprite_105_1.png",
        onPlace(voxelMap, pos, _variant, storageVault) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.warp_gate, { w: 2, h: 3 });
            storageVault.get<SlotStorage>("warp_gate").create(pos);
        },
    },
});

export const WARP_GATE_SLOT_COUNT = 32;

registerStorageFactory("warp_gate", () => new SlotStorage({ main: WARP_GATE_SLOT_COUNT }));
