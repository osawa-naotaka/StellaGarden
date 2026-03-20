import type { RecipeDef } from "../_boundary/interfaces";

export const RECIPES: readonly RecipeDef[] = [
    {
        id: "workbench",
        station: "hand",
        ingredients: [{ itemId: "trunk", count: 4 }],
        result: { itemId: "workbench", count: 1 },
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
