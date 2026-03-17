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

    private onConfirmCallback: ((pos: Pos2D) => void) | null = null;
    private onCancelCallback: (() => void) | null = null;

    private onPointerDownBound: (e: MouseEvent) => void;
    private onKeyDownBound: (e: KeyboardEvent) => void;

    constructor(voxelMap: IVoxelReader) {
        this.voxelMap = voxelMap;
        this.container = new Container();
        this.container.visible = false;

        // 32x16 の半透明プレビュースプライト
        this.previewSprite = new Sprite(Texture.from("ss_sprite_004.png"));
        this.previewSprite.width = PIXEL_PER_TILE * 2; // 2タイル分 = 32px
        this.previewSprite.height = PIXEL_PER_TILE;    // 1タイル分 = 16px
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
    show(onConfirm: (pos: Pos2D) => void, onCancel: () => void): void {
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
        this.tintOverlay.rect(0, 0, PIXEL_PER_TILE * 2, PIXEL_PER_TILE);
        if (this.valid) {
            this.tintOverlay.fill({ color: 0x00ff00, alpha: 0.3 });
        } else {
            this.tintOverlay.fill({ color: 0xff0000, alpha: 0.3 });
        }
    }

    /**
     * 2x1 の配置判定（作業台固定）。
     * 将来的に entitySize を受け取る拡張の余地を残す。
     */
    private canPlace(x: number, z: number): boolean {
        const map = this.voxelMap;

        // マップ範囲チェック（2タイル分）
        if (x < 0 || x + 1 >= map.width || z < 0 || z >= map.depth) {
            return false;
        }

        // 両タイルの表面高さを取得
        const surfaceLeft = map.getSurfacePosition({ x, y: 0, z });
        const surfaceRight = map.getSurfacePosition({ x: x + 1, y: 0, z });

        // 表面高さが一致しなければ配置不可
        if (surfaceLeft.y !== surfaceRight.y) {
            return false;
        }

        // 両タイルの地形・エンティティをチェック
        for (const tileX of [x, x + 1]) {
            const voxel = map.getSurface({ x: tileX, y: 0, z });
            const terrain = getTerrainTypeFromVoxel(voxel);
            const entity = getEntityTypeFromVoxel(voxel);

            if (!PLACEABLE_TERRAINS.has(terrain)) {
                return false;
            }
            if (entity !== ENTITY_TYPES.none) {
                return false;
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
