import type { IEventBroker, IInventoryWriter, IVoxelWriter, ItemId, Pos3D } from "../_boundary/interfaces";

/** エンティティスプライト情報: [spriteName, offset-x, offset-y] */
export type EntitySpriteInfo = [string, number, number];

/** onInteract / onItemUse に渡されるコンテキスト */
export interface InteractionContext {
    readonly voxelMap: IVoxelWriter;
    readonly inventory: IInventoryWriter;
    readonly eventBroker: IEventBroker;
    readonly surfacePos: Pos3D;
    readonly voxel: number;
    readonly tool: ItemId | null;
}

/**
 * エンティティ定義。スプライト・インタラクション・パラメータを1つにまとめる。
 * 各エンティティは _registry/entities/ にファイルを作り registerEntity() で登録する。
 */
export interface EntityDef {
    readonly entityType: number;
    /** 対応する ItemId（アイテム使用時ディスパッチに使う）。植え付け可能な作物等で設定する。 */
    readonly itemId?: ItemId;

    /** voxel 値からスプライト情報を返す */
    getSprites(voxel: number): EntitySpriteInfo[];

    /** このエンティティが対象地点に存在する時に呼ばれる（例: 収穫）。
     *  true = 処理済み（フォールバックをスキップ）、false = 未処理（フォールバックへ進む）。 */
    onInteract?(ctx: InteractionContext): boolean;

    /** このエンティティに対応するアイテムをツールとして使用した時に呼ばれる（例: 植え付け）。
     *  true = 処理済み、false = 未処理。 */
    onItemUse?(ctx: InteractionContext): boolean;
}

// ── 内部ストレージ ──

const entityByType = new Map<number, EntityDef>();
const entityByItemId = new Map<string, EntityDef>();

// ── 登録・取得 API ──

export function registerEntity(def: EntityDef): void {
    entityByType.set(def.entityType, def);
    if (def.itemId) {
        entityByItemId.set(def.itemId, def);
    }
}

/** entityType からエンティティ定義を取得する */
export function getEntityDef(entityType: number): EntityDef | undefined {
    return entityByType.get(entityType);
}

/** ItemId からエンティティ定義を取得する（植え付け等のアイテム使用時ディスパッチ用） */
export function getEntityDefByItemId(itemId: string): EntityDef | undefined {
    return entityByItemId.get(itemId);
}
