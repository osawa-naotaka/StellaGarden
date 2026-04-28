import type { Container, FederatedPointerEvent } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { GameEventMap } from "../_boundary/events";
import type { IPlayerStateWriter } from "../_boundary/interfaces";
import type { EventBroker } from "../lib/Event";

const ZOOM_STEP = 0.1;
const HOLD_DELAY = 300; // 最初のインタラクトまでの遅延(ms)
const HOLD_INTERVAL = 300; // 連続インタラクトの間隔(ms)

/** ホールド操作が必要なツールのID集合 */
const HOLD_TOOL_IDS: ReadonlySet<string> = new Set(["axe", "hoes", "pickaxe", "sickle", "shovel", "watering_can"]);

/** キーボード・マウスイベントを受け取り、PlayerState を更新する。
 *  インタラクションは EventBroker 経由で通知する。 */
export class InputHandler {
    private readonly target: Container;
    private readonly playerState: IPlayerStateWriter;
    private readonly eventBroker: EventBroker<GameEventMap>;

    private keyPressState: Record<string, boolean> = {};
    private pointerPosInGlobal = { x: 0, z: 0 };

    private leftHeld_ = false;
    private holdAccumulator_ = 0;
    private holdFired_ = false;

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
            this.pointerPosInGlobal.x = e.global.x;
            this.pointerPosInGlobal.z = e.global.y;
            this.updatePointerPosInWorld();

            const x = Math.floor(this.playerState.pointerPosInWorld.x);
            const z = Math.floor(this.playerState.pointerPosInWorld.z);

            if (e.button === 0) {
                // 左クリック: ツール使用
                const selectedTool = this.playerState.inventory.selectedTool;
                if (selectedTool && HOLD_TOOL_IDS.has(selectedTool)) {
                    // ホールドツール: tick で遅延発動
                    this.leftHeld_ = true;
                    this.holdAccumulator_ = 0;
                    this.holdFired_ = false;
                } else {
                    // 非ホールドツール: 即時発動（従来通り）
                    this.eventBroker.publish("interact_world", { pos: { x, z } });
                }
            } else if (e.button === 2) {
                // 右クリック: 施設UIの起動等
                this.eventBroker.publish("interact_primary", { pos: { x, z } });
            }
        };
        this.target.on("pointerdown", onPointerDown);

        const onPointerUp = (e: PointerEvent) => {
            if (e.button === 0) {
                this.leftHeld_ = false;
            }
        };
        window.addEventListener("pointerup", onPointerUp);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("pointerup", onPointerUp);
            this.target.off("wheel", onWheel);
            this.target.off("pointermove", onPointerMove);
            this.target.off("pointerdown", onPointerDown);
        };
    }

    /** 移動キーが押されているかどうか。 */
    get isMoving(): boolean {
        return (
            this.keyPressState.a ||
            this.keyPressState.arrowleft ||
            this.keyPressState.d ||
            this.keyPressState.arrowright ||
            this.keyPressState.w ||
            this.keyPressState.arrowup ||
            this.keyPressState.s ||
            this.keyPressState.arrowdown
        );
    }

    /** ツールホールド中かどうか。 */
    get isHolding(): boolean {
        return this.leftHeld_;
    }

    /** ゲームループから毎フレーム呼ぶ。キー状態に基づいてプレイヤーを移動させる。 */
    tick(deltaMS: number): void {
        let dx = 0;
        let dz = 0;
        if (this.keyPressState.a || this.keyPressState.arrowleft) dx -= 2;
        if (this.keyPressState.d || this.keyPressState.arrowright) dx += 2;
        if (this.keyPressState.w || this.keyPressState.arrowup) dz -= 2;
        if (this.keyPressState.s || this.keyPressState.arrowdown) dz += 2;

        if ((dx !== 0 || dz !== 0)) {
            // 斜め移動を正規化
            const norm = 1 / Math.sqrt(2);
            dx *= norm;
            dz *= norm;
            this.eventBroker.publish("player_move", { dx, dz, deltaMS });
        }
        this.updatePointerPosInWorld();

        // ホールド中のツール連続発動
        if (this.leftHeld_) {
            this.holdAccumulator_ += deltaMS;
            if (!this.holdFired_ && this.holdAccumulator_ >= HOLD_DELAY) {
                this.fireInteractWorld();
                this.holdFired_ = true;
                this.holdAccumulator_ = 0;
            } else if (this.holdFired_ && this.holdAccumulator_ >= HOLD_INTERVAL) {
                this.fireInteractWorld();
                this.holdAccumulator_ -= HOLD_INTERVAL;
            }
        }
    }

    private fireInteractWorld(): void {
        const x = Math.floor(this.playerState.pointerPosInWorld.x);
        const z = Math.floor(this.playerState.pointerPosInWorld.z);
        this.eventBroker.publish("interact_world", { pos: { x, z } });
    }

    private updatePointerPosInWorld(): void {
        const { posInWorld, zoomLevel } = this.playerState;
        // worldContainer がプレイヤーを画面中央に配置するオフセットを持つため、
        // スクリーン座標→ワールド座標の変換は画面中央からの相対位置で計算する
        const x = posInWorld.x + (this.pointerPosInGlobal.x - window.innerWidth / 2) / (zoomLevel * PIXEL_PER_TILE);
        const z = posInWorld.z + (this.pointerPosInGlobal.z - window.innerHeight / 2) / (zoomLevel * PIXEL_PER_TILE);
        this.playerState.setPointerPosInWorld(x, z);
    }
}
