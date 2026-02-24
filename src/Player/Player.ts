import type { Container, FederatedPointerEvent } from "pixi.js";
import type { Pos2D } from "../lib/VoxelMap";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export class Player {
    private readonly target: Container;
    private posInWorld: Pos2D;
    private worldSize: Pos2D;
    private pointerInGlobal: Pos2D = { x: 0, z: 0 };
    private speed = 10; // タイル/秒
    private zoom_level = 1.0;
    private keyPressState: Record<string, boolean> = {};
    private onkeydownListener: ((e: KeyboardEvent) => void) | null = null;
    private onkeyupListener: ((e: KeyboardEvent) => void) | null = null;
    private onWheel: ((e: WheelEvent) => void) | null = null;
    private onPointerMove: ((e: FederatedPointerEvent) => void) | null = null;
    private pointerWorldPos: Pos2D = { x: 0, z: 0 };
    private tilePerViewport: Pos2D;

    constructor(target: Container, opt: { start: Pos2D; worldSize: Pos2D; tilePerViewport: Pos2D }) {
        this.target = target;
        this.posInWorld = { x: opt.start.x, z: opt.start.z };
        this.worldSize = { x: opt.worldSize.x, z: opt.worldSize.z };
        this.tilePerViewport = { x: opt.tilePerViewport.x, z: opt.tilePerViewport.z };
    }

    get playerPositionInWorld() {
        return this.posInWorld;
    }

    get zoomLevel() {
        return this.zoom_level;
    }

    get pointerPositionInWorld() {
        return this.pointerWorldPos;
    }

    setListeners() {
        this.onkeydownListener = (e) => {
            this.keyPressState[e.key.toLowerCase()] = true;
        };
        window.addEventListener("keydown", this.onkeydownListener);

        this.onkeyupListener = (e) => {
            this.keyPressState[e.key.toLowerCase()] = false;
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
            this.updatePointerPositionInWorld();
        };
        this.target.interactive = true;
        this.target.on("pointermove", this.onPointerMove);
    }

    updatePointerPositionInWorld() {
        this.pointerWorldPos.x =
            this.posInWorld.x - this.tilePerViewport.x / 2 + (this.pointerInGlobal.x / (this.target.width * this.zoom_level)) * this.tilePerViewport.x;
        this.pointerWorldPos.z =
            this.posInWorld.z - this.tilePerViewport.z / 2 + (this.pointerInGlobal.z / (this.target.height * this.zoom_level)) * this.tilePerViewport.z;
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
            // 移動後の位置を計算。マップの端で止まるようにする。
            // チャンクを描画する際に、チャンクサイズより1タイルだけ外側を参照する。そのため、+-1の余裕を持たせる。
            this.posInWorld.x = Math.max(
                this.tilePerViewport.x / 2 + 1,
                Math.min(this.worldSize.x - 1 - this.tilePerViewport.x / 2, this.posInWorld.x + dx * this.speed * dt),
            );
            this.posInWorld.z = Math.max(
                this.tilePerViewport.z / 2 + 1,
                Math.min(this.worldSize.z - 1 - this.tilePerViewport.z / 2, this.posInWorld.z + dz * this.speed * dt),
            );
        }
        this.updatePointerPositionInWorld();
    }
}
