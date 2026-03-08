/** インベントリに配置できるアイテムの ID 型。 */
export type ItemId = "hand" | "watering_can" | "pickaxe" | "axe" | "sickle" | "shovel" | "hoes" | "potato" | "soy" | "flax" | "dirt" | "wood";

export interface ItemDef {
    readonly id: ItemId;
    /** スプライト名。null の場合は仮アイコン（Graphics）で代替する。 */
    readonly spriteName: string | null;
    /** spriteName が null のときに使う仮アイコンの色。 */
    readonly placeholderColor?: number;
    /** スタック上限数。ツール類は 1。 */
    readonly maxStack: number;
}

export const ITEM_DEFS: Record<ItemId, ItemDef> = {
    hand: { id: "hand", spriteName: "ss_sprite_002.png", maxStack: 1 },
    watering_can: { id: "watering_can", spriteName: "watering_can", maxStack: 1 },
    pickaxe: { id: "pickaxe", spriteName: "pickaxe", maxStack: 1 },
    axe: { id: "axe", spriteName: "axe", maxStack: 1 },
    sickle: { id: "sickle", spriteName: "sickle", maxStack: 1 },
    shovel: { id: "shovel", spriteName: "shovel", maxStack: 1 },
    hoes: { id: "hoes", spriteName: "ss_sprite_001.png", maxStack: 1 },
    potato: { id: "potato", spriteName: "ss_sprite_009.png", maxStack: 64 },
    soy: { id: "soy", spriteName: "ss_sprite_015.png", maxStack: 64 },
    flax: { id: "flax", spriteName: "ss_sprite_021.png", maxStack: 64 },
    dirt: { id: "dirt", spriteName: "tile_027.png", maxStack: 64 },
    wood: { id: "wood", spriteName: "tile_048.png", maxStack: 64 },
};
