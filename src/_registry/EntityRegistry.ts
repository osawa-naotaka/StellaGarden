import type { IEventBroker, IInventoryWriter, ItemId, IVoxelWriter, Pos2D, Pos3D } from "../_boundary/interfaces";
import type { PlacementVariant } from "./ItemRegistry";

/** エンティティスプライト情報: [spriteName, offset-x, offset-y] */
export type EntitySpriteInfo = [string, number, number];

/** onInteract / onItemUse に渡されるコンテキスト */
export interface InteractionContext {
    readonly voxelMap: IVoxelWriter;
    readonly inventory: IInventoryWriter;
    readonly eventBroker: IEventBroker;
    readonly interactPos: Pos3D;
    readonly anchorPos: Pos2D;
    readonly voxel: bigint;
    readonly tool: ItemId | null;
}

/** onDailyTick に渡されるコンテキスト */
export interface DailyTickContext {
    readonly voxelMap: IVoxelWriter;
    readonly pos: Pos3D;
    readonly voxel: bigint;
    readonly isWet: boolean;
}

/**
 * エンティティ定義。スプライト・インタラクション・日次処理を1つにまとめる。
 * 各エンティティは _registry/entities/ にファイルを作り registerEntity() で登録する。
 * アイテム使用（植え付け等）は ItemRegistry に registerItem() で別途登録する。
 */
export interface EntityDef {
    readonly entityType: number;

    /** 配置時のタイルサイズ（w=横タイル数, h=縦タイル数）。 */
    getEntitySize(variant: PlacementVariant): { w: number; h: number };

    /** voxel 値からスプライト情報を返す */
    getSprites(voxel: bigint): EntitySpriteInfo[];

    /** 右クリック: このエンティティが対象地点に存在する時に呼ばれる（例: 収穫・撤去）。
     *  true = 処理済み（後続パスをスキップ）、false = 未処理（後続パスへ進む）。 */
    onInteract?(ctx: InteractionContext): boolean;

    /** 左クリック: このエンティティが対象地点に存在する時に呼ばれる（例: 施設UIの起動）。
     *  true = 処理済み、false = 未処理。 */
    onOpenFacilityUI?(ctx: InteractionContext): boolean;

    /** ゲーム内1日経過時に呼ばれる（例: 作物の成長・焚き火の状態遷移）。 */
    onDailyTick?(ctx: DailyTickContext): void;
}

// ── 内部ストレージ ──

const entityByType = new Map<number, EntityDef>();

// ── 登録・取得 API ──

export function registerEntity(def: EntityDef): void {
    entityByType.set(def.entityType, def);
}

/** entityType からエンティティ定義を取得する */
export function getEntityDef(entityType: number): EntityDef {
    const def = entityByType.get(entityType);
    if (!def) throw new Error(`Entity type ${entityType} is not registered`);
    return def;
}
