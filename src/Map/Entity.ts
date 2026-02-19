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

export type EentityType = TerrainType | StaticEntityType | DynamicEntityType;

export class Entity {
    private readonly entityKind: EentityType;
    private entityPos: Pos3D;

    constructor({ type, pos }: { type: EentityType; pos: Pos3D }) {
        this.entityKind = type;
        this.entityPos = pos;
    }

    get type() { return this.entityKind }
    get pos() { return this.entityPos }
}

export class Terrain extends Entity {
    private entitiesOnTop: StaticEntity[] = [];
    constructor({ type, pos }: { type: TerrainType; pos: Pos3D }) {
        super({ type, pos });
    }

    get entities() { return this.entitiesOnTop };

    addEntity(entity: StaticEntity) {
        this.entitiesOnTop.push(entity);
    }
    
    remomveEntity(entity: StaticEntity) {
        this.entitiesOnTop = this.entitiesOnTop.filter(e => e !== entity);
    }
}

export class StaticEntity extends Entity {
    constructor({ type, pos }: { type: StaticEntityType; pos: Pos3D }) {
        super({ type, pos });
    }
}