import type { DailyProcessingState } from "../engine/DailyProcessingStorage";

/**
 * 日次処理施設の各状態に対応する entityType をまとめた構造。
 * 各エンティティ登録時に `setDailyStateMapping(base, mapping)` で登録する。
 */
export interface DailyStateMapping {
    /** 入力なし・出力なしの初期状態。 */
    readonly empty: number;
    /** 入力あり、進行0日目。 */
    readonly loading: number;
    /** 入力あり、進行1日目以降。 */
    readonly progressing: number;
    /** 出力ありの完了状態。 */
    readonly done: number;
}

interface StateInfo {
    readonly base: number;
    readonly state: DailyProcessingState;
}

const stateInfoByEntityType = new Map<number, StateInfo>();
const stateMappingByBase = new Map<number, DailyStateMapping>();

/**
 * 状態 → entityType のマッピングを登録する。
 * - `mapping.empty` を base として `getDailyStateMapping(base)` で逆引きできる。
 * - 各状態の entityType から `getDailyEntityStateInfo(entityType)` で base と state を逆引きできる。
 */
export function setDailyStateMapping(mapping: DailyStateMapping): void {
    const base = mapping.empty;
    stateMappingByBase.set(base, mapping);
    stateInfoByEntityType.set(mapping.empty, { base, state: "empty" });
    stateInfoByEntityType.set(mapping.loading, { base, state: "loading" });
    stateInfoByEntityType.set(mapping.progressing, { base, state: "progressing" });
    stateInfoByEntityType.set(mapping.done, { base, state: "done" });
}

/** entityType から base entityType と現在状態を逆引きする。未登録なら null。 */
export function getDailyEntityStateInfo(entityType: number): StateInfo | null {
    return stateInfoByEntityType.get(entityType) ?? null;
}

/** base entityType から状態 → entityType マッピングを引く。未登録なら null。 */
export function getDailyStateMapping(baseEntityType: number): DailyStateMapping | null {
    return stateMappingByBase.get(baseEntityType) ?? null;
}
