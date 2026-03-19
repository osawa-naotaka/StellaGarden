import type { Container, FederatedPointerEvent } from "pixi.js";
import type { GameEventMap } from "../_boundary/events";
import type { IPlayerStateWriter } from "../_boundary/interfaces";
import type { EventBroker } from "../lib/Event";

const ZOOM_STEP = 0.1;

/** キーボード・マウスイベントを受け取り、PlayerState を更新する。
 *  インタラクションは EventBroker 経由で通知する。 */
export class InputHandler {
    private readonly target: Container;
    private readonly playerState: IPlayerStateWriter;
    private readonly eventBroker: EventBroker<GameEventMap>;

    private keyPressState: Record<string, boolean> = {};
    private pointerPosInGlobal = { x: 0, z: 0 };

    constructor(target: Container, playerState: IPlayerStateWriter, eventBroker: EventBroker<GameEventMap>) {
        this.target = target;
        this.playerState = playerState;
        this.eventBroker = eventBroker;
    }

    /** イベントリスナーを登録し、解除用の dispose 関数を返す。 */
    setListeners(): () => void {
        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            this.keyPressState[key] = true;
            if (key === "e") {
                this.eventBroker.publish("toggle_inventory", {});
            }
        };
        window.addEventListener("keydown", onKeyDown);

        const onKeyUp = (e: KeyboardEvent) => {
            this.keyPressState[e.key.toLowerCase()] = false;
        };
        window.addEventListener("keyup", onKeyUp);

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            this.eventBroker.publish("zoom_change", { delta });
        };
        this.target.on("wheel", onWheel, { passive: false });

        this.target.interactive = true;
        const onPointerMove = (e: FederatedPointerEvent) => {
            this.pointerPosInGlobal.x = e.global.x;
            this.pointerPosInGlobal.z = e.global.y;
            this.updatePointerPosInWorld();
        };
        this.target.on("pointermove", onPointerMove);

        const onPointerDown = (e: FederatedPointerEvent) => {
            if (e.button === 2) {
                // 右クリック
                this.pointerPosInGlobal.x = e.global.x;
                this.pointerPosInGlobal.z = e.global.y;
                this.updatePointerPosInWorld();

                const x = Math.floor(this.playerState.pointerPosInWorld.x);
                const z = Math.floor(this.playerState.pointerPosInWorld.z);
                this.eventBroker.publish("interact_world", { pos: { x, z } });
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

    /** ゲームループから毎フレーム呼ぶ。キー状態に基づいてプレイヤーを移動させる。 */
    tick(deltaMS: number): void {
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
            this.eventBroker.publish("player_move", { dx, dz, deltaMS });
        }
        this.updatePointerPosInWorld();
    }

    private updatePointerPosInWorld(): void {
        const { posInWorld, tilePerViewport, zoomLevel } = this.playerState;
        const x = posInWorld.x - tilePerViewport.w / 2 + (this.pointerPosInGlobal.x / (this.target.width * zoomLevel)) * tilePerViewport.w;
        const z = posInWorld.z - tilePerViewport.h / 2 + (this.pointerPosInGlobal.z / (this.target.height * zoomLevel)) * tilePerViewport.h;
        this.playerState.setPointerPosInWorld(x, z);
    }
}
