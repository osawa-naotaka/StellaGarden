import { getVisualStage } from "../../engine/CropDefs";
import {
    ENTITY_TYPES,
    getCropGrowthStageFromVoxel,
    getEntityTypeFromVoxel,
    getFertilizedFromVoxel,
    getTerrainTypeFromVoxel,
    TERRAIN_TYPES,
} from "../../engine/TerrainDefs";
import type { Pos3D } from "../../lib/VoxelMap";
import { getEntityDef, type EntitySpriteInfo } from "../../_registry/EntityRegistry";

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
    [calcId9FromHights([0, 0, 1, 0, 1, 1, 1, 1, 0]), "0_3_0"],
    [calcId9FromHights([0, 0, 1, 0, 1, 1, 0, 1, 0]), "0_3_0"],
    [calcId9FromHights([0, 0, 0, 0, 1, 1, 1, 1, 0]), "0_3_0"],
    [calcId9FromHights([1, 0, 0, 0, 1, 1, 0, 1, 0]), "0_3_0"],
    [calcId9FromHights([1, 0, 1, 0, 1, 1, 0, 1, 0]), "0_3_0"],
    [calcId9FromHights([1, 0, 0, 0, 1, 1, 1, 1, 0]), "0_3_0"],
    [calcId9FromHights([1, 0, 1, 0, 1, 1, 1, 1, 0]), "0_3_0"],
    [calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 0]), "0_3_1"],
    [calcId9FromHights([1, 0, 0, 1, 1, 1, 0, 1, 0]), "0_3_1"],
    [calcId9FromHights([0, 0, 1, 1, 1, 1, 0, 1, 0]), "0_3_1"],
    [calcId9FromHights([1, 0, 1, 1, 1, 1, 0, 1, 0]), "0_3_1"],
    [calcId9FromHights([0, 0, 0, 1, 1, 0, 0, 1, 0]), "0_3_2"],
    [calcId9FromHights([1, 0, 0, 1, 1, 0, 0, 1, 1]), "0_3_2"],
    [calcId9FromHights([1, 0, 0, 1, 1, 0, 0, 1, 0]), "0_3_2"],
    [calcId9FromHights([0, 0, 0, 1, 1, 0, 0, 1, 1]), "0_3_2"],
    [calcId9FromHights([0, 0, 1, 1, 1, 0, 0, 1, 0]), "0_3_2"],
    [calcId9FromHights([1, 0, 1, 1, 1, 0, 0, 1, 0]), "0_3_2"],
    [calcId9FromHights([1, 0, 1, 1, 1, 0, 0, 1, 1]), "0_3_2"],
    [calcId9FromHights([0, 0, 1, 1, 1, 0, 0, 1, 1]), "0_3_2"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 0]), "0_3_3"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 0, 1, 0]), "0_3_3"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 1, 1, 0]), "0_3_3"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 1, 1, 0]), "0_3_3"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 0]), "0_3_4"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 1, 0]), "0_3_5"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 1, 1]), "0_3_5"],
    [calcId9FromHights([0, 1, 1, 1, 1, 0, 0, 1, 0]), "0_3_5"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 0, 0]), "0_3_6"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 0, 0, 1]), "0_3_6"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 0, 0, 0]), "0_3_6"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 1, 0, 0]), "0_3_6"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 1, 0, 0]), "0_3_6"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 0, 1]), "0_3_6"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 1, 0, 1]), "0_3_6"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 1, 0, 1]), "0_3_6"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 0, 0]), "0_3_7"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 0, 0]), "0_3_7"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 0, 1]), "0_3_7"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 0, 1]), "0_3_7"],
    [calcId9FromHights([0, 1, 1, 1, 1, 0, 0, 0, 0]), "0_3_8"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 0, 0]), "0_3_8"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 0, 0]), "0_3_8"],
    [calcId9FromHights([0, 1, 1, 1, 1, 0, 1, 0, 0]), "0_3_8"],
    [calcId9FromHights([0, 1, 1, 1, 1, 0, 0, 0, 1]), "0_3_8"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 0, 1]), "0_3_8"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 0, 1]), "0_3_8"],
    [calcId9FromHights([0, 1, 1, 1, 1, 0, 1, 0, 1]), "0_3_8"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 0]), "0_4_0"],
    [calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 1]), "0_4_1"],
    [calcId9FromHights([0, 0, 1, 1, 1, 1, 0, 1, 1]), "0_4_1"],
    [calcId9FromHights([1, 0, 0, 1, 1, 1, 0, 1, 1]), "0_4_1"],
    [calcId9FromHights([1, 0, 1, 1, 1, 1, 0, 1, 1]), "0_4_1"],
    [calcId9FromHights([0, 0, 0, 1, 1, 1, 1, 1, 0]), "0_4_2"],
    [calcId9FromHights([0, 0, 1, 1, 1, 1, 1, 1, 0]), "0_4_2"],
    [calcId9FromHights([1, 0, 0, 1, 1, 1, 1, 1, 0]), "0_4_2"],
    [calcId9FromHights([1, 0, 1, 1, 1, 1, 1, 1, 0]), "0_4_2"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 0]), "0_4_3"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 1]), "0_4_4"],
    [calcId9FromHights([0, 1, 0, 0, 1, 1, 1, 1, 1]), "0_4_4"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 0, 1, 1]), "0_4_4"],
    [calcId9FromHights([1, 1, 0, 0, 1, 1, 1, 1, 1]), "0_4_4"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 1]), "0_4_5"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 1]), "0_4_6"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 1, 0]), "0_4_7"],
    [calcId9FromHights([0, 1, 1, 1, 1, 0, 1, 1, 1]), "0_4_7"],
    [calcId9FromHights([0, 1, 1, 1, 1, 0, 1, 1, 0]), "0_4_7"],
    [calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 1, 1]), "0_4_7"],
    [calcId9FromHights([0, 1, 1, 0, 1, 1, 0, 1, 0]), "0_4_8"],
    [calcId9FromHights([1, 1, 1, 0, 1, 1, 0, 1, 0]), "0_4_8"],
    [calcId9FromHights([0, 1, 1, 0, 1, 1, 1, 1, 0]), "0_4_8"],
    [calcId9FromHights([1, 1, 1, 0, 1, 1, 1, 1, 0]), "0_4_8"],
    [calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 1]), "0_4_9"],
    [calcId9FromHights([1, 1, 1, 1, 1, 1, 1, 1, 0]), "0_4_10"],
    [calcId9FromHights([1, 1, 0, 1, 1, 0, 0, 1, 0]), "0_4_11"],
    [calcId9FromHights([1, 1, 0, 1, 1, 0, 0, 1, 1]), "0_4_11"],
    [calcId9FromHights([1, 1, 0, 1, 1, 0, 0, 1, 0]), "0_4_11"],
    [calcId9FromHights([1, 1, 1, 1, 1, 0, 0, 1, 1]), "0_4_11"],
    [calcId9FromHights([1, 1, 1, 1, 1, 0, 0, 1, 0]), "0_4_11"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 0]), "0_4_12"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 0, 0]), "0_4_13"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 0, 1]), "0_4_13"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 0, 0]), "0_4_13"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 0, 1]), "0_4_13"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 0, 0]), "0_4_14"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 0, 1]), "0_4_14"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 0, 0]), "0_4_14"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 0, 1]), "0_4_14"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 1]), "0_4_15"],
    [calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 1]), "0_5_1"],
    [calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 0]), "0_5_5"],
    [calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 0]), "0_5_7"],
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

export function dirtSpriteName(pos: Pos3D[], centerHight: number, horizonHeight: number, voxel: number[]): string[] {
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

export function wetSoilSpriteName(pos: Pos3D[], centerHight: number, horizonHeight: number, voxel: number[]): string[] {
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
        case TERRAIN_TYPES.soil: {
            const sprites = ["ss_sprite_048.png"];
            // const sprites = soilSpriteName(pos, pos[4].y, horizonHeight, voxel);
            if (getFertilizedFromVoxel(voxel[4])) sprites.push("ss_sprite_050.png");
            return sprites;
        }
        case TERRAIN_TYPES.wetSoil: {
            const sprites = ["ss_sprite_049.png"];
            // const sprites = wetSoilSpriteName(pos, pos[4].y, horizonHeight, voxel);
            if (getFertilizedFromVoxel(voxel[4])) sprites.push("ss_sprite_050.png");
            return sprites;
        }
        case TERRAIN_TYPES.disorderedSoil:
            return ["ss_sprite_051.png"];
        case TERRAIN_TYPES.grass:
            return grassSpritesName(pos, pos[4].y, horizonHeight);
        case TERRAIN_TYPES.dirt:
            // return dirtSpriteName(pos, pos[4].y, horizonHeight, voxel);
            return ["ss_sprite_047.png"];
        default:
            throw new Error(`Unknown voxel type: ${type}`);
    }
}

// EntitySpriteInfo は _registry/EntityRegistry.ts が正規定義。後方互換のため re-export。
export type { EntitySpriteInfo } from "../../_registry/EntityRegistry";

const seedSprite: EntitySpriteInfo[] = [["ss_sprite_008.png", 0, -2]];
const starSprite: EntitySpriteInfo[] = [["ss_sprite_060.png", 0, -4]];

function cropPositionOf(sprite: string): EntitySpriteInfo {
    return [sprite, 0, -8];
}

function cropSpriteOf(sprites: string[]): EntitySpriteInfo[][] {
    return [
        seedSprite,
        [cropPositionOf(sprites[0])],
        [cropPositionOf(sprites[1])],
        [cropPositionOf(sprites[2]), ...starSprite],
        [cropPositionOf(sprites[2]), ...starSprite],
        [cropPositionOf(sprites[2])],
        [cropPositionOf(sprites[2])],
        [cropPositionOf("ss_sprite_061.png")],
    ];
}

const cropSprites: Record<number, EntitySpriteInfo[][]> = {
    // potato は _registry/entities/Potato.ts に移動済み
    [ENTITY_TYPES.soy]: cropSpriteOf(["ss_sprite_018.png", "ss_sprite_019.png", "ss_sprite_020.png"]),
    [ENTITY_TYPES.flax]: cropSpriteOf(["ss_sprite_029.png", "ss_sprite_030.png", "ss_sprite_031.png"]),
    [ENTITY_TYPES.sunflower]: cropSpriteOf(["ss_sprite_033.png", "ss_sprite_034.png", "ss_sprite_035.png"]),
};

const treeSpriteInfo: EntitySpriteInfo[][] = [
    seedSprite,
    [["ss_sprite_038.png", 0, 0]],
    [["ss_sprite_039.png", 0, -16]],
    [
        ["ss_sprite_040.png", -8, -16],
        ["ss_sprite_041.png", 0, 8],
    ],
];
[5];
/** ボクセル値からエンティティタイルのスプライト情報を返す。 */
export function getEntitySpriteNameFromVoxel(voxel: number): EntitySpriteInfo[] {
    const type = getEntityTypeFromVoxel(voxel);
    const dayCounter = getCropGrowthStageFromVoxel(voxel);

    switch (type) {
        case ENTITY_TYPES.none:
            return [];
        case ENTITY_TYPES.tree: {
            if (dayCounter >= 3) {
                return treeSpriteInfo[3];
            } else {
                return treeSpriteInfo[dayCounter] ?? treeSpriteInfo[0];
            }
        }
        case ENTITY_TYPES.potato: {
            const def = getEntityDef(ENTITY_TYPES.potato);
            return def ? def.getSprites(voxel) : [];
        }
        case ENTITY_TYPES.soy:
        case ENTITY_TYPES.flax:
        case ENTITY_TYPES.sunflower: {
            const visualStage = getVisualStage(type, dayCounter);
            return cropSprites[type]?.[visualStage] ?? cropSprites[type][0];
        }
        case ENTITY_TYPES.workbench:
            // 32x16 横長スプライト。タイル左上に配置し、右に 16px はみ出す。
            return [["ss_sprite_004.png", 0, 0]];
        case ENTITY_TYPES.forge: // 16x16
            return [["ss_sprite_052.png", 0, 0]];
        case ENTITY_TYPES.compost_bin: // 32x32
            return [["ss_sprite_053_3.png", 0, 0]];
        case ENTITY_TYPES.threshing_machine: // 32x16
            return [["ss_sprite_054.png", 0, 0]];
        case ENTITY_TYPES.screw_presses: // 32x32
            return [["ss_sprite_055.png", 0, 0]];
        case ENTITY_TYPES.soaking_basket: // 48x16
            return [["ss_sprite_056.png", 0, 0]];
        case ENTITY_TYPES.scutching_board: // 16x16
            return [["ss_sprite_057.png", 0, 0]];
        case ENTITY_TYPES.spinning_wheel: // 32x16
            return [["ss_sprite_058.png", 0, 0]];
        case ENTITY_TYPES.loom: // 32x32
            return [["ss_sprite_059.png", 0, 0]];
        case ENTITY_TYPES.stone: // 16x16
            return [["stone1.png", 0, 0]];
        case ENTITY_TYPES.facility_part:
            // 描画はアンカータイル（workbench）が担当するため、このタイルでは描画しない。
            return [];
        default:
            throw new Error(`Unknown entity type: ${type}`);
    }
}
