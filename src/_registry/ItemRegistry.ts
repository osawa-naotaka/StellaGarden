import type { InteractionContext } from "./EntityRegistry";

/**
 * エンティティに対応しないアイテムの使用定義。
 * 肥料・水やり・土盛りなど、アイテムをワールドに使用する操作を登録する。
 */
export interface ItemDef {
    readonly itemId: string;

    /** このアイテムをツールとして使用した時に呼ばれる。
     *  true = 処理済み、false = 未処理（次のパスへ）。 */
    onItemUse(ctx: InteractionContext): boolean;
}

// ── 内部ストレージ ──

const itemDefs = new Map<string, ItemDef>();

// ── 登録・取得 API ──

export function registerItem(def: ItemDef): void {
    itemDefs.set(def.itemId, def);
}

export function getItemDef(itemId: string): ItemDef | undefined {
    return itemDefs.get(itemId);
}
