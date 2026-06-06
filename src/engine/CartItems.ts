import type { ItemId } from "./ItemDefs";
import { ENTITY_TYPES, FERTILIZER_TYPES } from "./VoxelDefs";

/**
 * 台車のアタッチメントスロットに装着可能なアイテム ID の allowlist。
 * view/CartPanel がこれを参照して装着制限 UI を実装する。
 */
export const CART_ATTACHMENT_ALLOWED: ReadonlySet<ItemId> = new Set<ItemId>(["sickle"]);

/**
 * 種・種イモのアイテム ID → エンティティタイプのマッピング。
 * 散布処理で植え付け対象の作物タイプを特定するために使う。
 */
export const SEED_TO_ENTITY: ReadonlyMap<ItemId, number> = new Map<ItemId, number>([
    ["potato", ENTITY_TYPES.potato],
    ["soybeans", ENTITY_TYPES.soy],
    ["flaxseed", ENTITY_TYPES.flax],
    ["sunflower_seed", ENTITY_TYPES.sunflower],
    ["wheat", ENTITY_TYPES.wheat],
]);

/**
 * 肥料アイテム ID → 肥料タイプのマッピング。
 * 散布処理で施肥対象の肥料タイプを特定するために使う。
 */
export const FERTILIZER_ITEMS: ReadonlyMap<ItemId, number> = new Map<ItemId, number>([
    ["compost", FERTILIZER_TYPES.compost],
    ["plant_ashes", FERTILIZER_TYPES.plant_ashes],
    ["oil_cake", FERTILIZER_TYPES.oil_cake],
]);
