import type { Pos3D } from "../lib/VoxelMap";

export type TerrainType = "water" | "soil" | "grass" | "rock" | "air";
export type StaticEntityType = "tree" | "stone" | "bush";
export type DynamicEntityType = "player";
export type Direction = "left_up" | "right_up" | "left_down" | "right_down";
export type State = "Idle" | "walk" | "Dash";

export type DynamicEntity = {
    type: DynamicEntityType;
    pos: Pos3D;
    direction: Direction;
    state: State;
};

export type StaticEntity = {
    type: StaticEntityType;
    pos: Pos3D;
};

export type Terrain = {
    type: TerrainType;
    pos: Pos3D;
};

export type EentityType = TerrainType | StaticEntityType | DynamicEntityType;
export type Entity = DynamicEntity | StaticEntity | Terrain;

