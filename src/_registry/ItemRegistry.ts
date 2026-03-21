import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import type { InteractionContext } from "./EntityRegistry";

/** 配置可能アイテムの配置情報。 */
export interface PlacementInfo {
    /** 配置時に使うエンティティタイプ（ENTITY_TYPES の値）。 */
    readonly entityType: number;
    /** 配置時のタイルサイズ（w=横タイル数, h=縦タイル数）。 */
    readonly entitySize: { readonly w: number; readonly h: number };
    /** フィールドに配置した時のスプライト名。 */
    readonly fieldSpriteName: string;
    /** 配置確定時に呼ばれる。voxelMap への書き込みを行う。 */
    onPlace(voxelMap: IVoxelWriter, pos: Pos2D): void;
}

/**
 * アイテム使用定義。
 * 植え付け・肥料・水やり・土盛りなど、アイテムをワールドに使用する操作を登録する。
 * 配置可能アイテム（施設等）は placement フィールドで配置情報を持つ。
 */
export interface ItemDef {
    readonly itemId: string;

    /** このアイテムをツールとして使用した時に呼ばれる。
     *  true = 処理済み、false = 未処理（次のパスへ）。 */
    onItemUse?(ctx: InteractionContext): boolean;

    /** 配置可能アイテムの場合に設定する。 */
    readonly placement?: PlacementInfo;
}

// ── 内部ストレージ ──

const itemDefs = new Map<string, ItemDef>();
const itemByEntityType = new Map<number, ItemDef>();

// ── 登録・取得 API ──

export function registerItem(def: ItemDef): void {
    itemDefs.set(def.itemId, def);
    if (def.placement) {
        itemByEntityType.set(def.placement.entityType, def);
    }
}

export function getItemDef(itemId: string): ItemDef | undefined {
    return itemDefs.get(itemId);
}

/** entityType からアイテム定義を取得する（施設撤去時のアンカー解決用） */
export function getItemDefByEntityType(entityType: number): ItemDef | undefined {
    return itemByEntityType.get(entityType);
}

/** itemId が配置可能かどうかを返す */
export function isPlaceable(itemId: string): boolean {
    return getItemDef(itemId)?.placement != null;
}

/** itemId から PlacementInfo を取得する */
export function getPlacementInfo(itemId: string): PlacementInfo | undefined {
    return getItemDef(itemId)?.placement;
}
