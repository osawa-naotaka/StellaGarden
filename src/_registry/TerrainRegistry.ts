import type { InteractionContext } from "./EntityRegistry";

/**
 * 地形タイプに対するインタラクション定義。
 * 地形への操作（掘削・耕作等）を地形タイプごとに登録する。
 * スプライト解決は TerrainSpriteResolver.ts が担当する（近傍依存のため）。
 */
export interface TerrainDef {
    readonly terrainType: number;

    /** この地形タイプが操作対象の時に呼ばれる。
     *  true = 処理済み、false = 未処理。 */
    onInteract?(ctx: InteractionContext): boolean;
}

// ── 内部ストレージ ──

const terrainDefs = new Map<number, TerrainDef>();

// ── 登録・取得 API ──

export function registerTerrain(def: TerrainDef): void {
    terrainDefs.set(def.terrainType, def);
}

export function getTerrainDef(terrainType: number): TerrainDef | undefined {
    return terrainDefs.get(terrainType);
}
