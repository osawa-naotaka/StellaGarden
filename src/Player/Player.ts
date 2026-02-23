import type { Pos2D } from "../lib/VoxelMap";
import { TILE_PER_VIEWPORT } from "../TopViewMap/TopViewMap";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export class Player {
    private world: Pos2D;
    private viewSize: Pos2D;
    private speed = 10; // タイル/秒
    private zoom_level = 1.0;
    private state: Record<string, boolean> = {};
    private onkeydownListener: ((e: KeyboardEvent) => void) | null = null;
    private onkeyupListener: ((e: KeyboardEvent) => void) | null = null;
    private onWheel: ((e: WheelEvent) => void) | null = null;

    constructor(opt: { start: Pos2D; viewSize: Pos2D }) {
        this.world = { x: opt.start.x, z: opt.start.z };
        this.viewSize = { x: opt.viewSize.x, z: opt.viewSize.z };
    }

    get positionInWorld() {
        return this.world;
    }

    get zoomLevel() {
        return this.zoom_level;
    }

    setKeyboardListeners() {
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
        window.addEventListener("wheel", this.onWheel, { passive: false });
    }

    removeKeyboardListeners() {
        if (this.onkeydownListener) {
            window.removeEventListener("keydown", this.onkeydownListener);
            this.onkeydownListener = null;
        }
        if (this.onkeyupListener) {
            window.removeEventListener("keyup", this.onkeyupListener);
            this.onkeyupListener = null;
        }
        if (this.onWheel) {
            window.removeEventListener("wheel", this.onWheel);
            this.onWheel = null;
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
            this.move1(dx, dz, deltaMS, this.viewSize.x, this.viewSize.z);
        }
    }

    /**
     * プレイヤーを移動させる
     *
     * @param dx
     * @param dz
     * @param deltaMS
     * @param mapWidth
     * @param mapDepth
     */
    move1(dx: number, dz: number, deltaMS: number, mapWidth: number, mapDepth: number) {
        const dt = deltaMS / 1000;
        // 移動後の位置を計算。マップの端で止まるようにする。
        // チャンクを描画する際に、チャンクサイズより1タイルだけ外側を参照する。そのため、+-1の余裕を持たせる。
        this.world.x = Math.max(TILE_PER_VIEWPORT / 2 + 1, Math.min(mapWidth - 1 - TILE_PER_VIEWPORT / 2, this.world.x + dx * this.speed * dt));
        this.world.z = Math.max(TILE_PER_VIEWPORT / 2 + 1, Math.min(mapDepth - 1 - TILE_PER_VIEWPORT / 2, this.world.z + dz * this.speed * dt));
    }
}
