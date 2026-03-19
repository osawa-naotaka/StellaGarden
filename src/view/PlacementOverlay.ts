import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { IVoxelReader, Pos2D } from "../_boundary/interfaces";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../engine/TerrainDefs";

/** 配置可能な地形タイプの集合。 */
const PLACEABLE_TERRAINS: ReadonlySet<number> = new Set([TERRAIN_TYPES.grass, TERRAIN_TYPES.dirt, TERRAIN_TYPES.soil]);

/**
 * 配置モード中にマウスカーソルに追従する半透明プレビューを描画するビュークラス。
 * worldContainer に追加して使う。tick() で毎フレーム位置・有効性を更新する。
 */
export class PlacementOverlay {
    private container: Container;
    private previewSprite: Sprite;
    private tintOverlay: Graphics;
    private voxelMap: IVoxelReader;
    private valid = false;
    private snappedPos: Pos2D = { x: 0, z: 0 };
    private entitySize: { w: number; h: number } = { w: 1, h: 1 };

    private onConfirmCallback: ((pos: Pos2D) => void) | null = null;
    private onCancelCallback: (() => void) | null = null;

    private onPointerDownBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(voxelMap: IVoxelReader) {
        this.voxelMap = voxelMap;
        this.container = new Container();
        this.container.visible = false;

        // 初期テクスチャは空。show() で設定される。
        this.previewSprite = new Sprite(Texture.EMPTY);
        this.previewSprite.width = PIXEL_PER_TILE;
        this.previewSprite.height = PIXEL_PER_TILE;
        this.previewSprite.alpha = 0.5;
        this.container.addChild(this.previewSprite);

        // 配置可否を示す色オーバーレイ
        this.tintOverlay = new Graphics();
        this.container.addChild(this.tintOverlay);

        this.onPointerDownBound = this.onPointerDown.bind(this);
        this.onKeyDownBound = this.onKeyDown.bind(this);
    }

    get top(): Container {
        return this.container;
    }

    /** 配置モードを開始する。確定・キャンセル時のコールバックを登録し、オーバーレイを表示する。 */
    show(config: { entitySize: { w: number; h: number }; fieldSpriteName: string }, onConfirm: (pos: Pos2D) => void, onCancel: () => void): void {
        this.entitySize = config.entitySize;
        this.previewSprite.texture = Texture.from(config.fieldSpriteName);
        this.previewSprite.width = PIXEL_PER_TILE * config.entitySize.w;
        this.previewSprite.height = PIXEL_PER_TILE * config.entitySize.h;

        this.onConfirmCallback = onConfirm;
        this.onCancelCallback = onCancel;
        this.container.visible = true;
        window.addEventListener("pointerdown", this.onPointerDownBound);
        window.addEventListener("keydown", this.onKeyDownBound);
    }

    /** 配置モードを終了する。リスナーを解除し、オーバーレイを非表示にする。 */
    hide(): void {
        this.container.visible = false;
        window.removeEventListener("pointerdown", this.onPointerDownBound);
        window.removeEventListener("keydown", this.onKeyDownBound);
        this.onConfirmCallback = null;
        this.onCancelCallback = null;
    }

    /**
     * 毎フレーム呼ぶ。オーバーレイの位置・配置可否色を更新する。
     * @param pointerPosInWorld マウスカーソルのワールドタイル座標
     * @param viewportOrigin TopView が使うビューポート原点（ワールドタイル座標）
     */
    tick(pointerPosInWorld: Pos2D, viewportOrigin: Pos2D): void {
        if (!this.container.visible) return;

        const snappedX = Math.floor(pointerPosInWorld.x);
        const snappedZ = Math.floor(pointerPosInWorld.z);
        this.snappedPos = { x: snappedX, z: snappedZ };

        // worldContainer 内のピクセル座標に変換
        this.container.x = (snappedX - viewportOrigin.x) * PIXEL_PER_TILE;
        this.container.y = (snappedZ - viewportOrigin.z) * PIXEL_PER_TILE;

        this.valid = this.canPlace(snappedX, snappedZ);

        // 配置可否に応じてオーバーレイ色を更新
        this.tintOverlay.clear();
        this.tintOverlay.rect(0, 0, PIXEL_PER_TILE * this.entitySize.w, PIXEL_PER_TILE * this.entitySize.h);
        if (this.valid) {
            this.tintOverlay.fill({ color: 0x00ff00, alpha: 0.3 });
        } else {
            this.tintOverlay.fill({ color: 0xff0000, alpha: 0.3 });
        }
    }

    /** entitySize に基づく矩形範囲の配置判定。 */
    private canPlace(x: number, z: number): boolean {
        const map = this.voxelMap;
        const { w, h } = this.entitySize;

        // マップ範囲チェック
        if (x < 0 || x + w > map.width || z < 0 || z + h > map.depth) {
            return false;
        }

        // 基準タイルの表面高さ
        const baseY = map.getSurfacePosition({ x, y: 0, z }).y;

        // 全タイルをチェック
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
        if (this.valid && this.onConfirmCallback) {
            this.onConfirmCallback(this.snappedPos);
        }
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape" && this.onCancelCallback) {
            this.onCancelCallback();
        }
    }
}
