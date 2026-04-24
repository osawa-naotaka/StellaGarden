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
        id: "hardwood_teeth",
        station: "workbench",
        ingredients: [{ itemId: "trunk", count: 1 }],
        result: { itemId: "hardwood_teeth", count: 1 },        
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
        id: "stone_hammer",
        station: "workbench",
        ingredients: [
            { itemId: "stone", count: 1 },
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "stone_hammer", count: 1 },
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
        id: "scutching_board",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "scutching_board", count: 1 },
    },
    {
        id: "board",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "board", count: 4 },
    },
    {
        id: "screw_rod",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "screw_rod", count: 1 },
    },
    {
        id: "screw_presses",
        station: "workbench",
        ingredients: [
            { itemId: "board", count: 4 },
            { itemId: "screw_rod", count: 1 },
        ],
        result: { itemId: "screw_presses", count: 1 },
    },
    {
        id: "shaft",
        station: "workbench",
        ingredients: [
            { itemId: "trunk", count: 1 },
        ],
        result: { itemId: "shaft", count: 1 },
    },
    {
        id: "spinning_wheel",
        station: "workbench",
        ingredients: [
          { itemId: "board", count: 2 },
          { itemId: "shaft", count: 1 },
        ],
        result: { itemId: "spinning_wheel", count: 1 },
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
        id: "loom",
        station: "workbench",
        ingredients: [
          { itemId: "board", count: 4 },
          { itemId: "trunk", count: 2 },
        ],
        result: { itemId: "loom", count: 1 },
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
        id: "frame",
        station: "workbench",
        ingredients: [
          { itemId: "board", count: 1 },
        ],
        result: { itemId: "frame", count: 1 },
    },
    {
        id: "wooden_hoes",
        station: "workbench",
        ingredients: [
          { itemId: "trunk", count: 2 },
        ],
        result: { itemId: "wooden_hoes", count: 1 },
    },
    {
        id: "wooden_shovel",
        station: "workbench",
        ingredients: [
          { itemId: "trunk", count: 2 },
        ],
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
        ingredients: [
          { itemId: "clay", count: 4 },
        ],
        result: { itemId: "clay_watering_can", count: 1 },
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
    {
        id: "pipe",
        station: "workbench",
        ingredients: [
          { itemId: "board", count: 4 },  
        ],
        result: { itemId: "pipe", count: 1 },
    },
];
