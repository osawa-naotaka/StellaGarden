import type { ItemId } from "../_boundary/interfaces";

type ShipmentSummary = {
    readonly totalPoints: number;
    readonly byItem: ReadonlyArray<{
        readonly itemId: ItemId;
        readonly count: number;
        readonly points: number;
    }>;
};

/**
 * 地球への出荷に応じた評価値を管理する。
 *
 * 現在の仕様:
 * - potato は 1 個あたり 100pt
 * - その他のアイテムは 1 個あたり 1pt
 */
export class ReputationSystem {
    private points: number;

    constructor(initialPoints = 0) {
        this.points = initialPoints;
    }

    /** 現在の評価値を返す。 */
    getPoints(): number {
        return this.points;
    }

    /** セーブ用に現在の評価値を返す。 */
    toSaveData(): { points: number } {
        return { points: this.points };
    }

    /** 単一アイテムの評価レートを返す。 */
    getItemPointValue(itemId: ItemId): number {
        if (itemId === "potato") return 100;
        return 1;
    }

    /** 単一アイテムスタックの評価値を計算する。 */
    calculateStackPoints(itemId: ItemId, count: number): number {
        return this.getItemPointValue(itemId) * Math.max(0, count);
    }

    /**
     * 品目ごとの出荷数を集計して評価値を加算する。
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
        }

        this.points += totalPoints;

        return {
            totalPoints,
            byItem,
        };
    }
}