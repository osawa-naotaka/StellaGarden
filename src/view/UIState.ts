import type { CraftStation, IEventBroker, IInventoryWriter, IVoxelWriter, ItemId, Pos2D, SlotRef } from "../_boundary/interfaces";
import { getPlacementInfo, type PlacementInfo } from "../_registry/ItemRegistry";
import type { PlacementOverlay } from "./PlacementOverlay";

export type UIMode = "normal" | "inventory" | "craft" | "placement";

/**
 * UI の状態を一元管理するクラス。
 * 「イベント → UIState 更新 → view は tick で UIState を読む」パターンで使う。
 */
export class UIState {
    mode: UIMode = "normal";
    craftStation: CraftStation = "hand";

    // 配置モード用
    placementItemId: ItemId | null = null;
    placementSourceSlot: SlotRef | null = null;
    private placementInfo: PlacementInfo | null = null;
    private inventory: IInventoryWriter | null = null;
    private voxelMap: IVoxelWriter | null = null;
    private placementOverlay: PlacementOverlay | null = null;

    /** 依存オブジェクトを注入し、イベント購読を登録する。dispose 関数を返す。 */
    init(deps: {
        broker: IEventBroker;
        inventory: IInventoryWriter;
        voxelMap: IVoxelWriter;
        placementOverlay: PlacementOverlay;
    }): () => void {
        this.inventory = deps.inventory;
        this.voxelMap = deps.voxelMap;
        this.placementOverlay = deps.placementOverlay;

        const d1 = deps.broker.subscribe("toggle_inventory", () => {
            if (this.mode === "placement") return;
            if (this.mode === "normal") {
                this.mode = "inventory";
            } else {
                this.mode = "normal";
            }
        });

        const d2 = deps.broker.subscribe("open_craft_ui", () => {
            if (this.mode === "placement") return;
            this.mode = "craft";
            this.craftStation = "workbench";
        });

        return () => { d1(); d2(); };
    }

    /** 配置モードに入る。InventoryView の onRequestPlacement から呼ばれる。 */
    enterPlacementMode(itemId: ItemId, sourceSlot: SlotRef): void {
        const info = getPlacementInfo(itemId);
        if (!info || !this.inventory || !this.placementOverlay) return;

        // インベントリからアイテムを取り出し
        this.inventory.setSlot(sourceSlot, null);

        this.mode = "placement";
        this.placementItemId = itemId;
        this.placementSourceSlot = sourceSlot;
        this.placementInfo = info;

        this.placementOverlay.show(
            { entitySize: info.entitySize, fieldSpriteName: info.fieldSpriteName },
            (pos: Pos2D) => this.confirmPlacement(pos),
            () => this.cancelPlacement(),
        );
    }

    /** 配置を確定する。PlacementOverlay の onConfirm コールバックから呼ばれる。 */
    private confirmPlacement(pos: Pos2D): void {
        if (!this.placementInfo || !this.voxelMap) return;
        this.placementInfo.onPlace(this.voxelMap, pos);
        this.exitPlacementMode();
    }

    /** 配置をキャンセルする。PlacementOverlay の onCancel コールバックから呼ばれる。 */
    private cancelPlacement(): void {
        if (!this.inventory || !this.placementItemId || !this.placementSourceSlot) return;
        // アイテムを元スロットに戻す
        this.inventory.setSlot(this.placementSourceSlot, { itemId: this.placementItemId, count: 1 });
        this.exitPlacementMode();
    }

    private exitPlacementMode(): void {
        this.placementOverlay?.hide();
        this.mode = "normal";
        this.placementItemId = null;
        this.placementSourceSlot = null;
        this.placementInfo = null;
    }
}
