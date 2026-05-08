import type { IEventBroker, IVoxelWriter } from "../_boundary/interfaces";
import { TERRAIN_TYPES } from "../engine/VoxelDefs";

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
    private voxels: BigUint64Array;
    private riversideCells_: Uint32Array = new Uint32Array(0);
    private broker: IEventBroker | null = null;

    /** ゲームプレイ開始後に EventBroker を注入する。地形生成前は呼ばないこと。 */
    setEventBroker(broker: IEventBroker): void {
        this.broker = broker;
    }

    /** 内部ボクセル配列への読み取り専用参照を返す（セーブ用）。 */
    getVoxelsBuffer(): BigUint64Array {
        return this.voxels;
    }

    /** 外部から voxels 配列を上書きする（ロード用）。サイズが一致しない場合はエラー。 */
    setVoxelsBuffer(buffer: BigUint64Array): void {
        if (buffer.length !== this.voxels.length) {
            throw new Error(`Voxel buffer size mismatch: expected ${this.voxels.length}, got ${buffer.length}`);
        }
        this.voxels = buffer;
    }

    /** 大河水辺セルインデックス配列（粘土の再生成対象）。地形生成時に確定しセーブデータに保存される。 */
    get riversideCells(): Uint32Array {
        return this.riversideCells_;
    }

    setRiversideCells(cells: Uint32Array): void {
        this.riversideCells_ = cells;
    }

    constructor(width: number, height: number, depth: number, horizonHeight: number) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.horizonHeight = horizonHeight;
        this.voxels = new BigUint64Array(width * height * depth).fill(0n);
    }

    get(pos: Pos3D): bigint {
        const index = this.posToIndex(pos);
        if (index < 0 || index >= this.voxels.length) {
            throw new Error(`Position out of bounds: (${pos.x}, ${pos.y}, ${pos.z})`);
        }
        return this.voxels[index];
    }

    set(voxel: bigint, pos: Pos3D): void {
        const index = this.posToIndex(pos);
        this.voxels[index] = voxel;
        this.broker?.publish("terrain_changed", { pos, voxel });
    }

    remove(pos: Pos3D): void {
        const index = this.posToIndex(pos);
        this.voxels[index] = 0n;
        this.broker?.publish("terrain_changed", { pos, voxel: 0n });
    }

    getSurface(pos: Pos3D): bigint {
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
            if (vs && vs !== 0n) {
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
            if (voxel === 0n) continue;
            const terrainType = Number(voxel & 0xffn);
            if (terrainType === TERRAIN_TYPES.water || terrainType === TERRAIN_TYPES.waterSource) continue;
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
