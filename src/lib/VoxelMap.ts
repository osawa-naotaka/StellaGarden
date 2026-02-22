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

    get(pos: Pos3D): number | null {
        const index = this.posToIndex(pos);
        if (index < 0 || index >= this.voxels.length) {
            return null;
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

    getSurfacePosition(pos: Pos3D): Pos3D | null {
        // xとzのみを使用し、yは無視して上から探索
        for (let y = this.height - 1; y >= 0; y--) {
            const pos3d: Pos3D = { x: pos.x, y, z: pos.z };
            const vs = this.get(pos3d);
            if (vs && vs !== 0) {
                return pos3d; // 上から最初に見つかったセルの位置を返す
            }
        }
        return null; // 表面セルが見つからない場合はnullを返す
    }

    private posToIndex(pos: Pos3D): number {
        return pos.x + pos.y * this.width * this.depth + pos.z * this.width;
    }
}
