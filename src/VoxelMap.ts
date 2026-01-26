export type Pos2D = {
    x: number;
    y: number;
};


export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export type ContainerType = {
    pos: Pos3D;
};

export class VoxelMap<T extends ContainerType> {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly horizonHeight: number;
    private cells: T[][];

    constructor(width: number, height: number, depth: number, horizonHeight: number) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.horizonHeight = horizonHeight;
        this.cells = new Array(width * height * depth).fill(null).map(() => []);
    }

    get(pos: Pos3D): T[] {
        const index = this.posToIndex(pos);
        if (index < 0 || index >= this.cells.length) {
            return [];
        }
        return this.cells[index];
    }

    set(cell: T): void {
        const index = this.posToIndex(cell.pos);
        this.cells[index].push(cell);
    }

    remove(cell: T): void {
        const index = this.posToIndex(cell.pos);
        this.cells[index] = this.cells[index].filter((c) => c !== cell);
    }

    clear(pos: Pos3D): void {
        const index = this.posToIndex(pos);
        this.cells[index] = [];
    }

    isSurface(pos: Pos3D): boolean {
        if (pos.y >= this.height - 1) {
            return true;
        }
        const aboveIndex = this.posToIndex({ x: pos.x, y: pos.y + 1, z: pos.z });
        return this.cells[aboveIndex].length === 0;
    }

    duplicate(): VoxelMap<T> {
        const newMap = new VoxelMap<T>(this.width, this.height, this.depth, this.horizonHeight);
        for (let i = 0; i < this.cells.length; i++) {
            newMap.cells[i] = [...this.cells[i]];
        }
        return newMap;
    }

    private posToIndex(pos: Pos3D): number {
        return pos.x + pos.y * this.width * this.depth + pos.z * this.width;
    }
}