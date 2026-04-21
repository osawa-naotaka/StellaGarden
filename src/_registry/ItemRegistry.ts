import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import type { InteractionContext } from "./EntityRegistry";

/** 配置可能アイテムの向きバリアント。 */
export type PlacementVariant = "horizontal" | "vertical";

/** 配置可能アイテムの配置情報。 */
export interface PlacementInfo {
    /** 配置時に使うエンティティタイプ（ENTITY_TYPES の値）。 */
    readonly entityType: number;
    /** 配置時のタイルサイズ（w=横タイル数, h=縦タイル数）。 */
    readonly entitySize: { readonly w: number; readonly h: number };
    /** 配置開始時のデフォルト向き。 */
    readonly defaultVariant?: PlacementVariant;
    /** フィールドに配置した時のスプライト名。 */
    readonly fieldSpriteName?: string;
    /** 配置中プレビューに使うスプライト名を返す。 */
    getFieldSpriteName?(variant: PlacementVariant): string;
    /** 配置確定時に呼ばれる。voxelMap への書き込みを行う。 */
    onPlace(voxelMap: IVoxelWriter, pos: Pos2D, variant: PlacementVariant): void;
}

/**
 * アイテム定義。全アイテムの情報源。
 * スプライト名・スタック上限・ワールド使用・配置情報を1つにまとめる。
 */
export interface ItemDef {
    readonly itemId: string;

    /** インベントリ表示用のスプライト名。null の場合は仮アイコン（Graphics）で代替する。 */
    readonly spriteName: string | null;
    /** spriteName が null のときに使う仮アイコンの色。 */
    readonly placeholderColor?: number;
    /** スタック上限数。ツール類は 1。 */
    readonly maxStack: number;

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

/**
 * アイテムを追加の entityType にも関連付ける。
 * 使い捨て施設など、配置時と消火後で entityType が異なる場合に使う。
 * findFacilityAnchor が全状態のアンカーを解決できるようにする。
 */
export function registerItemAlias(entityType: number, itemId: string): void {
    const def = itemDefs.get(itemId);
    if (def) itemByEntityType.set(entityType, def);
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
