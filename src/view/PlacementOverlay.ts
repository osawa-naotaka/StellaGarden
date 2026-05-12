import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { IInventoryWriter, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getEntityDef } from "../_registry/EntityRegistry";
import { getPlacementInfo, type PlacementInfo } from "../_registry/ItemRegistry";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../engine/VoxelDefs";
import type { UIState } from "./UIState";

/** 配置可能な地形タイプの集合。 */
const PLACEABLE_TERRAINS: ReadonlySet<number> = new Set([TERRAIN_TYPES.grass, TERRAIN_TYPES.dirt, TERRAIN_TYPES.soil]);

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
    private valid = false;
    private snappedPos: Pos2D = { x: 0, z: 0 };
    private entitySize: { w: number; h: number } = { w: 1, h: 1 };
    private active = false;
    private placementInfo: PlacementInfo | null = null;

    private onPointerDownBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(voxelMap: IVoxelWriter, inventory: IInventoryWriter, uiState: UIState) {
        this.voxelMap = voxelMap;
        this.inventory = inventory;
        this.uiState = uiState;
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
        this.tintOverlay.rect(0, 0, PIXEL_PER_TILE * this.entitySize.w, PIXEL_PER_TILE * this.entitySize.h);
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
        this.entitySize = getEntityDef(info.entityType)?.entitySize ?? { w: 1, h: 1 };
        this.updatePreviewSprite();
        this.previewSprite.width = PIXEL_PER_TILE * this.entitySize.w;
        this.previewSprite.height = PIXEL_PER_TILE * this.entitySize.h;

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
        const { w, h } = this.entitySize;

        if (x < 0 || x + w > map.width || z < 0 || z + h > map.depth) {
            return false;
        }

        // PlacementInfo.canPlace が定義されていれば既定ロジックを完全にバイパスする
        if (this.placementInfo?.canPlace) {
            return this.placementInfo.canPlace(map, { x, z }, this.uiState.placementVariant);
        }

        const baseY = map.getSurfacePosition({ x, y: 0, z }).y;

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

            if (stack.count === 1) {
                this.inventory.setSlot(this.uiState.placementSourceSlot, null);
                this.uiState.exitPlacementMode();
            } else {
                stack.count--;
            }

            // 副作用: voxelMap に配置
            this.placementInfo.onPlace(this.voxelMap, this.snappedPos, this.uiState.placementVariant);
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
    }
}
