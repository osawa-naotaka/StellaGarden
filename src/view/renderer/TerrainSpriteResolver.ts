import { ENTITY_TYPES, getCropGrowthStageFromVoxel, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import type { Pos3D } from "../../lib/VoxelMap";

// -----------------------------------------------------------------------------
// 内部ヘルパー: 高さ配列 ↔ ID の変換
// -----------------------------------------------------------------------------

/** 5点 ID: 上下左右中（インデックス 1,3,4,5,7）の高さからビット連結 ID を計算する。 */
function calcId5FromHights(hights: number[]): number {
    const idArr = [0, hights[1], 0, hights[3], hights[4], hights[5], 0, hights[7], 0];
    return idArr.reduce((prev, cur) => (prev << 2) | cur, 0);
}

/** 9点 ID: 全9点の高さからビット連結 ID を計算する。 */
function calcId9FromHights(hights: number[]): number {
    return hights.reduce((prev, cur) => (prev << 2) | cur, 0);
}

function calcId5FromVoxel(voxelIsSoil: number[]): number {
    const idArr = [0, voxelIsSoil[1], 0, voxelIsSoil[3], voxelIsSoil[4], voxelIsSoil[5], 0, voxelIsSoil[7], 0];
    return idArr.reduce((prev, cur) => (prev << 2) | cur, 0);
}

function calcId9FromVoxel(voxelIsSoil: number[]): number {
    return voxelIsSoil.reduce((prev, cur) => (prev << 2) | cur, 0);
}

// -----------------------------------------------------------------------------
// ルックアップテーブル（モジュールロード時に一度だけ計算）
// 隣接パターン ID → スプライトサフィックス（"0_3_0" 等）
// 草・耕地・湿潤耕地で共通（高さを正規化した 0/1 フラグを使う）
// -----------------------------------------------------------------------------

/** 9近傍パターン → サフィックス。両端・角の情報が必要なケース。 */
const TRANSITION_ID9: ReadonlyMap<number, string> = new Map([
    [calcId9FromHights([0, 0, 0, 0, 1, 1, 0, 1, 0]), "0_3_0"],
    [calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 0]), "0_3_1"],
    [calcId9FromHights([0, 0, 0, 1, 1, 0, 0, 1, 0]), "0_3_2"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 0]), "0_3_3"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 0]), "0_3_4"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 1, 0]), "0_3_5"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 0, 0]), "0_3_6"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 0, 0]), "0_3_7"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 0, 0]), "0_3_8"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 0]), "0_4_0"],
    [calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 1]), "0_4_1"],
    [calcId9FromHights([0, 0, 0, 1, 1, 1, 1, 1, 0]), "0_4_2"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 0]), "0_4_3"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 1]), "0_4_4"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 1]), "0_4_5"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 1]), "0_4_6"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 1, 0]), "0_4_7"],
    // ★ 2 パターンを同一サフィックスに統合（soil のみ片方が欠損していたバグを修正）
    [calcId9FromHights([0, 1, 1, 0, 1, 1, 0, 1, 0]), "0_4_8"],
    [calcId9FromHights([1, 1, 1, 0, 1, 1, 0, 1, 0]), "0_4_8"],
    [calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 1]), "0_4_9"],
    [calcId9FromHights([1, 1, 1, 1, 1, 1, 1, 1, 0]), "0_4_10"],
    [calcId9FromHights([1, 1, 0, 1, 1, 0, 0, 1, 0]), "0_4_11"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 0]), "0_4_12"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 0, 0]), "0_4_13"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 0, 0]), "0_4_14"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 1]), "0_4_15"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 1]), "0_5_1"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 0]), "0_5_5"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 0]), "0_5_7"],
    // ★ soil では "0_5_9" になっていたが草を正として "0_5_8" に統一（バグ修正）
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 1]), "0_5_8"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 1]), "0_5_10"],
    [calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 0]), "0_5_14"],
]);

/** 5近傍パターン → サフィックス。上下左右中のみで判定できるケース。 */
const TRANSITION_ID5: ReadonlyMap<number, string> = new Map([
    [calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 0, 0]), "0_0_0"],
    [calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 0, 0]), "0_1_0"],
    [calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 1, 0]), "0_1_1"],
    [calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 1, 0]), "0_1_2"],
    [calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 0, 0]), "0_2_0"],
    [calcId5FromHights([0, 0, 0, 1, 1, 1, 0, 0, 0]), "0_2_1"],
    [calcId5FromHights([0, 0, 0, 1, 1, 0, 0, 0, 0]), "0_2_2"],
    [calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 1, 1]), "0_5_0"],
    [calcId5FromHights([0, 0, 0, 1, 1, 1, 1, 1, 1]), "0_5_2"],
    [calcId5FromHights([0, 0, 0, 1, 1, 0, 1, 1, 0]), "0_5_3"],
    [calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 1, 1]), "0_5_4"],
    [calcId5FromHights([1, 1, 0, 1, 1, 0, 1, 1, 0]), "0_5_11"],
    [calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 0, 0]), "0_5_12"],
    [calcId5FromHights([1, 1, 1, 1, 1, 1, 0, 0, 0]), "0_5_13"],
    [calcId5FromHights([1, 1, 0, 1, 1, 0, 0, 0, 0]), "0_5_15"],
]);

// -----------------------------------------------------------------------------
// 耕地・湿潤耕地オーバーレイの解決
// -----------------------------------------------------------------------------

/** voxel 配列 + 述語からスプライトオーバーレイ名を解決する。 */
function resolveSoilOverlay(voxel: number[], isSoilPredicate: (v: number) => boolean, prefix: string): string {
    const flags = voxel.map((v) => (isSoilPredicate(v) ? 1 : 0));
    const id9 = calcId9FromVoxel(flags);
    const id5 = calcId5FromVoxel(flags);
    const suffix = TRANSITION_ID9.get(id9) ?? TRANSITION_ID5.get(id5) ?? "0_5_9";
    return `${prefix}_${suffix}`;
}

export function soilSpriteName(pos: Pos3D[], centerHight: number, horizonHeight: number, voxel: number[]): string[] {
    const base = grassSpritesName(pos, centerHight, horizonHeight);
    const isSoil = (v: number) => getTerrainTypeFromVoxel(v) === TERRAIN_TYPES.soil || getTerrainTypeFromVoxel(v) === TERRAIN_TYPES.wetSoil;
    return [...base, resolveSoilOverlay(voxel, isSoil, "soil_normal")];
}

function dirtSpriteName(pos: Pos3D[], centerHight: number, horizonHeight: number, voxel: number[]): string[] {
    const heights = new Set(pos.map((p) => p.y));

    let isEdge: boolean;
    if (heights.size === 1) {
        // 全部同じ高さ → 平坦
        isEdge = false;
    } else if (heights.size === 2) {
        const sorted = [...heights].sort((a, b) => a - b);
        const maxH = sorted[1];
        // 断崖スプライトは高い方のタイルにのみ描画される
        isEdge = centerHight === maxH;
    } else {
        // 3種類以上の高さが混在する場合はエッジとして扱う
        isEdge = true;
    }

    if (isEdge) {
        return grassSpritesName(pos, centerHight, horizonHeight);
    }
    const base = grassSpritesName(pos, centerHight, horizonHeight);
    // 中心と同じ高さのdirtのみ繋がりとして扱う（高さが異なるdirtは無視）
    const flags = voxel.map((v, i) => (getTerrainTypeFromVoxel(v) === TERRAIN_TYPES.dirt && pos[i].y === centerHight ? 1 : 0));
    const id9 = calcId9FromVoxel(flags);
    const id5 = calcId5FromVoxel(flags);
    const suffix = TRANSITION_ID9.get(id9) ?? TRANSITION_ID5.get(id5) ?? "0_5_9";
    return [...base, `dirt_grass_normal_${suffix}`];
}

function wetSoilSpriteName(pos: Pos3D[], centerHight: number, horizonHeight: number, voxel: number[]): string[] {
    const base = soilSpriteName(pos, centerHight, horizonHeight, voxel);
    const isWetSoil = (v: number) => getTerrainTypeFromVoxel(v) === TERRAIN_TYPES.wetSoil;
    return [...base, resolveSoilOverlay(voxel, isWetSoil, "soil_wet")];
}

// -----------------------------------------------------------------------------
// 草地スプライト名の解決
// -----------------------------------------------------------------------------

export function grassSpritesName(pos: Pos3D[], centerHight: number, horizonHeight: number): string[] {
    // 高さを正規化（低い方 = 0、同じ高さ = 1）
    const minH = centerHight - 1;
    const normalized = pos.map((p) => Math.min(1, Math.max(0, p.y - minH)));

    // 全面同一高さ → オーバーレイ不要、ベーススプライトのみ
    if (normalized.every((h) => h === 1)) {
        return ["grass_water_normal_0_5_9"];
    }

    const baseSprite = centerHight <= horizonHeight ? "water_grass_normal_0_5_9" : "grass_water_normal_0_5_9";
    const overlayPrefix = centerHight <= horizonHeight ? "grass_water_normal" : "grass_hill_normal";
    const defaultSprite = centerHight <= horizonHeight ? "grass_water_normal_0_5_9" : "grass_water_dark_0_5_9";

    const id9 = calcId9FromHights(normalized);
    const id5 = calcId5FromHights([0, normalized[1], 0, normalized[3], normalized[4], normalized[5], 0, normalized[7], 0]);

    const suffix9 = TRANSITION_ID9.get(id9);
    if (suffix9) return [baseSprite, `${overlayPrefix}_${suffix9}`];

    const suffix5 = TRANSITION_ID5.get(id5);
    if (suffix5) return [baseSprite, `${overlayPrefix}_${suffix5}`];

    return [defaultSprite];
}

// -----------------------------------------------------------------------------
// ボクセル → スプライト名の解決
// -----------------------------------------------------------------------------

/** ボクセルデータから地形タイルのスプライト名配列を返す。 */
export function getTerrainSpriteNamesFromVoxel(voxel: number[], pos: Pos3D[], horizonHeight: number): string[] {
    const type = getTerrainTypeFromVoxel(voxel[4]);
    switch (type) {
        case TERRAIN_TYPES.water:
        case TERRAIN_TYPES.waterSource:
            return ["water_grass_normal_0_5_9"];
        case TERRAIN_TYPES.soil:
            return ["ss_sprite_048.png"];
            // return soilSpriteName(pos, pos[4].y, horizonHeight, voxel);
        case TERRAIN_TYPES.wetSoil:
            return ["ss_sprite_049.png"];
            // return wetSoilSpriteName(pos, pos[4].y, horizonHeight, voxel);
        case TERRAIN_TYPES.grass:
            return grassSpritesName(pos, pos[4].y, horizonHeight);
        case TERRAIN_TYPES.dirt:
            return ["ss_sprite_047.png"];
            // return dirtSpriteName(pos, pos[4].y, horizonHeight, voxel);
        default:
            throw new Error(`Unknown voxel type: ${type}`);
    }
}

export type EntitySpriteInfo = {
    spriteName: string;
    anchor: { x: number; y: number };
};

// エンティティタイプごとの暫定anchor値。ユーザーが調整する想定。
const ENTITY_ANCHORS: Record<number, { x: number; y: number }> = {
    [ENTITY_TYPES.tree]: { x: 0.25, y: 0.75 }, // birch_tree_sapling: 底部を地面に合わせる
    [ENTITY_TYPES.potato]: { x: 0, y: 0.55 }, // potato_1: 現状値を維持
    [ENTITY_TYPES.soy]: { x: 0, y: 0.55 },
    [ENTITY_TYPES.flax]: { x: 0, y: 0.55 },
    [ENTITY_TYPES.sunflower]: { x: 0, y: 0.55 },
};

/** ボクセル値からエンティティタイルのスプライト情報を返す。 */
export function getEntitySpriteNameFromVoxel(voxel: number): EntitySpriteInfo[] {
    const type = getEntityTypeFromVoxel(voxel);
    switch (type) {
        case ENTITY_TYPES.none:
            return [];
        case ENTITY_TYPES.tree:
            const stage = getCropGrowthStageFromVoxel(voxel);
            const spriteNames = ["ss_sprite_008.png", "ss_sprite_038.png", "ss_sprite_039.png", "ss_sprite_040.png"];
            if(stage === 3) {
                return [{ spriteName: "ss_sprite_040.png", anchor: ENTITY_ANCHORS[type]}, { spriteName: "ss_sprite_041.png", anchor: { x: 0, y: 0.0 }} ];
            } else {
                return [{ spriteName: spriteNames[stage] ?? "ss_sprite_008.png", anchor: ENTITY_ANCHORS[type] }];
            }
            // const spriteNames = ["ss_sprite_008.png", "birch_tree_bud", "birch_tree_sapling", "birch_tree"];
        case ENTITY_TYPES.potato: {
            const stage = getCropGrowthStageFromVoxel(voxel);
            const spriteNames = ["ss_sprite_008.png", "ss_sprite_010.png", "ss_sprite_011.png", "ss_sprite_012.png"];
            return [{ spriteName: spriteNames[stage] ?? "ss_sprite_008.png", anchor: ENTITY_ANCHORS[type] }];
        }
        case ENTITY_TYPES.soy: {
            const stage = getCropGrowthStageFromVoxel(voxel);
            const spriteNames = ["ss_sprite_008.png", "ss_sprite_018.png", "ss_sprite_019.png", "ss_sprite_020.png"];
            return [{ spriteName: spriteNames[stage] ?? "ss_sprite_008.png", anchor: ENTITY_ANCHORS[type] }];
        }
        case ENTITY_TYPES.flax: {
            const stage = getCropGrowthStageFromVoxel(voxel);
            const spriteNames = ["ss_sprite_008.png", "ss_sprite_029.png", "ss_sprite_030.png", "ss_sprite_031.png"];
            return [{ spriteName: spriteNames[stage] ?? "ss_sprite_008.png", anchor: ENTITY_ANCHORS[type] }];
        }
        case ENTITY_TYPES.sunflower: {
            const stage = getCropGrowthStageFromVoxel(voxel);
            const spriteNames = ["ss_sprite_008.png", "ss_sprite_033.png", "ss_sprite_034.png", "ss_sprite_035.png"];
            return [{ spriteName: spriteNames[stage] ?? "ss_sprite_008.png", anchor: ENTITY_ANCHORS[type] }];
        }
        default:
            throw new Error(`Unknown entity type: ${type}`);
    }
}
