/**
 * カテゴリ3（日次処理）施設のエンティティ登録ヘルパー。
 *
 * 対象: compost_bin / soaking_basket / bonfire / kiln
 *
 * 操作:
 *  - 右クリック (onPrimaryInteract) → open_processing_daily_ui を発行（UI起動）
 *  - 左クリック (onInteract) + axe → 撤去（empty 状態かつ storage 空のときのみ）
 *
 * 状態遷移は DailyProcessingStorage が voxel の entityType と growthStage を
 * 自動的に書き換えることで実現する。
 */
import type { ItemId } from "../../_boundary/interfaces";
import type { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { setDailyStateMapping, type DailyStateMapping } from "../dailyProcessingRegistry";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { registerItem, registerItemAlias } from "../ItemRegistry";

let dailyProcessingStorage: DailyProcessingStorage | null = null;

/** App / hooks 層から DailyProcessingStorage を注入する。 */
export function setDailyProcessingStorage(storage: DailyProcessingStorage): void {
    dailyProcessingStorage = storage;
}

/** 各状態のフィールドスプライト。文字列または、毎回呼ばれる関数（アニメーション用）。 */
type SpriteSpec = string | (() => string);

interface DailyProcessingEntityOptions {
    /** empty 状態 = ベース entityType。 */
    baseEntityType: number;
    /** 状態ごとの entityType。重複していてもよい。 */
    stateEntityTypes: DailyStateMapping;
    /** 状態ごとのフィールドスプライト名（または関数）。 */
    sprites: Record<"empty" | "loading" | "progressing" | "done", SpriteSpec>;
    /** インベントリアイテムの itemId。 */
    itemId: ItemId;
    /** インベントリ表示名。 */
    displayName: string;
    /** インベントリのスプライト名（省略時は sprites.empty 文字列）。 */
    inventorySpriteName?: string;
    /** 配置時の占有タイル数。 */
    entitySize: { w: number; h: number };
}

/** カテゴリ3施設を1つ登録する。 */
export function registerDailyProcessingEntity(opts: DailyProcessingEntityOptions): void {
    const { stateEntityTypes, sprites, itemId, displayName, inventorySpriteName, entitySize } = opts;

    // 状態 ↔ entityType マッピングを登録（DailyProcessingStorage が逆引きする）
    setDailyStateMapping(stateEntityTypes);

    type State = "empty" | "loading" | "progressing" | "done";

    const entries: Array<[State, number]> = [
        ["empty", stateEntityTypes.empty],
        ["loading", stateEntityTypes.loading],
        ["progressing", stateEntityTypes.progressing],
        ["done", stateEntityTypes.done],
    ];

    const seen = new Set<number>();
    for (const [state, eType] of entries) {
        if (seen.has(eType)) continue;
        seen.add(eType);

        const sprite = sprites[state];

        registerEntity({
            entityType: eType,

            getSprites(): EntitySpriteInfo[] {
                const name = typeof sprite === "function" ? sprite() : sprite;
                return [[name, 0, 0]];
            },

            // 左クリック: axe 撤去（empty 状態のみ、かつストレージが空）
            onInteract(ctx: InteractionContext): boolean {
                if (state !== "empty") return false;
                if (ctx.tool !== "axe") return false;
                const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
                if (!anchor || anchor.entityType !== eType || !anchor.def) return false;
                const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
                if (dailyProcessingStorage && !dailyProcessingStorage.isEmpty(anchorPos)) return false;
                const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.def);
                if (removed) dailyProcessingStorage?.remove(anchorPos);
                return removed;
            },

            // 右クリック: 処理 UI を開く（全状態で可）
            onPrimaryInteract(ctx: InteractionContext): boolean {
                const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
                if (!anchor) return false;
                const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
                dailyProcessingStorage?.create(anchorPos);
                ctx.eventBroker.publish("open_processing_daily_ui", { pos: anchorPos });
                return true;
            },
        });
    }

    // 配置時アイテム（empty 状態で配置）
    const inventorySprite = inventorySpriteName ?? (typeof sprites.empty === "string" ? sprites.empty : "");
    registerItem({
        itemId,
        displayName,
        spriteName: inventorySprite,
        maxStack: 64,
        placement: {
            entityType: stateEntityTypes.empty,
            entitySize,
            fieldSpriteName: typeof sprites.empty === "string" ? sprites.empty : undefined,
            onPlace(voxelMap, pos) {
                placeFacility(voxelMap, pos, stateEntityTypes.empty, entitySize);
                dailyProcessingStorage?.create(pos);
            },
        },
    });

    // 各状態の entityType を base アイテムにエイリアス登録（findFacilityAnchor 解決のため）
    if (stateEntityTypes.loading !== stateEntityTypes.empty) registerItemAlias(stateEntityTypes.loading, itemId);
    if (stateEntityTypes.progressing !== stateEntityTypes.empty && stateEntityTypes.progressing !== stateEntityTypes.loading) {
        registerItemAlias(stateEntityTypes.progressing, itemId);
    }
    if (stateEntityTypes.done !== stateEntityTypes.empty) registerItemAlias(stateEntityTypes.done, itemId);
}

// ── 移行済みエンティティの登録 ──

// compost_bin: 4状態すべて固有のスプライトを持つ
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.compost_bin,
    stateEntityTypes: {
        empty: ENTITY_TYPES.compost_bin,
        loading: ENTITY_TYPES.compost_bin_loaded,
        progressing: ENTITY_TYPES.compost_bin_fermenting,
        done: ENTITY_TYPES.compost_bin_done,
    },
    sprites: {
        empty: "ss_sprite_071.png",
        loading: "ss_sprite_053_1.png",
        progressing: "ss_sprite_053_2.png",
        done: "ss_sprite_053_3.png",
    },
    itemId: "compost_bin",
    displayName: "堆肥場",
    inventorySpriteName: "ss_sprite_062.png",
    entitySize: { w: 2, h: 2 },
});
