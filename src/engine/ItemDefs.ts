/** インベントリに配置できるアイテムの ID 型。 */
export type ItemId =
    | "hand"
    | "watering_can"
    | "pickaxe"
    | "axe"
    | "sickle"
    | "shovel"
    | "hoes"
    | "potato"
    | "soybeans"
    | "flaxseed"
    | "dirt"
    | "workbench"
    | "stem"
    | "leaves"
    | "crop_residue"
    | "pods"
    | "soybean_oil"
    | "bagged_soybeans"
    | "flax_stalk"
    | "flax_fiber"
    | "thread"
    | "rope"
    | "cloth"
    | "bag"
    | "flaxseed_oil"
    | "sunflower_seed"
    | "trunk"
    | "nuts"
    | "compost"
    | "plant_ashes"
    | "oil_cake"
    | "forge"
    | "compost_bin"
    | "threshing_machine"
    | "screw_presses"
    | "soaking_basket"
    | "scutching_board"
    | "spinning_wheel"
    | "loom"
    ;

export interface ItemDef {
    readonly id: ItemId;
    /** スプライト名。null の場合は仮アイコン（Graphics）で代替する。 */
    readonly spriteName: string | null;
    /** spriteName が null のときに使う仮アイコンの色。 */
    readonly placeholderColor?: number;
    /** スタック上限数。ツール類は 1。 */
    readonly maxStack: number;
    /** フィールドに配置可能かどうか。 */
    readonly placeable?: boolean;
    /** 配置時のタイルサイズ（w=横タイル数, h=縦タイル数）。placeable が true のときのみ有効。 */
    readonly entitySize?: { readonly w: number; readonly h: number };
    /** 配置時に使うエンティティタイプ（ENTITY_TYPES の値）。placeable が true のときのみ有効。 */
    readonly entityType?: number;
    /** フィールドに配置した時のスプライト名。placeable が true のときのみ有効。 */
    readonly fieldSpriteName?: string;
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
    soybeans: { id: "soybeans", spriteName: "ss_sprite_015.png", maxStack: 64 },
    flaxseed: { id: "flaxseed", spriteName: "ss_sprite_021.png", maxStack: 64 },
    dirt: { id: "dirt", spriteName: "ss_sprite_046.png", maxStack: 64 },
    workbench: { id: "workbench", spriteName: "ss_sprite_003.png", maxStack: 1, placeable: true, entitySize: { w: 2, h: 1 }, entityType: 6, fieldSpriteName: "ss_sprite_004.png" },
    stem: { id: "stem", spriteName: "ss_sprite_005.png", maxStack: 64 },
    leaves: { id: "leaves", spriteName: "ss_sprite_006.png", maxStack: 64 },
    crop_residue: { id: "crop_residue", spriteName: "ss_sprite_007.png", maxStack: 64 },
    pods: { id: "pods", spriteName: "ss_sprite_014.png", maxStack: 64 },
    soybean_oil: { id: "soybean_oil", spriteName: "ss_sprite_016.png", maxStack: 64 },
    bagged_soybeans: { id: "bagged_soybeans", spriteName: "ss_sprite_017.png", maxStack: 64 },
    flax_stalk: { id: "flax_stalk", spriteName: "ss_sprite_022.png", maxStack: 64 },
    flax_fiber: { id: "flax_fiber", spriteName: "ss_sprite_023.png", maxStack: 64 },
    thread: { id: "thread", spriteName: "ss_sprite_024.png", maxStack: 64 },
    rope: { id: "rope", spriteName: "ss_sprite_025.png", maxStack: 64 },
    cloth: { id: "cloth", spriteName: "ss_sprite_026.png", maxStack: 64 },
    bag: { id: "bag", spriteName: "ss_sprite_027.png", maxStack: 64 },
    flaxseed_oil: { id: "flaxseed_oil", spriteName: "ss_sprite_028.png", maxStack: 64 },
    sunflower_seed: { id: "sunflower_seed", spriteName: "ss_sprite_032.png", maxStack: 64 },
    trunk: { id: "trunk", spriteName: "ss_sprite_036.png", maxStack: 64 },
    nuts: { id: "nuts", spriteName: "ss_sprite_037.png", maxStack: 64 },
    compost: { id: "compost", spriteName: "ss_sprite_042.png", maxStack: 64 },
    plant_ashes: { id: "plant_ashes", spriteName: "ss_sprite_043.png", maxStack: 64 },
    oil_cake: { id: "oil_cake", spriteName: "ss_sprite_044.png", maxStack: 64 },
    forge: { id: "forge", spriteName: "ss_sprite_052.png", maxStack: 1, placeable: true, entitySize: { w: 1, h: 1 }, entityType: 8, fieldSpriteName: "ss_sprite_052.png" },
    compost_bin: { id: "compost_bin", spriteName: "ss_sprite_053_3.png", maxStack: 1, placeable: true, entitySize: { w: 2, h: 2 }, entityType: 9, fieldSpriteName: "ss_sprite_053_3.png" },
    threshing_machine: { id: "threshing_machine", spriteName: "ss_sprite_054.png", maxStack: 1, placeable: true, entitySize: { w: 2, h: 1 }, entityType: 10, fieldSpriteName: "ss_sprite_054.png" },
    screw_presses: { id: "screw_presses", spriteName: "ss_sprite_055.png", maxStack: 1, placeable: true, entitySize: { w: 2, h: 2 }, entityType: 11, fieldSpriteName: "ss_sprite_055.png" },
    soaking_basket: { id: "soaking_basket", spriteName: "ss_sprite_056.png", maxStack: 1, placeable: true, entitySize: { w: 3, h: 1 }, entityType: 12, fieldSpriteName: "ss_sprite_056.png" },
    scutching_board: { id: "scutching_board", spriteName: "ss_sprite_057.png", maxStack: 1, placeable: true, entitySize: { w: 1, h: 1 }, entityType: 13, fieldSpriteName: "ss_sprite_057.png" },
    spinning_wheel: { id: "spinning_wheel", spriteName: "ss_sprite_058.png", maxStack: 1, placeable: true, entitySize: { w: 2, h: 1 }, entityType: 14, fieldSpriteName: "ss_sprite_058.png" },
    loom: { id: "loom", spriteName: "ss_sprite_059.png", maxStack: 1, placeable: true, entitySize: { w: 2, h: 2 }, entityType: 15, fieldSpriteName: "ss_sprite_059.png" },
};
