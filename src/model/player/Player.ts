import type { Container, FederatedPointerEvent } from "pixi.js";
import { CHUNK_RENDER_MARGIN } from "../../lib/ChunkRenderer";
import type { Pos2D } from "../../lib/VoxelMap";
import { Inventory } from "./Inventory";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;
const MOVE_SPEED = 10; // タイル/秒

/** プレイヤーのカメラ位置・ズーム・入力処理を担う。
 *  ツールバーの状態は inventory に委譲している。 */
export class Player {
    readonly inventory: Inventory;

    private readonly target: Container;
    private readonly worldSize: Pos2D;
    private readonly tilePerViewport: Pos2D;

    private playerPosInWorld: Pos2D;
    private pointerPosInWorld: Pos2D = { x: 0, z: 0 };
    private pointerPosInGlobal: Pos2D = { x: 0, z: 0 };
    private zoomLevel_ = 1.0;
    private keyPressState: Record<string, boolean> = {};

    constructor(target: Container, opt: { start: Pos2D; worldSize: Pos2D; tilePerViewport: Pos2D }) {
        this.target = target;
        this.playerPosInWorld = { x: opt.start.x, z: opt.start.z };
        this.worldSize = { x: opt.worldSize.x, z: opt.worldSize.z };
        this.tilePerViewport = { x: opt.tilePerViewport.x, z: opt.tilePerViewport.z };
        this.inventory = new Inventory();
    }

    get playerPositionInWorld(): Pos2D {
        return this.playerPosInWorld;
    }

    get zoomLevel(): number {
        return this.zoomLevel_;
    }

    get pointerPositionInWorld(): Pos2D {
        return this.pointerPosInWorld;
    }

    /** イベントリスナーを登録し、解除用の dispose 関数を返す。 */
    setListeners(interactWithTileCallback: (pos: Pos2D) => void): () => void {
        const onKeyDown = (e: KeyboardEvent) => {
            this.keyPressState[e.key.toLowerCase()] = true;
        };
        window.addEventListener("keydown", onKeyDown);

        const onKeyUp = (e: KeyboardEvent) => {
            this.keyPressState[e.key.toLowerCase()] = false;
        };
        window.addEventListener("keyup", onKeyUp);

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            this.zoomLevel_ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomLevel_ + delta));
        };
        this.target.on("wheel", onWheel, { passive: false });

        this.target.interactive = true;
        const onPointerMove = (e: FederatedPointerEvent) => {
            this.pointerPosInGlobal.x = e.global.x;
            this.pointerPosInGlobal.z = e.global.y;
            this.updatePointerPositionInWorld();
        };
        this.target.on("pointermove", onPointerMove);

        const onPointerDown = (e: FederatedPointerEvent) => {
            if (e.button === 2) { // 右クリック
                this.pointerPosInGlobal.x = e.global.x;
                this.pointerPosInGlobal.z = e.global.y;
                this.updatePointerPositionInWorld();

                const x = Math.floor(this.pointerPosInWorld.x);
                const z = Math.floor(this.pointerPosInWorld.z);
                interactWithTileCallback({ x, z });
            }
        };
        this.target.on("pointerdown", onPointerDown);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            this.target.off("wheel", onWheel);
            this.target.off("pointermove", onPointerMove);
            this.target.off("pointerdown", onPointerDown);
        };
    }

    tick(deltaMS: number) {
        let dx = 0;
        let dz = 0;
        if (this.keyPressState.a || this.keyPressState.arrowleft) dx -= 2;
        if (this.keyPressState.d || this.keyPressState.arrowright) dx += 2;
        if (this.keyPressState.w || this.keyPressState.arrowup) dz -= 2;
        if (this.keyPressState.s || this.keyPressState.arrowdown) dz += 2;

        if (dx !== 0 || dz !== 0) {
            // 斜め移動を正規化
            if (dx !== 0 && dz !== 0) {
                const norm = 1 / Math.sqrt(2);
                dx *= norm;
                dz *= norm;
            }

            const dt = deltaMS / 1000;
            // チャンク描画時に CHUNK_RENDER_MARGIN タイル分のマージンを確保するため、
            // プレイヤー位置がその範囲内に収まるよう制限する。
            this.playerPosInWorld.x = Math.max(
                this.tilePerViewport.x / 2 + CHUNK_RENDER_MARGIN + 1,
                Math.min(this.worldSize.x - 1 - this.tilePerViewport.x / 2 - CHUNK_RENDER_MARGIN - 1, this.playerPosInWorld.x + dx * MOVE_SPEED * dt),
            );
            this.playerPosInWorld.z = Math.max(
                this.tilePerViewport.z / 2 + CHUNK_RENDER_MARGIN + 1,
                Math.min(this.worldSize.z - 1 - this.tilePerViewport.z / 2 - CHUNK_RENDER_MARGIN - 1, this.playerPosInWorld.z + dz * MOVE_SPEED * dt),
            );
        }
        this.updatePointerPositionInWorld();
    }

    private updatePointerPositionInWorld() {
        this.pointerPosInWorld.x =
            this.playerPosInWorld.x - this.tilePerViewport.x / 2 + (this.pointerPosInGlobal.x / (this.target.width * this.zoomLevel_)) * this.tilePerViewport.x;
        this.pointerPosInWorld.z =
            this.playerPosInWorld.z -
            this.tilePerViewport.z / 2 +
            (this.pointerPosInGlobal.z / (this.target.height * this.zoomLevel_)) * this.tilePerViewport.z;
    }
}
