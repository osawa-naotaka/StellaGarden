import type { CraftStation, IEventBroker, ItemId, SlotRef } from "../_boundary/interfaces";

export type UIMode = "normal" | "inventory" | "craft" | "placement";

/**
 * UI の状態を一元管理する純粋データクラス。
 * 外部オブジェクト（inventory, voxelMap 等）への参照を持たず、副作用を実行しない。
 * 「イベント → UIState 更新 → view は tick で UIState を読む」パターンで使う。
 */
export class UIState {
    mode: UIMode = "normal";
    craftStation: CraftStation = "hand";
    placementItemId: ItemId | null = null;
    placementSourceSlot: SlotRef | null = null;

    /** EventBroker を購読して mode を更新する。dispose 関数を返す。 */
    subscribeEvents(broker: IEventBroker): () => void {
        const d1 = broker.subscribe("toggle_inventory", () => {
            if (this.mode === "placement") return;
            this.mode = this.mode === "normal" ? "inventory" : "normal";
        });

        const d2 = broker.subscribe("open_craft_ui", () => {
            if (this.mode === "placement") return;
            this.mode = "craft";
            this.craftStation = "workbench";
        });

        return () => { d1(); d2(); };
    }

    /** 配置モードに入る（フィールド変更のみ、副作用なし）。 */
    enterPlacementMode(itemId: ItemId, sourceSlot: SlotRef): void {
        this.mode = "placement";
        this.placementItemId = itemId;
        this.placementSourceSlot = sourceSlot;
    }

    /** 配置モードを終了する（フィールド変更のみ、副作用なし）。 */
    exitPlacementMode(): void {
        this.mode = "normal";
        this.placementItemId = null;
        this.placementSourceSlot = null;
    }
}
