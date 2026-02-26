import type { Container, FederatedPointerEvent } from "pixi.js";
import { CHUNK_RENDER_MARGIN } from "../lib/ChunkRenderer";
import type { Pos2D } from "../lib/VoxelMap";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export class Player {
    private readonly target: Container;
    private playerPosInWorld: Pos2D;
    private pointerPosInWorld: Pos2D = { x: 0, z: 0 };
    private pointerPosInGlobal: Pos2D = { x: 0, z: 0 };

    private toolbarSlot = ["watering_can", "pickaxe", "axe", "sickle", "shovel", "potato_icon", null, null, null];
    private selectedSlot = 0;

    private worldSize: Pos2D;
    private speed = 10; // タイル/秒
    private zoom_level = 1.0;
    private keyPressState: Record<string, boolean> = {};
    private tilePerViewport: Pos2D;

    private onkeydownListener: ((e: KeyboardEvent) => void) | null = null;
    private onkeyupListener: ((e: KeyboardEvent) => void) | null = null;
    private onWheel: ((e: WheelEvent) => void) | null = null;
    private onPointerMove: ((e: FederatedPointerEvent) => void) | null = null;

    constructor(target: Container, opt: { start: Pos2D; worldSize: Pos2D; tilePerViewport: Pos2D }) {
        this.target = target;
        this.playerPosInWorld = { x: opt.start.x, z: opt.start.z };
        this.worldSize = { x: opt.worldSize.x, z: opt.worldSize.z };
        this.tilePerViewport = { x: opt.tilePerViewport.x, z: opt.tilePerViewport.z };
    }

    get playerPositionInWorld() {
        return this.playerPosInWorld;
    }

    get zoomLevel() {
        return this.zoom_level;
    }

    get pointerPositionInWorld() {
        return this.pointerPosInWorld;
    }

    get toolbar() {
        return this.toolbarSlot;
    }

    get slotSelected() {
        return this.selectedSlot;
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
            this.pointerPosInGlobal.x = e.global.x;
            this.pointerPosInGlobal.z = e.global.y;
            this.updatePointerPositionInWorld();
        };
        this.target.interactive = true;
        this.target.on("pointermove", this.onPointerMove);
    }

    updatePointerPositionInWorld() {
        this.pointerPosInWorld.x =
            this.playerPosInWorld.x - this.tilePerViewport.x / 2 + (this.pointerPosInGlobal.x / (this.target.width * this.zoom_level)) * this.tilePerViewport.x;
        this.pointerPosInWorld.z =
            this.playerPosInWorld.z -
            this.tilePerViewport.z / 2 +
            (this.pointerPosInGlobal.z / (this.target.height * this.zoom_level)) * this.tilePerViewport.z;
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

    selectToolbarSlot(index: number) {
        if (index >= 0 && index < this.toolbarSlot.length) {
            this.selectedSlot = index;
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
            // チャンクを描画する際に、チャンクサイズよりCHUNK_RENDER_MARGINタイルだけ外側を参照する。そのため、+-CHUNK_RENDER_MARGINの余裕を持たせる。
            this.playerPosInWorld.x = Math.max(
                this.tilePerViewport.x / 2 + CHUNK_RENDER_MARGIN + 1,
                Math.min(this.worldSize.x - 1 - this.tilePerViewport.x / 2 - CHUNK_RENDER_MARGIN - 1, this.playerPosInWorld.x + dx * this.speed * dt),
            );
            this.playerPosInWorld.z = Math.max(
                this.tilePerViewport.z / 2 + CHUNK_RENDER_MARGIN + 1,
                Math.min(this.worldSize.z - 1 - this.tilePerViewport.z / 2 - CHUNK_RENDER_MARGIN - 1, this.playerPosInWorld.z + dz * this.speed * dt),
            );
        }
        this.updatePointerPositionInWorld();
    }
}
