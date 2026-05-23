/**
 * カテゴリ3（日次処理）施設のエンティティ登録ヘルパー。
 *
 * 対象: compost_bin / soaking_basket / bonfire / kiln
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_processing_daily_ui を発行（UI起動）
 *  - 左クリック (onInteract) + axe → 撤去（empty 状態かつ storage 空のときのみ）
 *
 * 状態遷移は DailyProcessingStorage が voxel の entityType と growthStage を
 * 自動的に書き換えることで実現する。
 */
import type { ItemId } from "../../_boundary/interfaces";
import type { DailyProcessingStorage } from "../../engine/DailyProcessingStorage";
import { ENTITY_TYPES, getDaysElapsedFromVoxel, getVariantFromVoxel, VOXEL_VARIANT } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

let dailyProcessingStorage: DailyProcessingStorage | null = null;

/** App / hooks 層から DailyProcessingStorage を注入する。 */
export function setDailyProcessingStorage(storage: DailyProcessingStorage): void {
    dailyProcessingStorage = storage;
}

interface DailyProcessingEntityOptions {
    /** empty 状態 = ベース entityType。 */
    baseEntityType: number;
    /** 状態ごとのフィールドスプライト名（または関数）。 */
    sprites: (voxel: bigint) => string;
    /** インベントリアイテムの itemId。 */
    itemId: ItemId;
    /** インベントリ表示名。 */
    displayName: string;
    /** インベントリのスプライト名 */
    inventorySpriteName: string;
    /** 配置時の占有タイル数。 */
    entitySize: { w: number; h: number };
}

/** カテゴリ3施設を1つ登録する。 */
export function registerDailyProcessingEntity(opts: DailyProcessingEntityOptions): void {
    const { baseEntityType, sprites, itemId, displayName, inventorySpriteName, entitySize } = opts;

    registerEntity({
        entityType: baseEntityType,

        getEntitySize() {
            return entitySize;
        },

        getSprites(voxel: bigint): EntitySpriteInfo[] {
            const name = sprites(voxel);
            return [[name, 0, 0]];
        },

        // 左クリック: axe 撤去（処理進行中でも可。中身は一緒にインベントリへ回収）
        onInteract(ctx: InteractionContext): boolean {
            if (ctx.tool !== "axe") return false;
            const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            if (anchor.entityType !== baseEntityType) throw new Error("anchor entity type mismatch");
            const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            const extraItems = dailyProcessingStorage?.collectAllStacks(anchorPos) ?? [];
            const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0, extraItems);
            if (removed) dailyProcessingStorage?.remove(anchorPos);
            return removed;
        },

        // 右クリック: 処理 UI を開く（全状態で可）
        onOpenFacilityUI(ctx: InteractionContext): boolean {
            const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            dailyProcessingStorage?.create(anchorPos);
            ctx.eventBroker.publish("open_processing_daily_ui", { pos: anchorPos });
            return true;
        },
    });

    // 配置時アイテム（empty 状態で配置）
    registerItem({
        itemId,
        displayName,
        spriteName: inventorySpriteName,
        maxStack: 64,
        placement: {
            entityType: baseEntityType,
            fieldSpriteName: sprites(0n),
            onPlace(voxelMap, pos) {
                placeFacility(voxelMap, pos, baseEntityType, entitySize);
                dailyProcessingStorage?.create(pos);
            },
        },
    });
}

// ── 移行済みエンティティの登録 ──

// アニメーションスプライトの共通フレーム時間
const ANIM_FRAME_MS = 300;

const BONFIRE_LIT_FRAMES = ["ss_sprite_074_1.png", "ss_sprite_074_2.png", "ss_sprite_074_3.png"];
function bonfireLitFrame(): string {
    return BONFIRE_LIT_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % BONFIRE_LIT_FRAMES.length];
}

const KILN_BURNING_FRAMES = ["ss_sprite_078_1.png", "ss_sprite_078_2.png", "ss_sprite_078_3.png"];
function kilnBurningFrame(): string {
    return KILN_BURNING_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % KILN_BURNING_FRAMES.length];
}

// compost_bin: 4状態すべて固有のスプライトを持つ
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.compost_bin,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        const variant = getVariantFromVoxel(voxel);
        if (variant === 1) {
            return "ss_sprite_053_3.png";
        }
        switch (days) {
            case 0:
                return "ss_sprite_071.png";
            case 1:
                return "ss_sprite_053_1.png";
            case 2:
                return "ss_sprite_053_2.png";
            case 3:
                return "ss_sprite_053_2.png";
            case 4:
                return "ss_sprite_053_2.png";
            default:
                return "ss_sprite_053_3.png";
        }
    },
    itemId: "compost_bin",
    displayName: "堆肥場",
    inventorySpriteName: "ss_sprite_062.png",
    entitySize: { w: 2, h: 2 },
});

// soaking_basket: loading と progressing は同じ entityType / スプライト
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.soaking_basket,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        const variant = getVariantFromVoxel(voxel);
        if (variant === VOXEL_VARIANT.done) {
            return "ss_sprite_073.png";
        }
        switch (days) {
            case 0:
                return "ss_sprite_072.png";
            case 1:
                return "ss_sprite_056.png";
            case 2:
                return "ss_sprite_056.png";
            case 3:
                return "ss_sprite_056.png";
            default:
                return "ss_sprite_073.png";
        }
    },
    itemId: "soaking_basket",
    displayName: "浸漬槽",
    inventorySpriteName: "ss_sprite_065.png",
    entitySize: { w: 3, h: 1 },
});

// bonfire: loading と progressing は同じく bonfire_lit（アニメーション）
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.bonfire,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        const variant = getVariantFromVoxel(voxel);
        switch (days) {
            case 0:
                return variant === VOXEL_VARIANT.done ? "ss_sprite_075.png" : "ss_sprite_076.png";
            case 1:
                return bonfireLitFrame();
            default:
                return "ss_sprite_075.png";
        }
    },
    itemId: "bonfire",
    displayName: "焚き火",
    inventorySpriteName: "ss_sprite_076.png",
    entitySize: { w: 1, h: 1 },
});

// kiln: loading と progressing は kiln_burning（アニメーション）。
// 完了時は empty と同じ kiln スプライトに戻り、output から charcoal + dirt を取り出す。
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.kiln,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        switch (days) {
            case 0:
                return "ss_sprite_077.png";
            case 1:
            case 2:
            case 3:
            case 4:
                return kilnBurningFrame();
            case 5:
                return "ss_sprite_077.png";
            default:
                return "ss_sprite_077.png";
        }
    },
    itemId: "kiln",
    displayName: "炭焼き窯",
    inventorySpriteName: "ss_sprite_068.png",
    entitySize: { w: 2, h: 2 },
});
