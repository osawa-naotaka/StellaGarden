import type { Pos3D } from "../lib/VoxelMap";
import type { GameState } from "./GameState";

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

export abstract class Entity {
    private readonly entityKind: EentityType;
    private entityPos: Pos3D;

    constructor({ type, pos }: { type: EentityType; pos: Pos3D }) {
        this.entityKind = type;
        this.entityPos = pos;
    }

    get type() {
        return this.entityKind;
    }
    get pos() {
        return this.entityPos;
    }
    abstract get sprite(): string;
    abstract get spriteProps(): { w: number; h: number; anchorX: number; anchorY: number };
    interact(_gameState: GameState): void {}
}

export abstract class Terrain extends Entity {
    private entitiesOnTop: StaticEntity[] = [];
    constructor({ type, pos }: { type: TerrainType; pos: Pos3D }) {
        super({ type, pos });
    }

    get entities() {
        return this.entitiesOnTop;
    }

    addEntity(entity: StaticEntity) {
        this.entitiesOnTop.push(entity);
    }

    removeEntity(entity: StaticEntity) {
        this.entitiesOnTop = this.entitiesOnTop.filter((e) => e !== entity);
    }
}

export abstract class StaticEntity extends Entity {
    constructor({ type, pos }: { type: StaticEntityType; pos: Pos3D }) {
        super({ type, pos });
    }
}
