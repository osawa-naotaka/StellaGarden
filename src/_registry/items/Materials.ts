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
registerItem({ itemId: "frame", displayName: "木の枠", spriteName: "ss_sprite_096.png", maxStack: 64 });
registerItem({ itemId: "ingot", displayName: "鉄の棒", spriteName: "ss_sprite_083.png", maxStack: 64 });
registerItem({ itemId: "hot_meteoric_iron", displayName: "熱した隕鉄", spriteName: "ss_sprite_088.png", maxStack: 64 });

// 機械中間素材（スプライト未作成のため仮アイコンで表示）
registerItem({ itemId: "wooden_gear", displayName: "木製歯車", spriteName: null, placeholderColor: 0xa0703c, maxStack: 64 });
registerItem({ itemId: "bevel_gear", displayName: "ベベルギア", spriteName: null, placeholderColor: 0x8c5a2c, maxStack: 64 });
registerItem({ itemId: "wheel", displayName: "木製ホイール", spriteName: null, placeholderColor: 0xc08654, maxStack: 64 });
registerItem({ itemId: "drum", displayName: "ドラム", spriteName: null, placeholderColor: 0x946028, maxStack: 64 });
registerItem({ itemId: "pulley", displayName: "プーリー", spriteName: null, placeholderColor: 0xb47840, maxStack: 64 });
registerItem({ itemId: "iron_teeth", displayName: "扱き歯", spriteName: null, placeholderColor: 0x707080, maxStack: 64 });

// 醸造・発酵（doc/26）。スプライト未作成のため仮アイコン（色付き矩形）で表示する。
// 加工施設の配置アイテム（saltpan / koji_muro / fermentation_vat / distiller）は各エンティティ定義側で登録する。
registerItem({ itemId: "salt", displayName: "塩", spriteName: null, placeholderColor: 0xeeeeee, maxStack: 64 });
registerItem({ itemId: "steamed_wheat", displayName: "蒸麦", spriteName: null, placeholderColor: 0xe8d8a0, maxStack: 64 });
registerItem({ itemId: "roasted_wheat", displayName: "炒り麦", spriteName: null, placeholderColor: 0xc89858, maxStack: 64 });
registerItem({ itemId: "steamed_soybeans", displayName: "蒸し大豆", spriteName: null, placeholderColor: 0xcdd98a, maxStack: 64 });
registerItem({ itemId: "koji", displayName: "麹", spriteName: null, placeholderColor: 0xdcd0a0, maxStack: 64 });
registerItem({ itemId: "wheat_moromi", displayName: "麦もろみ", spriteName: null, placeholderColor: 0xd8cba0, maxStack: 64 });
registerItem({ itemId: "shochu", displayName: "麦焼酎", spriteName: null, placeholderColor: 0xe0e8e8, maxStack: 64 });
registerItem({ itemId: "aged_shochu", displayName: "熟成麦焼酎", spriteName: null, placeholderColor: 0xc8923c, maxStack: 64 });
registerItem({ itemId: "vinegar", displayName: "酢", spriteName: null, placeholderColor: 0xd8c070, maxStack: 64 });
registerItem({ itemId: "miso", displayName: "味噌", spriteName: null, placeholderColor: 0x9c6b3c, maxStack: 64 });
registerItem({ itemId: "soy_sauce_moromi", displayName: "醤油もろみ", spriteName: null, placeholderColor: 0x6b4a2a, maxStack: 64 });
registerItem({ itemId: "soy_sauce", displayName: "醤油", spriteName: null, placeholderColor: 0x3a2415, maxStack: 64 });
registerItem({ itemId: "soy_sauce_lees", displayName: "醤油粕", spriteName: null, placeholderColor: 0xa0805a, maxStack: 64 });
