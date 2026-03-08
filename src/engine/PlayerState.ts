import type { IEventBroker, IPlayerStateWriter } from "../_boundary/interfaces";
import { CHUNK_RENDER_MARGIN } from "../lib/ChunkRenderer";
import type { Pos2D } from "../lib/VoxelMap";
import { Inventory } from "./Inventory";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const MOVE_SPEED = 10; // タイル/秒

/** プレイヤーの位置・カメラ状態を管理する純粋なデータクラス。PixiJS に依存しない。 */
export class PlayerState implements IPlayerStateWriter {
    readonly inventory: Inventory;
    readonly worldSize: Pos2D;
    readonly tilePerViewport: Pos2D;

    private posInWorld_: Pos2D;
    private pointerPosInWorld_: Pos2D = { x: 0, z: 0 };
    private zoomLevel_ = 2.0;
    private broker: IEventBroker | null = null;

    /** ゲームプレイ開始後に EventBroker を注入する。 */
    setEventBroker(broker: IEventBroker): void {
        this.broker = broker;
    }

    constructor(opt: { start: Pos2D; worldSize: Pos2D; tilePerViewport: Pos2D }) {
        this.inventory = new Inventory();
        this.posInWorld_ = { x: opt.start.x, z: opt.start.z };
        this.worldSize = { x: opt.worldSize.x, z: opt.worldSize.z };
        this.tilePerViewport = { x: opt.tilePerViewport.x, z: opt.tilePerViewport.z };
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

    /** ゲームループから毎フレーム呼ぶ。キー状態に基づいた移動量を適用する。
     *  dx, dz はすでに正規化済みの値を渡すこと。 */
    moveBy(dx: number, dz: number, deltaMS: number): void {
        const dt = deltaMS / 1000;
        this.posInWorld_.x = Math.max(
            this.tilePerViewport.x / 2 + CHUNK_RENDER_MARGIN + 1,
            Math.min(this.worldSize.x - 1 - this.tilePerViewport.x / 2 - CHUNK_RENDER_MARGIN - 1, this.posInWorld_.x + dx * MOVE_SPEED * dt),
        );
        this.posInWorld_.z = Math.max(
            this.tilePerViewport.z / 2 + CHUNK_RENDER_MARGIN + 1,
            Math.min(this.worldSize.z - 1 - this.tilePerViewport.z / 2 - CHUNK_RENDER_MARGIN - 1, this.posInWorld_.z + dz * MOVE_SPEED * dt),
        );
        this.broker?.publish("player_position_changed", { posInWorld: this.posInWorld_, zoomLevel: this.zoomLevel_ });
    }

    /** ポインタのワールド座標を更新する。InputHandler から呼ぶ。 */
    setPointerPosInWorld(x: number, z: number): void {
        this.pointerPosInWorld_.x = x;
        this.pointerPosInWorld_.z = z;
    }

    /** ズームレベルを変更する。EventBroker 経由で zoom_change を受け取った App.tsx から呼ぶ。 */
    adjustZoom(delta: number): void {
        this.zoomLevel_ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomLevel_ + delta));
        this.broker?.publish("player_position_changed", { posInWorld: this.posInWorld_, zoomLevel: this.zoomLevel_ });
    }
}
