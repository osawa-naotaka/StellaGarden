/** インベントリに配置できるアイテムの ID 型。 */
export type ItemId = "watering_can" | "pickaxe" | "axe" | "sickle" | "shovel" | "hoes" | "potato" | "dirt";

export interface ItemDef {
    readonly id: ItemId;
    /** スプライト名。null の場合は仮アイコン（Graphics）で代替する。 */
    readonly spriteName: string | null;
    /** スタック上限数。ツール類は 1。 */
    readonly maxStack: number;
}

export const ITEM_DEFS: Record<ItemId, ItemDef> = {
    watering_can: { id: "watering_can", spriteName: "watering_can", maxStack: 1 },
    pickaxe: { id: "pickaxe", spriteName: "pickaxe", maxStack: 1 },
    axe: { id: "axe", spriteName: "axe", maxStack: 1 },
    sickle: { id: "sickle", spriteName: "sickle", maxStack: 1 },
    shovel: { id: "shovel", spriteName: "shovel", maxStack: 1 },
    hoes: { id: "hoes", spriteName: "hoes", maxStack: 1 },
    potato: { id: "potato", spriteName: "potato_icon", maxStack: 64 },
    dirt: { id: "dirt", spriteName: null, maxStack: 64 },
};
