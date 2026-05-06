import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import type { InteractionContext } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

registerItem({ itemId: "leaves", displayName: "落ち葉", spriteName: "ss_sprite_006.png", maxStack: 64 });
registerItem({ itemId: "crop_residue", displayName: "作物残渣", spriteName: "ss_sprite_007.png", maxStack: 64 });
registerItem({ itemId: "rope", displayName: "ロープ", spriteName: "ss_sprite_025.png", maxStack: 64 });
registerItem({ itemId: "cloth", displayName: "布", spriteName: "ss_sprite_026.png", maxStack: 64 });
registerItem({ itemId: "bag", displayName: "袋", spriteName: "ss_sprite_027.png", maxStack: 64 });
registerItem({ itemId: "trunk", displayName: "木の幹", spriteName: "ss_sprite_036.png", maxStack: 64 });
registerItem({ itemId: "charcoal", displayName: "木炭", spriteName: "ss_sprite_082.png", maxStack: 64 });
registerItem({ itemId: "blade", displayName: "刃", spriteName: "ss_sprite_084.png", maxStack: 64 });
registerItem({ itemId: "hardwood_teeth", displayName: "硬木の歯", spriteName: "ss_sprite_093.png", maxStack: 64 });
registerItem({ itemId: "board", displayName: "板", spriteName: "ss_sprite_085.png", maxStack: 64 });
registerItem({ itemId: "screw_rod", displayName: "木ネジ棒", spriteName: "ss_sprite_094.png", maxStack: 64 });
registerItem({ itemId: "shaft", displayName: "車軸", spriteName: "ss_sprite_095.png", maxStack: 64 });
registerItem({ itemId: "frame", displayName: "木の枠", spriteName: "ss_sprite_096.png", maxStack: 64 });
registerItem({ itemId: "ingot", displayName: "鉄の棒", spriteName: "ss_sprite_083.png", maxStack: 64 });

registerItem({
    itemId: "hot_meteoric_iron",
    displayName: "熱した隕鉄",
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
