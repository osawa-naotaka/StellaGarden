/**
 * 焚き火（bonfire）の独立エンティティ登録（doc/26 §3.2）。
 *
 * 旧実装では DailyProcessing.ts の汎用ヘルパーで「trunk → 草木灰」の単入力施設だったが、
 * 炉（Forge）型に拡張し、燃料スロット（→草木灰）＋素材スロット（→蒸し系）を持つようにした。
 * 状態管理は BonfireStorage が担い、点火状態は voxel の enabled ビットで表す。
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_bonfire_ui を発行（BonfirePanel 起動）
 *  - 左クリック (onInteract) + axe → 撤去（中身は一緒にインベントリへ回収）
 */
import type { BonfireStorage } from "../../engine/BonfireStorage";
import { ENTITY_TYPES, getEnabledFromVoxel, getRotatedFromVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const ANIM_FRAME_MS = 300;
const BONFIRE_LIT_FRAMES = ["ss_sprite_074_1.png", "ss_sprite_074_2.png", "ss_sprite_074_3.png"];
function bonfireLitFrame(): string {
    return BONFIRE_LIT_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % BONFIRE_LIT_FRAMES.length];
}

let bonfireStorage: BonfireStorage | null = null;

/** App / hooks 層から BonfireStorage を注入する。 */
export function setBonfireStorage(storage: BonfireStorage): void {
    bonfireStorage = storage;
}

registerEntity({
    entityType: ENTITY_TYPES.bonfire,

    getEntitySize() {
        return { w: 1, h: 1 };
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        // 点火中（燃料が1日分以上）はアニメーション。
        if (getEnabledFromVoxel(voxel)) {
            return [[bonfireLitFrame(), 0, 0]];
        }
        // 消火中: 草木灰があれば灰の山スプライト、なければ点火前スプライト。
        if (getRotatedFromVoxel(voxel)) {
            return [["ss_sprite_075.png", 0, 0]];
        }
        return [["ss_sprite_076.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (anchor.entityType !== ENTITY_TYPES.bonfire) throw new Error("anchor entity type mismatch");
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        const extraItems = bonfireStorage?.collectAllStacks(anchorPos) ?? [];
        const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0, extraItems);
        if (removed) bonfireStorage?.remove(anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        bonfireStorage?.create(anchorPos);
        ctx.eventBroker.publish("open_bonfire_ui", { pos: anchorPos });
        return true;
    },
});

registerItem({
    itemId: "bonfire",
    displayName: "焚き火",
    spriteName: "ss_sprite_076.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.bonfire,
        fieldSpriteName: "ss_sprite_076.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.bonfire, { w: 1, h: 1 });
            bonfireStorage?.create(pos);
        },
    },
});
