import type { CraftStation, IEventBroker, ItemId, Pos2D, SlotRef } from "../_boundary/interfaces";
import type { PlacementVariant } from "../_registry/ItemRegistry";

export type UIMode = "normal" | "inventory-craft" | "placement" | "chest" | "forge" | "warp_gate" | "processing-manual" | "processing-daily" | "processing-auto";
export type TimeSpeed = "paused" | "normal" | "fast";

/**
 * UI の状態を一元管理する純粋データクラス。
 * 外部オブジェクト（inventory, voxelMap 等）への参照を持たず、副作用を実行しない。
 * 「イベント → UIState 更新 → view は tick で UIState を読む」パターンで使う。
 */
export class UIState {
    mode: UIMode = "normal";
    craftStation: CraftStation = "hand";
    craftWorkbenchPos: Pos2D | null = null;
    placementItemId: ItemId | null = null;
    placementSourceSlot: SlotRef | null = null;
    placementVariant: PlacementVariant = 0;
    chestPos: Pos2D | null = null;
    forgePos: Pos2D | null = null;
    warpGatePos: Pos2D | null = null;
    processingPos: Pos2D | null = null;
    timeSpeed: TimeSpeed = "normal";

    /** 後方互換ゲッター。isPaused === (timeSpeed === "paused") */
    get isPaused(): boolean {
        return this.timeSpeed === "paused";
    }

    /** 時間速度を設定する（フィールド変更のみ、副作用なし）。 */
    setTimeSpeed(speed: TimeSpeed): void {
        this.timeSpeed = speed;
    }

    /** EventBroker を購読して mode を更新する。dispose 関数を返す。 */
    subscribeEvents(broker: IEventBroker): () => void {
        const d1 = broker.subscribe("toggle_inventory", () => {
            if (this.mode === "placement") return;
            if (this.mode === "normal") {
                this.mode = "inventory-craft";
                this.craftStation = "hand";
                this.craftWorkbenchPos = null;
            } else {
                this.mode = "normal";
                this.craftStation = "hand";
                this.craftWorkbenchPos = null;
                this.chestPos = null;
                this.forgePos = null;
                this.warpGatePos = null;
                this.processingPos = null;
            }
        });

        const d2 = broker.subscribe("open_craft_ui", ({ workbenchPos }) => {
            if (this.mode === "placement") return;
            this.mode = "inventory-craft";
            this.craftStation = "workbench";
            this.craftWorkbenchPos = workbenchPos;
        });

        const d3 = broker.subscribe("open_chest_ui", ({ pos }) => {
            if (this.mode === "placement") return;
            this.mode = "chest";
            this.chestPos = pos;
        });

        const d4 = broker.subscribe("open_forge_ui", ({ pos }) => {
            if (this.mode === "placement") return;
            this.mode = "forge";
            this.forgePos = pos;
        });

        const d5 = broker.subscribe("open_warp_gate_ui", ({ pos }) => {
            if (this.mode === "placement") return;
            this.mode = "warp_gate";
            this.warpGatePos = pos;
        });

        const d6 = broker.subscribe("open_processing_manual_ui", ({ pos }) => {
            if (this.mode === "placement") return;
            this.mode = "processing-manual";
            this.processingPos = pos;
        });

        const d7 = broker.subscribe("open_processing_daily_ui", ({ pos }) => {
            if (this.mode === "placement") return;
            this.mode = "processing-daily";
            this.processingPos = pos;
        });

        const d8 = broker.subscribe("open_processing_auto_ui", ({ pos }) => {
            if (this.mode === "placement") return;
            this.mode = "processing-auto";
            this.processingPos = pos;
        });

        return () => {
            d1();
            d2();
            d3();
            d4();
            d5();
            d6();
            d7();
            d8();
        };
    }

    /** 配置モードに入る（フィールド変更のみ、副作用なし）。 */
    enterPlacementMode(itemId: ItemId, sourceSlot: SlotRef, variant: PlacementVariant = 0): void {
        this.mode = "placement";
        this.placementItemId = itemId;
        this.placementSourceSlot = sourceSlot;
        this.placementVariant = variant;
    }

    /** 配置中のバリアントを切り替える（フィールド変更のみ、副作用なし）。 */
    togglePlacementVariant(maxVariant: number): void {
        if (maxVariant <= 0) {
            this.placementVariant = 0;
            return;
        }
        this.placementVariant = (this.placementVariant + 1) % (maxVariant + 1);
    }

    /** 配置モードを終了する（フィールド変更のみ、副作用なし）。 */
    exitPlacementMode(): void {
        this.mode = "normal";
        this.placementItemId = null;
        this.placementSourceSlot = null;
        this.placementVariant = 0;
    }
}
