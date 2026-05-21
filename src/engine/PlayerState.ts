import type { Direction8, IEventBroker, IPlayerStateWriter, IVoxelReader } from "../_boundary/interfaces";
import { CHUNK_RENDER_MARGIN } from "../lib/ChunkRenderer";
import type { Pos2D, Size2D } from "../lib/VoxelMap";
import { Inventory } from "./Inventory";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "./VoxelDefs";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const MOVE_SPEED = 3; // タイル/秒

/** プレイヤーの位置・カメラ状態を管理する純粋なデータクラス。PixiJS に依存しない。 */
export class PlayerState implements IPlayerStateWriter {
    readonly inventory: Inventory;
    readonly worldSize: Size2D;
    private tilePerViewport_: Size2D;

    private posInWorld_: Pos2D;
    private pointerPosInWorld_: Pos2D = { x: 0, z: 0 };
    private zoomLevel_ = 1.0;
    private facing_: Direction8 = "down";
    private broker: IEventBroker | null = null;
    private readonly voxelMap: IVoxelReader;

    /** ゲームプレイ開始後に EventBroker を注入し、イベント購読を登録する。
     *  返り値の dispose 関数で購読を解除する。 */
    setEventBroker(broker: IEventBroker): () => void {
        this.broker = broker;
        const d1 = broker.subscribe("player_move", ({ dx, dz, deltaMS }) => {
            this.moveBy(dx, dz, deltaMS);
        });
        const d2 = broker.subscribe("zoom_change", ({ delta }) => {
            this.adjustZoom(delta);
        });
        return () => {
            d1();
            d2();
        };
    }

    constructor(opt: {
        start: Pos2D;
        worldSize: Size2D;
        tilePerViewport: Size2D;
        voxelMap: IVoxelReader;
        zoomLevel?: number;
        facing?: Direction8;
        inventory?: Inventory;
    }) {
        this.inventory = opt.inventory ?? new Inventory();
        this.posInWorld_ = { x: opt.start.x, z: opt.start.z };
        this.worldSize = { w: opt.worldSize.w, h: opt.worldSize.h };
        this.tilePerViewport_ = {
            w: opt.tilePerViewport.w,
            h: opt.tilePerViewport.h,
        };
        this.voxelMap = opt.voxelMap;
        if (opt.zoomLevel !== undefined) this.zoomLevel_ = opt.zoomLevel;
        if (opt.facing !== undefined) this.facing_ = opt.facing;
    }

    get posInWorld(): Pos2D {
        return this.posInWorld_;
    }

    get pointerPosInWorld(): Pos2D {
        return this.pointerPosInWorld_;
    }

    get zoomLevel(): number {
        return this.zoomLevel_;
    }

    get facing(): Direction8 {
        return this.facing_;
    }

    get tilePerViewport(): Size2D {
        return this.tilePerViewport_;
    }

    setTilePerViewport(size: Size2D): void {
        this.tilePerViewport_.w = size.w;
        this.tilePerViewport_.h = size.h;
    }

    /** ゲームループから毎フレーム呼ぶ。キー状態に基づいた移動量を適用する。
     *  dx, dz はすでに正規化済みの値を渡すこと。 */
    moveBy(dx: number, dz: number, deltaMS: number): void {
        if (dx !== 0 || dz !== 0) {
            if (dx < 0 && dz === 0) this.facing_ = "left";
            else if (dx > 0 && dz === 0) this.facing_ = "right";
            else if (dx === 0 && dz < 0) this.facing_ = "up";
            else if (dx === 0 && dz > 0) this.facing_ = "down";
            else if (dx < 0 && dz < 0) this.facing_ = "up_left";
            else if (dx > 0 && dz < 0) this.facing_ = "up_right";
            else if (dx < 0 && dz > 0) this.facing_ = "down_left";
            else if (dx > 0 && dz > 0) this.facing_ = "down_right";
        }

        const dt = deltaMS / 1000;
        const speed = MOVE_SPEED * dt;
        const minX = this.tilePerViewport.w / 2 + CHUNK_RENDER_MARGIN + 1;
        const maxX = this.worldSize.w - 1 - this.tilePerViewport.w / 2 - CHUNK_RENDER_MARGIN - 1;
        const minZ = this.tilePerViewport.h / 2 + CHUNK_RENDER_MARGIN + 1;
        const maxZ = this.worldSize.h - 1 - this.tilePerViewport.h / 2 - CHUNK_RENDER_MARGIN - 1;

        // X軸の移動を試みる
        const clampedX = Math.max(minX, Math.min(maxX, this.posInWorld_.x + dx * speed));
        if (!this.isBlocked(Math.floor(clampedX), Math.floor(this.posInWorld_.z))) {
            this.posInWorld_.x = clampedX;
        }

        // Z軸の移動を試みる（X軸の結果を反映した位置で判定）
        const clampedZ = Math.max(minZ, Math.min(maxZ, this.posInWorld_.z + dz * speed));
        if (!this.isBlocked(Math.floor(this.posInWorld_.x), Math.floor(clampedZ))) {
            this.posInWorld_.z = clampedZ;
        }

        this.broker?.publish("player_position_changed", {
            posInWorld: this.posInWorld_,
            zoomLevel: this.zoomLevel_,
        });
    }

    /** 指定タイルが移動不可かどうかを返す。 */
    private isBlocked(tileX: number, tileZ: number): boolean {
        // マップ範囲外はブロック
        if (tileX < 0 || tileX >= this.worldSize.w || tileZ < 0 || tileZ >= this.worldSize.h) return true;

        const surfacePos = this.voxelMap.getSurfacePosition({ x: tileX, y: 0, z: tileZ });
        const voxel = this.voxelMap.get(surfacePos);
        const terrainType = getTerrainTypeFromVoxel(voxel);
        const entityType = getEntityTypeFromVoxel(voxel);

        // 水タイルはブロック
        if (terrainType === TERRAIN_TYPES.water || terrainType === TERRAIN_TYPES.waterSource) return true;

        // 作物系エンティティと畝間水路（potato, soy, flax, sunflower, pipe1）は通過可能
        if (
            entityType === ENTITY_TYPES.potato ||
            entityType === ENTITY_TYPES.soy ||
            entityType === ENTITY_TYPES.flax ||
            entityType === ENTITY_TYPES.sunflower ||
            entityType === ENTITY_TYPES.furrow_canal ||
            entityType === ENTITY_TYPES.shaft ||
            entityType === ENTITY_TYPES.rail
        )
            return false;

        // その他のエンティティが存在すればブロック
        if (entityType !== ENTITY_TYPES.none) return true;

        return false;
    }

    /** ポインタのワールド座標を更新する。InputHandler から呼ぶ。 */
    setPointerPosInWorld(x: number, z: number): void {
        this.pointerPosInWorld_.x = x;
        this.pointerPosInWorld_.z = z;
    }

    /** ズームレベルを変更する。EventBroker 経由で zoom_change を受け取った App.tsx から呼ぶ。 */
    adjustZoom(delta: number): void {
        this.zoomLevel_ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomLevel_ + delta));
        this.broker?.publish("player_position_changed", {
            posInWorld: this.posInWorld_,
            zoomLevel: this.zoomLevel_,
        });
    }
}
