import type { GameEventMap } from "../_boundary/events";
import type { IEventBroker } from "../_boundary/interfaces";
import type { MissionSaveData } from "../lib/SaveSchema";
import { ALL_MISSIONS, type MissionDef, type SubMissionDef } from "./MissionDefs";

/**
 * ミッション進行管理。
 *
 * doc/25_MISSION_SYSTEM.md §4「並列フラグモデル」に従う:
 * - 「現在進行中のミッション」というカーソル状態は持たない
 * - 各ミッション/サブが独立した達成済みフラグを持つ
 * - 全ミッションのイベントリスナーを起動時に一括 subscribe（動的 subscribe/unsubscribe なし）
 * - 表示すべきミッションは未達成のうち order 最小のものを動的に導出
 *
 * 先回りプレイヤーへの対応:
 * - 現在のミッションとは無関係な操作で達成条件が満たされても、対応するフラグが裏で立つ
 * - 後でそのミッションが表示順になったとき、既達成のため自動的にスキップされる
 */
export class MissionSystem {
    private completedSubs: Set<string>;
    private completedMains: Set<string>;
    private changeListeners: Set<() => void> = new Set();

    constructor(init?: MissionSaveData) {
        this.completedSubs = new Set(init?.completedSubs ?? []);
        this.completedMains = new Set(init?.completedMains ?? []);
        // 念のため、ロード直後にメイン完了判定を再評価する（サブ定義の変更等に追随）
        this.recomputeMainsFromSubs();
    }

    /**
     * EventBroker を購読する。MissionDefs に登録された全ミッションの全サブを横断し、
     * イベント種別ごとに一つのリスナーをまとめて張る。
     *
     * 戻り値の dispose 関数を呼ぶと、全リスナーが解除される。
     */
    subscribeEvents(broker: IEventBroker): () => void {
        const triggersByEvent = this.groupTriggersByEvent();
        const disposers: Array<() => void> = [];

        for (const [eventType, triggers] of triggersByEvent) {
            disposers.push(
                broker.subscribe(eventType, (packet) => {
                    this.onEvent(eventType, packet, triggers);
                }),
            );
        }

        return () => {
            for (const d of disposers) d();
        };
    }

    /** 現在表示すべきメインミッション（未達成のうち order 最小）。全完了なら null。 */
    getCurrentMain(): MissionDef | null {
        let best: MissionDef | null = null;
        for (const m of ALL_MISSIONS) {
            if (this.completedMains.has(m.id)) continue;
            if (best === null || m.order < best.order) best = m;
        }
        return best;
    }

    /**
     * 表示中メインに属する、未達成のサブのうち order 最小のもの。
     * （ドキュメント §3.3 のパターン B = 既達成サブは UI に表示せず次へ）
     * 表示中メインが無い or 全サブ達成済みなら null。
     */
    getCurrentSub(): SubMissionDef | null {
        const main = this.getCurrentMain();
        if (!main) return null;
        let best: SubMissionDef | null = null;
        for (const s of main.subs) {
            if (this.completedSubs.has(s.id)) continue;
            if (best === null || s.order < best.order) best = s;
        }
        return best;
    }

    isSubCompleted(subId: string): boolean {
        return this.completedSubs.has(subId);
    }

    isMainCompleted(mainId: string): boolean {
        return this.completedMains.has(mainId);
    }

    /**
     * 状態変更（サブ達成・メイン達成）時に呼ばれるリスナーを登録する。
     * React UI 側で再描画トリガとして使う。
     * 戻り値の dispose 関数で解除する。
     */
    onChange(listener: () => void): () => void {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }

    /** セーブ用に内部状態を返す。 */
    toSaveData(): MissionSaveData {
        return {
            completedSubs: Array.from(this.completedSubs),
            completedMains: Array.from(this.completedMains),
        };
    }

    // ─── 内部ヘルパー ────────────────────────────────────────────────────

    /**
     * 全サブミッションを「購読すべきイベント名」でグルーピングする。
     * 同一イベントを複数サブが購読する場合に、リスナー登録を一回にまとめるため。
     */
    private groupTriggersByEvent(): Map<keyof GameEventMap, Array<{ subId: string; mainId: string; predicate?: (p: unknown) => boolean }>> {
        const map = new Map<keyof GameEventMap, Array<{ subId: string; mainId: string; predicate?: (p: unknown) => boolean }>>();
        for (const main of ALL_MISSIONS) {
            for (const sub of main.subs) {
                const list = map.get(sub.trigger.eventType) ?? [];
                list.push({
                    subId: sub.id,
                    mainId: main.id,
                    // predicate は trigger 側で eventType 固有の型を持つが、
                    // ここでは unknown 経由で呼ぶ。MissionDefs 側で型整合が取れているので安全。
                    predicate: sub.trigger.predicate as ((p: unknown) => boolean) | undefined,
                });
                map.set(sub.trigger.eventType, list);
            }
        }
        return map;
    }

    /**
     * 単一イベント受信時の処理。該当する全サブを判定し、フラグを更新する。
     * 1 つのイベントで複数サブが同時達成することもある（doc/25 §4.5 の利点）。
     */
    private onEvent(
        _eventType: keyof GameEventMap,
        packet: unknown,
        triggers: Array<{ subId: string; mainId: string; predicate?: (p: unknown) => boolean }>,
    ): void {
        let anyChanged = false;
        const newlyCompletedMains = new Set<string>();

        for (const t of triggers) {
            if (this.completedSubs.has(t.subId)) continue;
            if (t.predicate && !t.predicate(packet)) continue;

            this.completedSubs.add(t.subId);
            anyChanged = true;

            // メイン完了判定: そのサブの所属メインの全サブが完了したか
            if (!this.completedMains.has(t.mainId) && this.isMainAllSubsDone(t.mainId)) {
                this.completedMains.add(t.mainId);
                newlyCompletedMains.add(t.mainId);
            }
        }

        if (anyChanged) this.notifyChange();
    }

    /** 指定メインの全サブが達成済みかを判定する。 */
    private isMainAllSubsDone(mainId: string): boolean {
        const main = ALL_MISSIONS.find((m) => m.id === mainId);
        if (!main) return false;
        for (const s of main.subs) {
            if (!this.completedSubs.has(s.id)) return false;
        }
        return true;
    }

    /**
     * ロード時、completedSubs から completedMains を再計算する。
     * ミッション定義の構造変更（サブの追加・削除）にも追随する。
     */
    private recomputeMainsFromSubs(): void {
        for (const main of ALL_MISSIONS) {
            if (this.completedMains.has(main.id)) continue;
            if (main.subs.length === 0) continue;
            if (this.isMainAllSubsDone(main.id)) {
                this.completedMains.add(main.id);
            }
        }
    }

    private notifyChange(): void {
        for (const listener of this.changeListeners) listener();
    }
}
