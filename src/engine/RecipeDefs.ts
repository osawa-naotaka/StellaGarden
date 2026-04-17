import type { RecipeDef } from "../_boundary/interfaces";

export const RECIPES: readonly RecipeDef[] = [
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
            { itemId: "trunk", count: 12 },
            { itemId: "stem", count: 2 },
            { itemId: "dirt", count: 2 },
        ],
        result: { itemId: "kiln", count: 1 },
    },
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
        ingredients: [
            { itemId: "stone", count: 4 },
        ],
        result: { itemId: "anvil", count: 1 },
    },
    {
        id: "tongs",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "tongs", count: 1 },
    },
    {
        id: "compost_bin",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 4 }],
        result: { itemId: "compost_bin", count: 1 },
    },
    {
        id: "threshing_machine",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 2 }],
        result: { itemId: "threshing_machine", count: 1 },
    },
];
