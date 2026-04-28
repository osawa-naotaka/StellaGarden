import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import type { InteractionContext } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

registerItem({ itemId: "leaves", spriteName: "ss_sprite_006.png", maxStack: 64 });
registerItem({ itemId: "crop_residue", spriteName: "ss_sprite_007.png", maxStack: 64 });
registerItem({ itemId: "rope", spriteName: "ss_sprite_025.png", maxStack: 64 });
registerItem({ itemId: "cloth", spriteName: "ss_sprite_026.png", maxStack: 64 });
registerItem({ itemId: "bag", spriteName: "ss_sprite_027.png", maxStack: 64 });
registerItem({ itemId: "trunk", spriteName: "ss_sprite_036.png", maxStack: 64 });
registerItem({ itemId: "charcoal", spriteName: "ss_sprite_082.png", maxStack: 64 });
registerItem({ itemId: "blade", spriteName: "ss_sprite_084.png", maxStack: 64 });
registerItem({ itemId: "hardwood_teeth", spriteName: "ss_sprite_093.png", maxStack: 64 });
registerItem({ itemId: "board", spriteName: "ss_sprite_085.png", maxStack: 64 });
registerItem({ itemId: "screw_rod", spriteName: "ss_sprite_094.png", maxStack: 64 });
registerItem({ itemId: "shaft", spriteName: "ss_sprite_095.png", maxStack: 64 });
registerItem({ itemId: "frame", spriteName: "ss_sprite_096.png", maxStack: 64 });
registerItem({ itemId: "ingot", spriteName: "ss_sprite_083.png", maxStack: 64 });



registerItem({
    itemId: "hot_meteoric_iron",
    spriteName: "ss_sprite_088.png",
    maxStack: 64,
    onItemUse: (ctx: InteractionContext): boolean => {
        if (ctx.entityType === ENTITY_TYPES.anvil) {
            if (!ctx.inventory.addItems([{ itemId: "blade", count: 1 }])) return false;
            ctx.inventory.consumeSelectedItem(1);
            return true;
        }
        return false;
    },
});
