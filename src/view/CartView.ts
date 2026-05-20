import { Container, Sprite, Texture } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { Direction8, ICartStorageReader, Pos2D } from "../_boundary/interfaces";

/** facing から使用するスプライト名を返す。水平方向は cart_h、垂直方向は cart_v。 */
function spriteNameForFacing(facing: Direction8): string {
    switch (facing) {
        case "left":
        case "right":
            return "cart_h";
        case "up":
        case "down":
            return "cart_v";
        default:
            return "cart_h";
    }
}

/**
 * 全台車をまとめて描画するビュー。
 * Sprite を cartId 単位でプールし、消えた台車は destroy する。
 */
export class CartView {
    readonly top: Container;

    /** cartId → Sprite のプール。前フレームに存在して今フレームに消えた台車はここから削除する。 */
    private sprites: Map<number, Sprite> = new Map();
    /** cartId → 現在のテクスチャ名キャッシュ（無駄な setter 呼び出しを避けるため）。 */
    private currentSpriteName: Map<number, string> = new Map();

    constructor() {
        this.top = new Container();
    }

    tick(cartStorage: ICartStorageReader, viewportOrigin: Pos2D): void {
        const currentIds = new Set<number>();

        for (const cart of cartStorage.getAll()) {
            currentIds.add(cart.id);

            let sprite = this.sprites.get(cart.id);
            if (!sprite) {
                sprite = new Sprite();
                sprite.anchor.set(0.5, 0.5);
                this.top.addChild(sprite);
                this.sprites.set(cart.id, sprite);
            }

            const name = spriteNameForFacing(cart.facing);
            if (this.currentSpriteName.get(cart.id) !== name) {
                sprite.texture = Texture.from(name);
                this.currentSpriteName.set(cart.id, name);
            }

            sprite.x = (cart.posInWorld.x - viewportOrigin.x) * PIXEL_PER_TILE;
            sprite.y = (cart.posInWorld.z - viewportOrigin.z) * PIXEL_PER_TILE;
            sprite.scale = 2;
        }

        // 前フレームにいたが今フレームにいない台車のリソースを破棄
        for (const [id, sprite] of this.sprites) {
            if (!currentIds.has(id)) {
                sprite.destroy();
                this.sprites.delete(id);
                this.currentSpriteName.delete(id);
            }
        }
    }
}
