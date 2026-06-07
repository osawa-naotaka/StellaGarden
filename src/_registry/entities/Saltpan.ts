/**
 * 塩田（saltpan）の独立エンティティ登録（doc/26 §3.1）。
 *
 * 入力を持たず受動的に塩を生成する施設。状態は SaltPanStorage が管理する。
 * 設置条件は「水タイルに隣接する陸タイル」（海/川の区別なし。浸漬槽と同じ判定）。
 * スプライトは未作成のため 2x2 の堆肥場スプライトを流用する。
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_saltpan_ui を発行（SaltPanPanel 起動）
 *  - 左クリック (onInteract) + axe → 撤去（貯まった塩は一緒にインベントリへ回収）
 */
import type { IVoxelReader, IVoxelWriter, Pos2D } from "../../_boundary/interfaces";
import { ENTITY_TYPES, getDaysElapsedFromVoxel, getEnabledFromVoxel, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, setDaysElapsedInVoxel, setEnabledInVoxel, TERRAIN_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { getItemDef, type PlacementVariant, registerItem } from "../ItemRegistry";
import { collectAllStacks, createStorage, getStorage, getStorageSlot, posFromStorageKey, registerStorage, removeStorage, setStorageSlot } from "../StorageRegistry";

const ENTITY_SIZE = { w: 2, h: 2 };

const PLACEABLE_TERRAINS: ReadonlySet<number> = new Set([TERRAIN_TYPES.grass, TERRAIN_TYPES.dirt, TERRAIN_TYPES.soil]);
const NEIGHBORS_4: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
];

function isWaterTerrain(t: number): boolean {
    return t === TERRAIN_TYPES.water || t === TERRAIN_TYPES.waterSource;
}

/** 配置範囲が全て陸地・同一 surfaceY・空エンティティで、外周4近傍に水タイルが1つ以上あるか。 */
function canPlaceSaltpan(map: IVoxelReader, pos: Pos2D): boolean {
    const { x, z } = pos;
    const { w, h } = ENTITY_SIZE;
    if (x < 0 || x + w > map.width || z < 0 || z + h > map.depth) return false;

    const baseY = map.getSurfacePosition({ x, z }).y;
    for (let dz = 0; dz < h; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const surfacePos = map.getSurfacePosition(pos);
            if (surfacePos.y !== baseY) return false;
            const voxel = map.getSurface({ x: x + dx, z: z + dz });
            if (!PLACEABLE_TERRAINS.has(getTerrainTypeFromVoxel(voxel))) return false;
            if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) return false;
        }
    }

    for (let dz = 0; dz < h; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const tx = x + dx;
            const tz = z + dz;
            for (const [ndx, ndz] of NEIGHBORS_4) {
                const nx = tx + ndx;
                const nz = tz + ndz;
                if (nx < 0 || nx >= map.width || nz < 0 || nz >= map.depth) continue;
                if (nx >= x && nx < x + w && nz >= z && nz < z + h) continue; // 配置範囲内は除外
                const v = map.getSurface({ x: nx,  z: nz });
                if (isWaterTerrain(getTerrainTypeFromVoxel(v))) return true;
            }
        }
    }
    return false;
}

registerEntity({
    entityType: ENTITY_TYPES.saltpan,

    getEntitySize() {
        return ENTITY_SIZE;
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        // 塩が貯まっている（取り出し可能）かどうかで見た目を変える。スプライトは堆肥場を流用。
        return getEnabledFromVoxel(voxel) ? [["ss_sprite_053_3.png", 0, 0]] : [["ss_sprite_071.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (anchor.entityType !== ENTITY_TYPES.saltpan) throw new Error("anchor entity type mismatch");
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        const extraItems = collectAllStacks("saltpan", anchorPos) ?? [];
        const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0, extraItems);
        if (removed) removeStorage("saltpan", anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        ctx.eventBroker.publish("open_saltpan_ui", { pos: anchorPos });
        return true;
    },
});

registerItem({
    itemId: "saltpan",
    displayName: "塩田",
    spriteName: "ss_sprite_062.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.saltpan,
        fieldSpriteName: "ss_sprite_071.png",
        canPlace(voxelMap, pos, _variant: PlacementVariant) {
            return canPlaceSaltpan(voxelMap, pos);
        },
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.saltpan, ENTITY_SIZE);
            createStorage("saltpan", pos);
        },
    },
});

/** 塩×n を貯めるまでに必要なゲーム内日数（doc/26 §3.1「2日で塩×n」）。 */
export const SALT_DAYS_PER_CYCLE = 2;
/** 1サイクルで貯まる塩の個数（仮）。 */
export const SALT_PER_CYCLE = 4;

registerStorage("saltpan", { output: [null] },
  (voxelMap: IVoxelWriter) => {
      for (const [key, slots] of Object.entries(getStorage("saltpan").value)) {
          const pos = posFromStorageKey(key);
          const surface = voxelMap.getSurfacePosition(pos);
          const voxel = voxelMap.get(surface);
          const days = getDaysElapsedFromVoxel(voxel) + 1;

          if (days < SALT_DAYS_PER_CYCLE) {
              voxelMap.set(setDaysElapsedInVoxel(voxel, days), surface);
              updateVoxelEnabled(pos, voxelMap);
              continue;
          }

          // サイクル到達: 塩を加算できるなら加算して進行をリセット、満杯なら保留。
          const max = getItemDef("salt")?.maxStack ?? 64;
          const current = slots.output[0]?.itemId === "salt" ? slots.output[0].count : slots.output[0] === null ? 0 : -1;
          const canAdd = current >= 0 && current + SALT_PER_CYCLE <= max;

          if (canAdd) {
              slots.output[0] = { itemId: "salt", count: current + SALT_PER_CYCLE };
              setStorageSlot("saltpan", posFromStorageKey(key), "output", 0, slots.output[0]);
              voxelMap.set(setDaysElapsedInVoxel(voxel, 0), surface);
          } else {
              // 出力満杯（または想定外 itemId）→ 進行を据え置いて翌日また判定する。
              voxelMap.set(setDaysElapsedInVoxel(voxel, SALT_DAYS_PER_CYCLE), surface);
          }
          updateVoxelEnabled(pos, voxelMap);
      }
  }
);

function updateVoxelEnabled(pos: Pos2D, voxelMap: IVoxelWriter): void {
    const surface = voxelMap.getSurfacePosition(pos);
    const voxel = voxelMap.get(surface);
    voxelMap.set(setEnabledInVoxel(voxel, getStorageSlot("saltpan", pos, "output", 0) !== null), surface);
}
