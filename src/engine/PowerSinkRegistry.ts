import type { Pos2D } from "../_boundary/interfaces";

/**
 * 動力受け取りエンティティ（PowerSink）の情報。
 *
 * 「シャフトから動力を受け取って動作する施設」を表すレジストリ。
 * recomputeAllShaftPowerFlow が登録済みエンティティの enabled ビットを
 * シャフトの動力供給状況に応じて更新する。
 */
export interface PowerSinkInfo {
    readonly entityType: number;
    /** 施設サイズ（マルチタイル施設のサイズを返す）。 */
    getSize(): { w: number; h: number };
    /**
     * 動力受け入れ位置（隣接シャフトを探す位置のリスト）を返す。
     * anchorPos は施設のアンカータイル座標。
     */
    getPowerConnectionPositions(anchorPos: Pos2D, size: { w: number; h: number }): Pos2D[];
}

const sinks = new Map<number, PowerSinkInfo>();

/** 動力シンクとしてエンティティを登録する。 */
export function registerPowerSink(info: PowerSinkInfo): void {
    sinks.set(info.entityType, info);
}

/** 登録済みの全 PowerSink を返す。 */
export function getAllPowerSinks(): ReadonlyMap<number, PowerSinkInfo> {
    return sinks;
}

/** 指定 entityType の PowerSink 情報を返す。未登録なら undefined。 */
export function getPowerSink(entityType: number): PowerSinkInfo | undefined {
    return sinks.get(entityType);
}

/**
 * 施設外周4辺の全タイル（コーナーを除く）を動力受け入れ位置として返すデフォルト実装。
 * AutoProcessingStorage が従来使っていたロジックを切り出したもの。
 */
export function defaultPowerConnectionPositions(anchorPos: Pos2D, size: { w: number; h: number }): Pos2D[] {
    const result: Pos2D[] = [];
    // 上辺・下辺
    for (let dx = 0; dx < size.w; dx++) {
        result.push({ x: anchorPos.x + dx, z: anchorPos.z - 1 });
        result.push({ x: anchorPos.x + dx, z: anchorPos.z + size.h });
    }
    // 左辺・右辺
    for (let dz = 0; dz < size.h; dz++) {
        result.push({ x: anchorPos.x - 1, z: anchorPos.z + dz });
        result.push({ x: anchorPos.x + size.w, z: anchorPos.z + dz });
    }
    return result;
}
