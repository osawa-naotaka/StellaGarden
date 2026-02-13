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

    getSurfaceCells(): T[][] {
        const surfaceCells: T[][] = [];
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                const cells = this.getSurfaceCell({ x, y: 0, z }); // yは無視されるので任意の値でOK
                if (cells.length > 0) {
                    surfaceCells.push(cells);
                }
            }
        }
        return surfaceCells;
    }

    getSurfaceCell(pos: Pos3D): T[] {
        // xとzのみを使用し、yは無視して上から探索
        for (let y = this.height - 1; y >= 0; y--) {
            const pos3d: Pos3D = { x: pos.x, y, z: pos.z };
            const cells = this.get(pos3d);
            if (cells.length > 0) {
                return cells; // 上から最初に見つかったセルの全オブジェクトを返す
            }
        }
        return []; // 表面セルが見つからない場合は空配列
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