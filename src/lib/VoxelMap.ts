import type { IEventBroker, IVoxelWriter } from "../_boundary/interfaces";

export type Pos2D = {
    x: number;
    z: number;
};

export type Size2D = {
    w: number;
    h: number;
};

export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export class VoxelMap implements IVoxelWriter {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly horizonHeight: number;
    private voxels: Uint32Array;
    private broker: IEventBroker | null = null;

    /** ゲームプレイ開始後に EventBroker を注入する。地形生成前は呼ばないこと。 */
    setEventBroker(broker: IEventBroker): void {
        this.broker = broker;
    }

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
        this.broker?.publish("terrain_changed", { pos, voxel });
    }

    remove(pos: Pos3D): void {
        const index = this.posToIndex(pos);
        this.voxels[index] = 0;
        this.broker?.publish("terrain_changed", { pos, voxel: 0 });
    }

    getSurface(pos: Pos3D): number {
        const surfacePos = this.getSurfacePosition(pos);
        return this.get(surfacePos);
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

    getGroundSurfacePosition(pos: Pos3D): Pos3D {
        if (pos.x < 0 || pos.x >= this.width || pos.z < 0 || pos.z >= this.depth) {
            throw new Error(`Position out of bounds: (${pos.x}, ${pos.y}, ${pos.z})`);
        }

        // 水タイル（terrain type 1 = water、6 = waterSource）をスキップして上から探索
        for (let y = this.height - 1; y >= 0; y--) {
            const pos3d: Pos3D = { x: pos.x, y, z: pos.z };
            const voxel = this.get(pos3d);
            if (voxel === 0) continue;
            const terrainType = voxel & 0xff;
            if (terrainType === 1 || terrainType === 6) continue;
            return pos3d;
        }

        throw new Error(`No ground surface found at (${pos.x}, ${pos.z})`);
    }

    private posToIndex(pos: Pos3D): number {
        if (pos.x < 0 || pos.x >= this.width || pos.y < 0 || pos.y >= this.height || pos.z < 0 || pos.z >= this.depth) {
            throw new Error(`Position out of bounds: (${pos.x}, ${pos.y}, ${pos.z})`);
        }
        return pos.x + pos.y * this.width * this.depth + pos.z * this.width;
    }
}
