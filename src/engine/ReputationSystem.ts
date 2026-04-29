import type { IReputationSystemReader, ItemId, TierProgress, TierStatus } from "../_boundary/interfaces";
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

/**
 * 地球への出荷に応じた評価値とアンロック進行を管理する。
 *
 * - 累計評価値（points）は出荷スコアの単純な合計
 * - 累計出荷数（cumulativeShipped）は品目ごとに別途追跡し、Tier アンロック判定に使う
 */
export class ReputationSystem implements IReputationSystemReader {
    private points: number;
    private cumulativeShipped: Map<ItemId, number>;

    constructor(init: ReputationInitData = {}) {
        this.points = init.points ?? 0;
        this.cumulativeShipped = new Map(init.cumulativeShipped ?? []);
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
    getItemPointValue(itemId: ItemId): number {
        switch (itemId) {
            case "potato":
                return 100;
            case "bagged_soybeans":
                return 640000;
            case "soybean_oil":
                return 1000;
            case "flaxseed_oil":
                return 5000;
            default:
                return 1;
        }
    }

    /** 単一アイテムスタックの評価値を計算する。 */
    calculateStackPoints(itemId: ItemId, count: number): number {
        return this.getItemPointValue(itemId) * Math.max(0, count);
    }

    /**
     * 品目ごとの出荷数を集計して評価値と累計出荷数を加算する。
     * 戻り値は今回の加算結果サマリー。
     */
    processShipment(itemCounts: ReadonlyMap<ItemId, number>): ShipmentSummary {
        const byItem: Array<{
            itemId: ItemId;
            count: number;
            points: number;
        }> = [];

        let totalPoints = 0;

        for (const [itemId, count] of itemCounts) {
            if (count <= 0) continue;
            const points = this.calculateStackPoints(itemId, count);
            totalPoints += points;
            byItem.push({ itemId, count, points });
            this.cumulativeShipped.set(itemId, (this.cumulativeShipped.get(itemId) ?? 0) + count);
        }

        this.points += totalPoints;

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
