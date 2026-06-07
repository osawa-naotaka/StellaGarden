import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { IEventBroker, IInventoryWriter, IPlayerStateReader, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getEntityDef } from "../_registry/EntityRegistry";
import { getPlacementInfo, type PlacementInfo, type PlacementVariant } from "../_registry/ItemRegistry";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../engine/VoxelDefs";
import type { UIState } from "./UIState";

/** 配置可能な地形タイプの集合。 */
const PLACEABLE_TERRAINS: ReadonlySet<number> = new Set([TERRAIN_TYPES.grass, TERRAIN_TYPES.dirt, TERRAIN_TYPES.soil, TERRAIN_TYPES.wetSoil]);

/**
 * 配置モード中にマウスカーソルに追従する半透明プレビューを描画するビュークラス。
 * UIState.mode === "placement" のとき自動的に表示し、確定・キャンセルの副作用も自分で実行する。
 */
export class PlacementOverlay {
    private container: Container;
    private previewSprite: Sprite;
    private tintOverlay: Graphics;
    private voxelMap: IVoxelWriter;
    private inventory: IInventoryWriter;
    private uiState: UIState;
    private eventBroker: IEventBroker;
    private playerState: IPlayerStateReader;
    private valid = false;
    private snappedPos: Pos2D = { x: 0, z: 0 };
    private entitySizeFn: (variant: PlacementVariant) => { w: number; h: number } = () => ({ w: 1, h: 1 });
    private active = false;
    private placementInfo: PlacementInfo | null = null;

    private onPointerDownBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(voxelMap: IVoxelWriter, inventory: IInventoryWriter, uiState: UIState, eventBroker: IEventBroker, playerState: IPlayerStateReader) {
        this.voxelMap = voxelMap;
        this.inventory = inventory;
        this.uiState = uiState;
        this.eventBroker = eventBroker;
        this.playerState = playerState;
        this.container = new Container();
        this.container.visible = false;

        this.previewSprite = new Sprite(Texture.EMPTY);
        this.previewSprite.width = PIXEL_PER_TILE;
        this.previewSprite.height = PIXEL_PER_TILE;
        this.previewSprite.alpha = 0.5;
        this.container.addChild(this.previewSprite);

        this.tintOverlay = new Graphics();
        this.container.addChild(this.tintOverlay);

        this.onPointerDownBound = this.onPointerDown.bind(this);
        this.onKeyDownBound = this.onKeyDown.bind(this);
    }

    get top(): Container {
        return this.container;
    }

    tick(pointerPosInWorld: Pos2D, viewportOrigin: Pos2D): void {
        const shouldBeActive = this.uiState.mode === "placement";

        // mode 遷移を検知して show/hide
        if (shouldBeActive && !this.active) {
            this.startPlacement();
        } else if (!shouldBeActive && this.active) {
            this.stopPlacement();
        }

        if (!this.container.visible) return;

        const snappedX = Math.floor(pointerPosInWorld.x);
        const snappedZ = Math.floor(pointerPosInWorld.z);
        this.snappedPos = { x: snappedX, z: snappedZ };

        this.container.x = (snappedX - viewportOrigin.x) * PIXEL_PER_TILE;
        this.container.y = (snappedZ - viewportOrigin.z) * PIXEL_PER_TILE;

        this.valid = this.canPlace(snappedX, snappedZ);

        this.tintOverlay.clear();
        const { w, h } = this.entitySizeFn(this.uiState.placementVariant);
        this.tintOverlay.rect(0, 0, PIXEL_PER_TILE * w, PIXEL_PER_TILE * h);
        if (this.valid) {
            this.tintOverlay.fill({ color: 0x00ff00, alpha: 0.3 });
        } else {
            this.tintOverlay.fill({ color: 0xff0000, alpha: 0.3 });
        }
    }

    private startPlacement(): void {
        const itemId = this.uiState.placementItemId;
        if (!itemId) return;
        const info = getPlacementInfo(itemId);
        if (!info) return;

        this.placementInfo = info;
        this.entitySizeFn = getEntityDef(info.entityType).getEntitySize;
        this.updatePreviewSprite();
        this.previewSprite.width = PIXEL_PER_TILE * this.entitySizeFn(this.uiState.placementVariant).w;
        this.previewSprite.height = PIXEL_PER_TILE * this.entitySizeFn(this.uiState.placementVariant).h;

        this.active = true;
        this.container.visible = true;
        window.addEventListener("pointerdown", this.onPointerDownBound);
        window.addEventListener("keydown", this.onKeyDownBound);
    }

    private stopPlacement(): void {
        this.active = false;
        this.container.visible = false;
        this.placementInfo = null;
        window.removeEventListener("pointerdown", this.onPointerDownBound);
        window.removeEventListener("keydown", this.onKeyDownBound);
    }

    private canPlace(x: number, z: number): boolean {
        const map = this.voxelMap;
        const { w, h } = this.entitySizeFn(this.uiState.placementVariant);

        if (x < 0 || x + w > map.width || z < 0 || z + h > map.depth) {
            return false;
        }

        // 配置範囲内にプレイヤーが立っている場合は不可。
        // 種類によらない普遍的な制約なので、PlacementInfo.canPlace のバイパスより前で判定する。
        const playerTileX = Math.floor(this.playerState.posInWorld.x);
        const playerTileZ = Math.floor(this.playerState.posInWorld.z);
        if (playerTileX >= x && playerTileX < x + w && playerTileZ >= z && playerTileZ < z + h) {
            return false;
        }

        // PlacementInfo.canPlace が定義されていれば既定ロジックを完全にバイパスする
        if (this.placementInfo?.canPlace) {
            return this.placementInfo.canPlace(map, { x, z }, this.uiState.placementVariant);
        }

        const baseY = map.getSurfacePosition({ x, z }).y;

        for (let dz = 0; dz < h; dz++) {
            for (let dx = 0; dx < w; dx++) {
                const tilePos = { x: x + dx, y: 0, z: z + dz };
                const surfacePos = map.getSurfacePosition(tilePos);
                if (surfacePos.y !== baseY) return false;

                const voxel = map.getSurface(tilePos);
                const terrain = getTerrainTypeFromVoxel(voxel);
                const entity = getEntityTypeFromVoxel(voxel);

                if (!PLACEABLE_TERRAINS.has(terrain)) return false;
                if (entity !== ENTITY_TYPES.none) return false;
            }
        }

        return true;
    }

    private onPointerDown(e: MouseEvent): void {
        if (e.button !== 0) return;
        if (this.valid && this.placementInfo && this.uiState.placementSourceSlot !== null) {
            const stack = this.inventory.getSlot(this.uiState.placementSourceSlot);
            if (!stack) return;

            // exitPlacementMode は placementVariant を 0 にリセットするため、
            // 最後の 1 個を配置するときに variant が失われる。先に保持しておく。
            const variant = this.uiState.placementVariant;
            // entity_placed イベント用に itemId を保持（exitPlacementMode 後でも参照できるように）
            const placedItemId = stack.itemId;
            const placedPos: Pos2D = { x: this.snappedPos.x, z: this.snappedPos.z };

            if (stack.count === 1) {
                this.inventory.setSlot(this.uiState.placementSourceSlot, null);
                this.uiState.exitPlacementMode();
            } else {
                stack.count--;
            }

            // 副作用: voxelMap に配置
            this.placementInfo.onPlace(this.voxelMap, this.snappedPos, variant);

            // ミッションシステムなどに通知。entityType は itemId（例: "warp_gate"）。
            this.eventBroker.publish("entity_placed", { pos: placedPos, entityType: placedItemId });
        }
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            // 純粋: UIState を更新
            this.uiState.exitPlacementMode();
            return;
        }

        if (e.key.toLowerCase() === "v" && this.placementInfo) {
            this.uiState.togglePlacementVariant(this.placementInfo.maxVariant ?? 0);
            this.updatePreviewSprite();
        }
    }

    private updatePreviewSprite(): void {
        if (!this.placementInfo) return;
        const spriteName = this.placementInfo.getFieldSpriteName?.(this.uiState.placementVariant) ?? this.placementInfo.fieldSpriteName;
        if (!spriteName) return;
        this.previewSprite.texture = Texture.from(spriteName);
        const { w, h } = this.entitySizeFn(this.uiState.placementVariant);
        this.previewSprite.width = PIXEL_PER_TILE * w;
        this.previewSprite.height = PIXEL_PER_TILE * h;
    }
}
