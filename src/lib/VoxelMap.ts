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
    private voxels: (T | null)[];

    constructor(width: number, height: number, depth: number, horizonHeight: number) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.horizonHeight = horizonHeight;
        this.voxels = new Array(width * height * depth).fill(null);
    }

    get(pos: Pos3D): T | null {
        const index = this.posToIndex(pos);
        if (index < 0 || index >= this.voxels.length) {
            return null;
        }
        return this.voxels[index];
    }

    set(voxel: T): void {
        const index = this.posToIndex(voxel.pos);
        this.voxels[index] = voxel;
    }

    remove(voxel: T): void {
        const index = this.posToIndex(voxel.pos);
        this.voxels[index] = null;
    }

    getSurfaceVoxels(): T[] {
        const surfaceVoxels: T[] = [];
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                const voxel = this.getSurfaceVoxel({ x, y: 0, z }); // yは無視されるので任意の値でOK
                if (voxel) {
                    surfaceVoxels.push(voxel);
                }
            }
        }
        return surfaceVoxels;
    }

    getSurfaceVoxel(pos: Pos3D): T | null {
        // xとzのみを使用し、yは無視して上から探索
        for (let y = this.height - 1; y >= 0; y--) {
            const pos3d: Pos3D = { x: pos.x, y, z: pos.z };
            const vs = this.get(pos3d);
            if (vs) {
                return vs; // 上から最初に見つかったセルの全オブジェクトを返す
            }
        }
        return null; // 表面セルが見つからない場合はnullを返す
    }

    isSurface(pos: Pos3D): boolean {
        if (pos.y >= this.height - 1) {
            return true;
        }
        const aboveIndex = this.posToIndex({ x: pos.x, y: pos.y + 1, z: pos.z });
        return this.voxels[aboveIndex] === null;
    }

    duplicate(): VoxelMap<T> {
        const newMap = new VoxelMap<T>(this.width, this.height, this.depth, this.horizonHeight);
        for (let i = 0; i < this.voxels.length; i++) {
            newMap.voxels[i] = this.voxels[i];
        }
        return newMap;
    }

    private posToIndex(pos: Pos3D): number {
        return pos.x + pos.y * this.width * this.depth + pos.z * this.width;
    }
}
