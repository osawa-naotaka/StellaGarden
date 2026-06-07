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
import type { ItemId, IVoxelWriter, Pos2D } from "../../_boundary/interfaces";
import { ENTITY_TYPES, getDaysElapsedFromVoxel, getEnabledFromVoxel, getEntityTypeFromVoxel, setDaysElapsedInVoxel, setEnabledInVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { getItemDef, registerItem } from "../ItemRegistry";
import { DAILY_PROCESSING_DEFS, findRecipeForInput, getDailyProcessingDef, isAcceptableInputItem } from "../ProcessingRecipes";
import { collectAllStacks, createStorage, getStorage, posFromStorageKey, registerStorage, removeStorage, setStorageSlot } from "../StorageRegistry";

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
            const extraItems = collectAllStacks(itemId, anchorPos) ?? [];
            const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0, extraItems);
            if (removed) removeStorage(itemId, anchorPos);
            return removed;
        },

        // 右クリック: 処理 UI を開く（全状態で可）
        onOpenFacilityUI(ctx: InteractionContext): boolean {
            const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
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
                createStorage(itemId, pos);
            },
        },
    });

    registerStorage(itemId, { input: [null], output: [null, null] },
        (voxelMap) => {
          for (const [key, slots] of Object.entries(getStorage(itemId).value)) {
              const pos = posFromStorageKey(key);
              const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
              const voxel = voxelMap.get(surface);
              const entityType = getEntityTypeFromVoxel(voxel);
              // 日次処理対象外の entityType（旧セーブに残った焚き火など）は安全にスキップする。
              const def = DAILY_PROCESSING_DEFS[entityType];
              if (!def) continue;
              if (!slots.input[0]) continue;
  
              const recipe = findRecipeForInput(def, slots.input[0].itemId);
              if (slots.input[0].count < recipe.inputCountPerCycle) continue;
  
              const daysElapsed = getDaysElapsedFromVoxel(voxel);
              const nextDays = daysElapsed + 1;
  
              if (nextDays < def.daysRequired + 1) {
                  // 進行中（loading → progressing への状態遷移は updateVoxelEntityType で）
                  voxelMap.set(setDaysElapsedInVoxel(voxel, nextDays), surface);
                  continue;
              }
  
              // 完了タイミング: 出力スロットの収まり判定（アトミック）
              let canApply = true;
              for (let i = 0; i < recipe.outputs.length; i++) {
                  const out = recipe.outputs[i];
                  const slot = slots.output[i];
                  if (slot === null) continue;
                  if (slot.itemId !== out.itemId) {
                      canApply = false;
                      break;
                  }
                  const max = getItemDef(out.itemId)?.maxStack ?? 64;
                  if (slot.count + out.count > max) {
                      canApply = false;
                      break;
                  }
              }
              if (!canApply) {
                  // 出力満杯 → 進行を保留（daysElapsed を上限のまま据え置く）
                  voxelMap.set(setDaysElapsedInVoxel(voxel, def.daysRequired - 1), surface);
                  continue;
              }
  
              // 入力消費 + 出力加算
              slots.input[0].count -= recipe.inputCountPerCycle;
              // 完了フラグは enabled ビットに記録する（variant ビットは向き専用に解放）。
              const newEnabledVoxel = setEnabledInVoxel(voxel, true);
              if (slots.input[0].count < recipe.inputCountPerCycle) {
                  voxelMap.set(setDaysElapsedInVoxel(newEnabledVoxel, 0), surface);
              } else {
                  voxelMap.set(setDaysElapsedInVoxel(newEnabledVoxel, 1), surface);
              }
              if (slots.input[0].count <= 0) slots.input[0] = null;
              setStorageSlot(itemId, pos, "input", 0, slots.input[0]);
              for (let i = 0; i < recipe.outputs.length; i++) {
                  const out = recipe.outputs[i];
                  const slot = slots.output[i];
                  if (slot === null) {
                      slots.output[i] = { itemId: out.itemId, count: out.count };
                  } else {
                      slot.count += out.count;
                  }
                  setStorageSlot(itemId, pos, "output", i, slots.output[0]);
              }
          }            
        }
    );
}

function getBaseEntityTypeAt(pos: Pos2D, voxelMap: IVoxelWriter): number {
    const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
    return getEntityTypeFromVoxel(voxelMap.get(surface));
}

export function dailyProcessingCanAcceptInput(pos: Pos2D, itemId: string, voxelMap: IVoxelWriter): boolean {
    const baseEntityType = getBaseEntityTypeAt(pos, voxelMap);
    if (baseEntityType === ENTITY_TYPES.none) return false;
    const def = getDailyProcessingDef(baseEntityType);
    if (!def) return false;
    return isAcceptableInputItem(def, itemId as never);
}

export function getDaysElapsed(pos: Pos2D, voxelMap: IVoxelWriter): number {
    const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
    return getDaysElapsedFromVoxel(voxelMap.get(surface));
}

// ── 移行済みエンティティの登録 ──

// アニメーションスプライトの共通フレーム時間
const ANIM_FRAME_MS = 300;

const KILN_BURNING_FRAMES = ["ss_sprite_078_1.png", "ss_sprite_078_2.png", "ss_sprite_078_3.png"];
function kilnBurningFrame(): string {
    return KILN_BURNING_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % KILN_BURNING_FRAMES.length];
}

// compost_bin: 4状態すべて固有のスプライトを持つ
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.compost_bin,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        if (getEnabledFromVoxel(voxel)) {
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

// soaking_basket は独立実装に移行（_registry/entities/SoakingBasket.ts）。
// 縦横バリアントと水隣接判定を持つため、registerDailyProcessingEntity の枠から外れる。

// bonfire は炉型に拡張され独立実装に移行（_registry/entities/Bonfire.ts）。
// 燃料スロット＋素材スロットを持ち BonfireStorage が処理するため、汎用ヘルパーの枠から外れる。

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

// koji_muro（麹室・doc/26 §3.3）: 蒸麦 → 麹。スプライト未作成のため 2x2 の堆肥場を流用する。
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.koji_muro,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        if (getEnabledFromVoxel(voxel)) {
            return "ss_sprite_053_3.png"; // 完了（麹あり）
        }
        switch (days) {
            case 0:
                return "ss_sprite_071.png"; // 空
            case 1:
                return "ss_sprite_053_1.png";
            default:
                return "ss_sprite_053_2.png"; // 発酵中
        }
    },
    itemId: "koji_muro",
    displayName: "麹室",
    inventorySpriteName: "ss_sprite_062.png",
    entitySize: { w: 2, h: 2 },
});
