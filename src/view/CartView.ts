import { Container, Graphics } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { ICartStorageReader, Pos2D } from "../_boundary/interfaces";

const CART_COLOR = 0x8b4513; // 茶色プレースホルダー

/**
 * 全台車をまとめて描画するビュー。
 * 画像アセットが未整備のため、プレースホルダーとして 16x16 の茶色い四角を描画する。
 * 将来的にスプライト差し替え可能なよう、Map<cartId, Graphics> のプールパターンを採用する。
 */
export class CartView {
    readonly top: Container;

    /** cartId → Graphics のプール。前フレームに存在して今フレームに消えた台車はここから削除する。 */
    private sprites: Map<number, Graphics> = new Map();

    constructor() {
        this.top = new Container();
    }

    tick(cartStorage: ICartStorageReader, viewportOrigin: Pos2D): void {
        // 今フレームに存在する cartId セット
        const currentIds = new Set<number>();

        for (const cart of cartStorage.getAll()) {
            currentIds.add(cart.id);

            let gfx = this.sprites.get(cart.id);
            if (!gfx) {
                // 新規台車: Graphics を確保してプールに登録
                gfx = new Graphics();
                gfx.rect(0, 0, PIXEL_PER_TILE, PIXEL_PER_TILE).fill(CART_COLOR);
                this.top.addChild(gfx);
                this.sprites.set(cart.id, gfx);
            }

            // タイル座標 → ピクセル座標変換（アンカーを中央にするため PIXEL_PER_TILE / 2 オフセット）
            gfx.x = (cart.posInWorld.x - viewportOrigin.x) * PIXEL_PER_TILE　- PIXEL_PER_TILE / 2;
            gfx.y = (cart.posInWorld.z - viewportOrigin.z) * PIXEL_PER_TILE - PIXEL_PER_TILE / 2;
        }

        // 前フレームにいたが今フレームにいない台車の Graphics を破棄
        for (const [id, gfx] of this.sprites) {
            if (!currentIds.has(id)) {
                gfx.destroy();
                this.sprites.delete(id);
            }
        }
    }
}
