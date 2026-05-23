import type { IEventBroker, IReputationSystemReader, ItemId, TierProgress, TierStatus } from "../_boundary/interfaces";
import { TIER_DEFS } from "./TierDefs";

type ShipmentSummary = {
    readonly totalPoints: number;
    readonly byItem: ReadonlyArray<{
        readonly itemId: ItemId;
        readonly count: number;
        readonly points: number;
    }>;
};

export type ReputationInitData = {
    readonly points?: number;
    readonly cumulativeShipped?: ReadonlyArray<readonly [ItemId, number]>;
};

export type ScoreTable = ReadonlyArray<{
    readonly itemId: ItemId;
    readonly baseScore: number;
}>;

/**
 * 地球への出荷に応じた評価値とアンロック進行を管理する。
 *
 * - 累計評価値（points）は出荷スコアの単純な合計
 * - 累計出荷数（cumulativeShipped）は **アンロック済み品目の有効出荷のみ** 加算する。
 *   未アンロック品目の出荷はポイント 1pt のみ得られ、実績にはカウントされない
 *   （売り先がない取引は「実績を開放できる取引」ではないため）。
 *   この性質により、Tier アンロック判定は「正規の販路を持つ取引の累積」に基づく。
 */
export class ReputationSystem implements IReputationSystemReader {
    private points: number;
    private cumulativeShipped: Map<ItemId, number>;
    private broker: IEventBroker | null = null;

    constructor(init: ReputationInitData = {}) {
        this.points = init.points ?? 0;
        this.cumulativeShipped = new Map(init.cumulativeShipped ?? []);
    }

    /** ゲームプレイ開始後に EventBroker を注入する。Inventory と同じパターン。 */
    setEventBroker(broker: IEventBroker): void {
        this.broker = broker;
    }

    /** 現在の評価値を返す。 */
    getPoints(): number {
        return this.points;
    }

    /** 指定品目の累計出荷数を返す。 */
    getCumulativeShipped(itemId: ItemId): number {
        return this.cumulativeShipped.get(itemId) ?? 0;
    }

    /** セーブ用に内部状態を返す。 */
    toSaveData(): { points: number; cumulativeShipped: Array<[ItemId, number]> } {
        return {
            points: this.points,
            cumulativeShipped: Array.from(this.cumulativeShipped.entries()),
        };
    }

    /** 単一アイテムの評価レートを返す。 */
    getItemPointValue(itemId: ItemId, scoreTable: ScoreTable): number {
        const entry = scoreTable.find((t) => t.itemId === itemId);
        return entry ? entry.baseScore : 1;
    }

    /** 単一アイテムスタックの評価値を計算する。 */
    calculateStackPoints(itemId: ItemId, count: number): number {
        const scoreTable = this.getCurrentScoreTable();
        return this.getItemPointValue(itemId, scoreTable) * Math.max(0, count);
    }

    /**
     * 品目ごとの出荷数を集計して評価値と累計出荷数を加算する。
     * 戻り値は今回の加算結果サマリー。
     *
     * バッチ全体は **出荷開始時点のアンロック状態** をベースに処理する:
     * - 開始時点でアンロック済みの品目は本来のスコアで評価され、累計出荷数に加算される
     * - 未アンロックの品目は 1pt のみ得られ、累計出荷数には加算されない
     *
     * 同一バッチ内で前の品目がアンロックを引き起こしても、後の品目はそれを認識しない
     * （次の出荷から有効になる）。これにより挙動が予測しやすくなる。
     *
     * 累計出荷量が閾値を跨いだ Tier については `tier_unlocked` イベントを発行する
     * （ミッションシステムが購読し、出荷ミッションの完了判定に使う）。
     */
    processShipment(itemCounts: ReadonlyMap<ItemId, number>): ShipmentSummary {
        // 出荷開始時点の累積出荷量と、各品目のアンロック状態をスナップショット
        const beforeCumulative = new Map(this.cumulativeShipped);
        const unlockedAtStart = new Set<ItemId>();
        for (const itemId of itemCounts.keys()) {
            if (this.isItemUnlocked(itemId)) {
                unlockedAtStart.add(itemId);
            }
        }

        const byItem: Array<{
            itemId: ItemId;
            count: number;
            points: number;
        }> = [];

        let totalPoints = 0;

        for (const [itemId, count] of itemCounts) {
            if (count <= 0) continue;
            const isUnlocked = unlockedAtStart.has(itemId);
            const baseScore = isUnlocked ? (TIER_DEFS.find((t) => t.itemId === itemId)?.baseScore ?? 1) : 1;
            const points = baseScore * count;
            totalPoints += points;
            byItem.push({ itemId, count, points });
            // 開始時点でアンロック済みの品目のみ実績累計に加算する。
            // 未アンロックの取引は「実績を開放できない取引」のため累計には含めない。
            if (isUnlocked) {
                this.cumulativeShipped.set(itemId, (this.cumulativeShipped.get(itemId) ?? 0) + count);
            }
        }

        this.points += totalPoints;

        // Tier アンロック検出: 出荷前は未達、出荷後に閾値達成した tier に対して publish
        if (this.broker !== null) {
            for (const tier of TIER_DEFS) {
                if (tier.unlock === null) continue;
                const sourceItemId = tier.unlock.sourceItemId;
                const threshold = tier.unlock.threshold;
                const before = beforeCumulative.get(sourceItemId) ?? 0;
                const after = this.cumulativeShipped.get(sourceItemId) ?? 0;
                if (before < threshold && after >= threshold) {
                    this.broker.publish("tier_unlocked", { itemId: tier.itemId });
                }
            }
        }

        return {
            totalPoints,
            byItem,
        };
    }

    /** 全 Tier の進行状況を TIER_DEFS 順（= displayRow 昇順）で返す。 */
    getAllTierProgress(): readonly TierProgress[] {
        return TIER_DEFS.map((tier) => {
            if (tier.unlock === null) {
                return {
                    tier,
                    status: "unlocked" as TierStatus,
                    cumulativeShipped: 0,
                    threshold: 0,
                };
            }
            const cumulative = this.getCumulativeShipped(tier.unlock.sourceItemId);
            const status: TierStatus = cumulative >= tier.unlock.threshold ? "unlocked" : "in_progress";
            return {
                tier,
                status: this.computeStatus(tier, cumulative, status),
                cumulativeShipped: cumulative,
                threshold: tier.unlock.threshold,
            };
        });
    }

    private getCurrentScoreTable(): ScoreTable {
        return TIER_DEFS.map((tier) => ({
            itemId: tier.itemId,
            baseScore: this.isItemUnlocked(tier.itemId) ? tier.baseScore : 1,
        }));
    }

    /**
     * 指定品目が現在の累計出荷量に基づきアンロック済みかを返す。
     * - Tier 1（unlock === null）: 常に true
     * - その他: 前提品目の累計出荷量 ≥ 閾値 で true
     * - TIER_DEFS にない品目（出荷品目として未登録）: false
     */
    private isItemUnlocked(itemId: ItemId): boolean {
        const tier = TIER_DEFS.find((t) => t.itemId === itemId);
        if (!tier) return false;
        if (tier.unlock === null) return true;
        const cumulative = this.getCumulativeShipped(tier.unlock.sourceItemId);
        return cumulative >= tier.unlock.threshold;
    }

    /**
     * Tier の表示状態を決定する。
     * - 自身が解放済 → "unlocked"
     * - 自身が未解放だが、source となる累積が動き始めている、または直接の前提となる Tier が解放済 → "in_progress"
     * - それ以外 → "locked"
     */
    private computeStatus(tier: (typeof TIER_DEFS)[number], cumulative: number, baseStatus: TierStatus): TierStatus {
        if (baseStatus === "unlocked") return "unlocked";
        if (cumulative > 0) return "in_progress";

        // 前提 Tier（source itemId を解放する Tier）が解放済なら in_progress、そうでなければ locked
        if (!tier.unlock) return "in_progress";
        const prerequisiteTier = TIER_DEFS.find((t) => t.itemId === tier.unlock?.sourceItemId);
        if (!prerequisiteTier) return "in_progress";
        if (prerequisiteTier.unlock === null) return "in_progress"; // 前提が Tier 1（常時解放）
        const prereqCumulative = this.getCumulativeShipped(prerequisiteTier.unlock.sourceItemId);
        return prereqCumulative >= prerequisiteTier.unlock.threshold ? "in_progress" : "locked";
    }
}
