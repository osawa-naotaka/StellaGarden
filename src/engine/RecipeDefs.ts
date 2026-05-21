import type { RecipeDef } from "../_boundary/interfaces";

export const RECIPES: readonly RecipeDef[] = [
    // ────────────────────────────────────────────────────────────────
    // フェーズ1: 金属なしの生活基盤
    // ────────────────────────────────────────────────────────────────
    {
        id: "workbench",
        station: "hand",
        ingredients: [{ itemId: "trunk", count: 4 }],
        result: { itemId: "workbench", count: 1 },
    },
    {
        id: "bonfire",
        station: "hand",
        ingredients: [{ itemId: "stone", count: 4 }],
        result: { itemId: "bonfire", count: 1 },
    },
    {
        id: "kiln",
        station: "hand",
        ingredients: [
            { itemId: "trunk", count: 4 },
            { itemId: "dirt", count: 12 },
            { itemId: "stem", count: 2 },
        ],
        result: { itemId: "kiln", count: 1 },
    },
    {
        id: "compost_bin",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 4 }],
        result: { itemId: "compost_bin", count: 1 },
    },
    {
        id: "hardwood_teeth",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 1 }],
        requiredTool: { itemId: "chisel" },
        result: { itemId: "hardwood_teeth", count: 4 },
    },
    {
        id: "threshing_machine",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 2 },
            { itemId: "hardwood_teeth", count: 1 },
        ],
        result: { itemId: "threshing_machine", count: 1 },
    },
    {
        id: "wooden_hoes",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 2 }],
        result: { itemId: "wooden_hoes", count: 1 },
    },
    {
        id: "wooden_shovel",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 2 }],
        result: { itemId: "wooden_shovel", count: 1 },
    },
    {
        id: "stone_axe",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "stone", count: 1 },
        ],
        result: { itemId: "stone_axe", count: 1 },
    },
    {
        id: "stone_pickaxe",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "stone", count: 1 },
        ],
        result: { itemId: "stone_pickaxe", count: 1 },
    },
    {
        id: "stone_sickle",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "stone", count: 1 },
        ],
        result: { itemId: "stone_sickle", count: 1 },
    },
    {
        id: "clay_watering_can",
        station: "workbench",
        ingredients: [{ itemId: "clay", count: 4 }],
        result: { itemId: "clay_watering_can", count: 1 },
    },

    // ────────────────────────────────────────────────────────────────
    // フェーズ2: 金属加工の開始
    // ────────────────────────────────────────────────────────────────
    {
        id: "forge",
        station: "hand",
        ingredients: [
            { itemId: "clay", count: 8 },
            { itemId: "stone", count: 4 },
        ],
        result: { itemId: "forge", count: 1 },
    },
    {
        id: "anvil",
        station: "workbench",
        ingredients: [{ itemId: "stone", count: 4 }],
        result: { itemId: "anvil", count: 1 },
    },
    {
        id: "stone_hammer",
        station: "workbench",
        ingredients: [
            { itemId: "stone", count: 1 },
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "stone_hammer", count: 1 },
    },
    {
        id: "tongs",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 1 }],
        result: { itemId: "tongs", count: 1 },
    },
    {
        id: "froe",
        station: "workbench",
        ingredients: [
            { itemId: "blade", count: 1 },
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "froe", count: 1 },
    },
    {
        id: "chisel",
        station: "workbench",
        ingredients: [
            { itemId: "blade", count: 1 },
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "chisel", count: 1 },
    },
    {
        id: "hoes",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "blade", count: 1 },
        ],
        result: { itemId: "hoes", count: 1 },
    },
    {
        id: "shovel",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "blade", count: 1 },
        ],
        result: { itemId: "shovel", count: 1 },
    },
    {
        id: "axe",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "blade", count: 1 },
        ],
        result: { itemId: "axe", count: 1 },
    },
    {
        id: "pickaxe",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "blade", count: 1 },
        ],
        result: { itemId: "pickaxe", count: 1 },
    },
    {
        id: "sickle",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "blade", count: 1 },
        ],
        result: { itemId: "sickle", count: 1 },
    },

    // ────────────────────────────────────────────────────────────────
    // フェーズ3: 板加工
    // ────────────────────────────────────────────────────────────────
    {
        id: "board",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 1 }],
        requiredTool: { itemId: "froe" },
        result: { itemId: "board", count: 4 },
    },
    {
        id: "screw_rod",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 1 }],
        requiredTool: { itemId: "chisel" },
        result: { itemId: "screw_rod", count: 1 },
    },
    {
        id: "frame",
        station: "workbench",
        ingredients: [{ itemId: "board", count: 1 }],
        requiredTool: { itemId: "chisel" },
        result: { itemId: "frame", count: 1 },
    },
    {
        id: "scutching_board",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 2 },
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "scutching_board", count: 1 },
    },

    // ────────────────────────────────────────────────────────────────
    // 機械中間素材（共通部品）
    // ────────────────────────────────────────────────────────────────
    {
        id: "wooden_gear",
        station: "workbench",
        ingredients: [{ itemId: "board", count: 1 }],
        requiredTool: { itemId: "chisel" },
        result: { itemId: "wooden_gear", count: 2 },
    },
    {
        id: "bevel_gear",
        station: "workbench",
        ingredients: [
            { itemId: "wooden_gear", count: 1 },
            { itemId: "trunk", count: 1 },
        ],
        requiredTool: { itemId: "chisel" },
        result: { itemId: "bevel_gear", count: 1 },
    },
    {
        id: "wheel",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 4 },
            { itemId: "shaft", count: 1 },
        ],
        requiredTool: { itemId: "chisel" },
        result: { itemId: "wheel", count: 1 },
    },
    {
        id: "drum",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 4 },
            { itemId: "shaft", count: 1 },
            { itemId: "iron_teeth", count: 4 },
        ],
        result: { itemId: "drum", count: 1 },
    },
    {
        id: "pulley",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 1 },
            { itemId: "shaft", count: 1 },
        ],
        result: { itemId: "pulley", count: 1 },
    },
    // 扱き歯（iron_teeth）は作業台ではなく金床で熱した隕鉄から鍛造する。
    // 金床は刃と扱き歯のレシピを併せ持ち、UI のドロップダウンで出力先を選択する。
    // → engine/ProcessingRecipes.ts の MANUAL_PROCESSING_DEFS を参照。

    // ────────────────────────────────────────────────────────────────
    // 動力系
    // ────────────────────────────────────────────────────────────────
    {
        id: "shaft",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
            { itemId: "bevel_gear", count: 1 },
        ],
        result: { itemId: "shaft", count: 2 },
    },
    {
        id: "waterwheel",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 8 },
            { itemId: "wheel", count: 2 },
            { itemId: "shaft", count: 1 },
        ],
        result: { itemId: "waterwheel", count: 1 },
    },

    // ────────────────────────────────────────────────────────────────
    // フェーズ3: 加工施設（手動）
    // ────────────────────────────────────────────────────────────────
    {
        id: "screw_presses",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 4 },
            { itemId: "screw_rod", count: 1 },
            { itemId: "frame", count: 1 },
            { itemId: "wooden_gear", count: 1 },
        ],
        result: { itemId: "screw_presses", count: 1 },
    },
    {
        id: "soaking_basket",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 8 },
            { itemId: "clay", count: 2 },
        ],
        result: { itemId: "soaking_basket", count: 1 },
    },
    {
        id: "spinning_wheel",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 2 },
            { itemId: "shaft", count: 1 },
            { itemId: "wheel", count: 1 },
            { itemId: "pulley", count: 1 },
            { itemId: "rope", count: 1 },
        ],
        result: { itemId: "spinning_wheel", count: 1 },
    },
    {
        id: "loom",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 4 },
            { itemId: "frame", count: 2 },
        ],
        result: { itemId: "loom", count: 1 },
    },

    // ────────────────────────────────────────────────────────────────
    // 灌漑・物流
    // ────────────────────────────────────────────────────────────────
    {
        id: "furrow_canal",
        station: "workbench",
        ingredients: [{ itemId: "board", count: 2 }],
        requiredTool: { itemId: "froe" },
        result: { itemId: "furrow_canal", count: 4 },
    },
    {
        id: "chest",
        station: "workbench",
        ingredients: [{ itemId: "board", count: 4 }],
        result: { itemId: "chest", count: 1 },
    },
    {
        id: "rail",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 2 },
            { itemId: "rope", count: 1 },
        ],
        requiredTool: { itemId: "froe" },
        result: { itemId: "rail", count: 4 },
    },

    // ────────────────────────────────────────────────────────────────
    // 自動化（水動力機械・台車・ウインチ）
    // ────────────────────────────────────────────────────────────────
    {
        id: "auto_thresher",
        station: "workbench",
        ingredients: [
            { itemId: "drum", count: 1 },
            { itemId: "frame", count: 2 },
            { itemId: "wooden_gear", count: 2 },
            { itemId: "board", count: 4 },
            { itemId: "shaft", count: 1 },
        ],
        result: { itemId: "auto_thresher", count: 1 },
    },
    {
        id: "winch",
        station: "workbench",
        ingredients: [
            { itemId: "drum", count: 1 },
            { itemId: "wooden_gear", count: 1 },
            { itemId: "pulley", count: 1 },
            { itemId: "frame", count: 1 },
            { itemId: "rope", count: 2 },
        ],
        result: { itemId: "winch", count: 1 },
    },
    {
        id: "cart",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 4 },
            { itemId: "wheel", count: 2 },
            { itemId: "frame", count: 1 },
        ],
        result: { itemId: "cart", count: 1 },
    },

    // ────────────────────────────────────────────────────────────────
    // 繊維・出荷
    // ────────────────────────────────────────────────────────────────
    {
        id: "rope",
        station: "hand",
        ingredients: [{ itemId: "thread", count: 4 }],
        result: { itemId: "rope", count: 1 },
    },
    {
        id: "bag",
        station: "workbench",
        ingredients: [
            { itemId: "thread", count: 1 },
            { itemId: "cloth", count: 1 },
        ],
        result: { itemId: "bag", count: 1 },
    },
    {
        id: "bagged_soybeans",
        station: "hand",
        ingredients: [
            { itemId: "bag", count: 1 },
            { itemId: "soybeans", count: 64 },
        ],
        result: { itemId: "bagged_soybeans", count: 1 },
    },
    {
        id: "bagged_potato",
        station: "hand",
        ingredients: [
            { itemId: "bag", count: 1 },
            { itemId: "potato", count: 64 },
        ],
        result: { itemId: "bagged_potatos", count: 1 },
    },
];
