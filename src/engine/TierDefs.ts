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
        unlock: { sourceItemId: "potato", threshold: 64 },
    },
    {
        id: "tier3a",
        label: "Tier 3a",
        itemId: "flaxseed_oil",
        baseScore: 800 * 8,
        displayRow: 2,
        unlock: { sourceItemId: "soybeans", threshold: 64 },
    },
    {
        id: "tier3b",
        label: "Tier 3b",
        itemId: "soybean_oil",
        baseScore: 600 * 8,
        displayRow: 2,
        unlock: { sourceItemId: "soybeans", threshold: 64 },
    },
    {
        id: "tier4",
        label: "Tier 4",
        itemId: "thread",
        baseScore: 1200,
        displayRow: 3,
        unlock: { sourceItemId: "flaxseed_oil", threshold: 8 },
    },
    {
        id: "tier5",
        label: "Tier 5",
        itemId: "cloth",
        baseScore: 2000 * 8,
        displayRow: 4,
        unlock: { sourceItemId: "thread", threshold: 64 },
    },
    {
        id: "tier6a",
        label: "Tier 6a",
        itemId: "bagged_potatos",
        baseScore: 1500 * 64,
        displayRow: 5,
        unlock: { sourceItemId: "cloth", threshold: 8 },
    },
    {
        id: "tier6b",
        label: "Tier 6b",
        itemId: "bagged_soybeans",
        baseScore: 5000 * 64,
        displayRow: 5,
        // 袋詰め大豆は「第一の集大成」。最終ゴール演出は発酵軸の醤油（tier_soy_sauce）に移設した
        unlock: { sourceItemId: "cloth", threshold: 8 },
    },
    // ── 発酵軸（doc/26 §6.1）。大豆（tier2）から分岐し、繊維・包装軸と並行に進む ──
    // 麹は中間素材のため Tier 化しない（出荷対象外）。味噌・酒酢のアンロック元は「塩」に統一。
    // baseScore は doc/26 §6.2 の相対順序（醤油 > 麦焼酎 > 味噌 > 酢 > 塩）を保った仮値。
    // 醤油は現スコープの価格ピナクルとして袋詰め大豆（320000）を上回るよう置く。プレイテストで調整。
    {
        id: "tier_salt",
        label: "B-塩",
        itemId: "salt",
        baseScore: 600,
        displayRow: 6,
        unlock: { sourceItemId: "soybeans", threshold: 64 },
    },
    {
        id: "tier_miso",
        label: "B-味噌",
        itemId: "miso",
        baseScore: 50000,
        displayRow: 7,
        unlock: { sourceItemId: "salt", threshold: 64 },
    },
    {
        id: "tier_shochu",
        label: "B-麦焼酎",
        itemId: "shochu",
        baseScore: 200000,
        displayRow: 7,
        // 味噌と並行アンロック（doc/26 §6.1 B-酒酢）。ともに塩の累積出荷が条件
        unlock: { sourceItemId: "salt", threshold: 64 },
    },
    {
        id: "tier_vinegar",
        label: "B-酢",
        itemId: "vinegar",
        baseScore: 30000,
        displayRow: 7,
        // 味噌・麦焼酎と並行アンロック。日常調味料ゆえ発酵軸の中では安価
        unlock: { sourceItemId: "salt", threshold: 64 },
    },
    {
        id: "tier_soy_sauce",
        label: "B-醤油",
        itemId: "soy_sauce",
        baseScore: 400000,
        displayRow: 8,
        // 四軸合流・最長チェーン。味噌の累積出荷で開放される現スコープの最終ゴール
        unlock: { sourceItemId: "miso", threshold: 8 },
        isGoal: true,
    },
];
