import type { TierDef } from "../_boundary/interfaces";

/**
 * 評価・アンロックシステムの Tier 定義テーブル。
 * 設計書: doc/22_REPUTATION_SYSTEM.md §3 アンロックチェーン
 *
 * threshold（アンロック閾値）はフィージビリティ用の暫定値。
 * 22_REPUTATION_SYSTEM.md §4.3 の時間感覚に基づき、プレイテストで調整する。
 */
export const TIER_DEFS: readonly TierDef[] = [
    {
        id: "tier1",
        label: "Tier 1",
        itemId: "potato",
        baseScore: 100,
        displayRow: 0,
        unlock: null,
    },
    {
        id: "tier2",
        label: "Tier 2",
        itemId: "soybeans",
        baseScore: 300,
        displayRow: 1,
        unlock: { sourceItemId: "potato", threshold: 50 },
    },
    {
        id: "tier3a",
        label: "Tier 3a",
        itemId: "flaxseed_oil",
        baseScore: 800　* 8,
        displayRow: 2,
        unlock: { sourceItemId: "soybeans", threshold: 30 },
    },
    {
        id: "tier3b",
        label: "Tier 3b",
        itemId: "soybean_oil",
        baseScore: 600 * 8,
        displayRow: 2,
        unlock: { sourceItemId: "soybeans", threshold: 30 },
    },
    {
        id: "tier4",
        label: "Tier 4",
        itemId: "thread",
        baseScore: 1200,
        displayRow: 3,
        unlock: { sourceItemId: "flaxseed_oil", threshold: 20 },
    },
    {
        id: "tier5",
        label: "Tier 5",
        itemId: "cloth",
        baseScore: 2000 * 8,
        displayRow: 4,
        unlock: { sourceItemId: "thread", threshold: 30 },
    },
    {
        id: "tier6a",
        label: "Tier 6a",
        itemId: "bagged_potatos",
        baseScore: 1500 * 64,
        displayRow: 5,
        unlock: { sourceItemId: "cloth", threshold: 30 },
    },
    {
        id: "tier6b",
        label: "Tier 6b",
        itemId: "bagged_soybeans",
        baseScore: 5000 * 64,
        displayRow: 5,
        unlock: { sourceItemId: "cloth", threshold: 30 },
        isGoal: true,
    },
];
