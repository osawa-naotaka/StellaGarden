export type Pos2D = {
    x: number;
    y: number;
};

export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export class VoxelMap {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly horizonHeight: number;
    private voxels: Uint32Array;

    constructor(width: number, height: number, depth: number, horizonHeight: number) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.horizonHeight = horizonHeight;
        this.voxels = new Uint32Array(width * height * depth).fill(0);
    }

    get(pos: Pos3D): number {
        const index = this.posToIndex(pos);
        if (index < 0 || index >= this.voxels.length) {
            throw new Error(`Position out of bounds: (${pos.x}, ${pos.y}, ${pos.z})`);
        }
        return this.voxels[index];
    }

    set(voxel: number, pos: Pos3D): void {
        const index = this.posToIndex(pos);
        this.voxels[index] = voxel;
    }

    remove(pos: Pos3D): void {
        const index = this.posToIndex(pos);
        this.voxels[index] = 0;
    }

    getSurfacePositions(): Pos3D[] {
        const surfacePositions: Pos3D[] = [];
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                const pos = this.getSurfacePosition({ x, y: 0, z }); // yは無視されるので任意の値でOK
                if (pos) {
                    surfacePositions.push(pos);
                }
            }
        }
        return surfacePositions;
    }

    getSurfacePosition(pos: Pos3D): Pos3D {
        if (pos.x < 0 || pos.x >= this.width || pos.z < 0 || pos.z >= this.depth) {
            throw new Error(`Position out of bounds: (${pos.x}, ${pos.y}, ${pos.z})`);
        }

        // xとzのみを使用し、yは無視して上から探索
        for (let y = this.height - 1; y >= 0; y--) {
            const pos3d: Pos3D = { x: pos.x, y, z: pos.z };
            const vs = this.get(pos3d);
            if (vs && vs !== 0) {
                return pos3d; // 上から最初に見つかったセルの位置を返す
            }
        }

        throw new Error(`No surface found at (${pos.x}, ${pos.z})`);
    }

    private posToIndex(pos: Pos3D): number {
        if (pos.x < 0 || pos.x >= this.width || pos.y < 0 || pos.y >= this.height || pos.z < 0 || pos.z >= this.depth) {
            throw new Error(`Position out of bounds: (${pos.x}, ${pos.y}, ${pos.z})`);
        }
        return pos.x + pos.y * this.width * this.depth + pos.z * this.width;
    }
}
