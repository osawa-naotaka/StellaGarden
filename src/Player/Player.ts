import type { Container, FederatedPointerEvent } from "pixi.js";
import type { Pos2D } from "../lib/VoxelMap";
import { TILE_PER_VIEWPORT } from "../TopViewMap/TopViewMap";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export class Player {
    private readonly target: Container;
    private posInWorld: Pos2D;
    private viewSize: Pos2D;
    private pointerInGlobal: Pos2D = { x: 0, z: 0 };
    private speed = 10; // タイル/秒
    private zoom_level = 1.0;
    private state: Record<string, boolean> = {};
    private onkeydownListener: ((e: KeyboardEvent) => void) | null = null;
    private onkeyupListener: ((e: KeyboardEvent) => void) | null = null;
    private onWheel: ((e: WheelEvent) => void) | null = null;
    private onPointerMove: ((e: FederatedPointerEvent) => void) | null = null;
    private pointerWorldPos: Pos2D = { x: 0, z: 0 };

    constructor(target: Container, opt: { start: Pos2D; viewSize: Pos2D }) {
        this.target = target;
        this.posInWorld = { x: opt.start.x, z: opt.start.z };
        this.viewSize = { x: opt.viewSize.x, z: opt.viewSize.z };
    }

    get positionInWorld() {
        return this.posInWorld;
    }

    get zoomLevel() {
        return this.zoom_level;
    }

    get pointerInWorld() {
        return this.pointerWorldPos;
    }

    setListeners() {
        this.onkeydownListener = (e) => {
            this.state[e.key.toLowerCase()] = true;
        };
        window.addEventListener("keydown", this.onkeydownListener);

        this.onkeyupListener = (e) => {
            this.state[e.key.toLowerCase()] = false;
        };
        window.addEventListener("keyup", this.onkeyupListener);

        this.onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            this.zoom_level = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom_level + delta));
        };
        this.target.on("wheel", this.onWheel, { passive: false });

        this.onPointerMove = (e) => {
            this.pointerInGlobal.x = e.global.x;
            this.pointerInGlobal.z = e.global.y;
            this.updatePointerWorldPosition();
        };
        this.target.interactive = true;
        this.target.on("pointermove", this.onPointerMove);
    }

    updatePointerWorldPosition() {
        this.pointerWorldPos.x =
            this.posInWorld.x - TILE_PER_VIEWPORT / 2 + (this.pointerInGlobal.x / (this.target.width * this.zoom_level)) * TILE_PER_VIEWPORT;
        this.pointerWorldPos.z =
            this.posInWorld.z - TILE_PER_VIEWPORT / 2 + (this.pointerInGlobal.z / (this.target.height * this.zoom_level)) * TILE_PER_VIEWPORT;
    }

    removeListeners() {
        if (this.onkeydownListener) {
            window.removeEventListener("keydown", this.onkeydownListener);
            this.onkeydownListener = null;
        }
        if (this.onkeyupListener) {
            window.removeEventListener("keyup", this.onkeyupListener);
            this.onkeyupListener = null;
        }
        if (this.onWheel) {
            this.target.off("wheel", this.onWheel);
            this.onWheel = null;
        }
        if (this.onPointerMove) {
            this.target.off("pointermove", this.onPointerMove);
            this.onPointerMove = null;
        }
    }

    move(deltaMS: number) {
        let dx = 0;
        let dz = 0;
        if (this.state.a || this.state.arrowleft) dx -= 2;
        if (this.state.d || this.state.arrowright) dx += 2;
        if (this.state.w || this.state.arrowup) dz -= 2;
        if (this.state.s || this.state.arrowdown) dz += 2;

        if (dx !== 0 || dz !== 0) {
            // 斜め移動を正規化
            if (dx !== 0 && dz !== 0) {
                const norm = 1 / Math.sqrt(2);
                dx *= norm;
                dz *= norm;
            }

            const dt = deltaMS / 1000;
            // 移動後の位置を計算。マップの端で止まるようにする。
            // チャンクを描画する際に、チャンクサイズより1タイルだけ外側を参照する。そのため、+-1の余裕を持たせる。
            this.posInWorld.x = Math.max(
                TILE_PER_VIEWPORT / 2 + 1,
                Math.min(this.viewSize.x - 1 - TILE_PER_VIEWPORT / 2, this.posInWorld.x + dx * this.speed * dt),
            );
            this.posInWorld.z = Math.max(
                TILE_PER_VIEWPORT / 2 + 1,
                Math.min(this.viewSize.z - 1 - TILE_PER_VIEWPORT / 2, this.posInWorld.z + dz * this.speed * dt),
            );
        }
        this.updatePointerWorldPosition();
    }
}
