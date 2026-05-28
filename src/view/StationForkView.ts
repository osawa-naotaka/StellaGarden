import { Container, Graphics } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { IEventBroker, Pos2D } from "../_boundary/interfaces";

/** アニメーション1回分の継続時間（ms）。 */
const DURATION = 350;

/** 進行中の搬送アニメーション1インスタンス。 */
interface TransferAnimation {
    /** 運搬アイテムを表す小さな Graphics。アニメ完了時に destroy する。 */
    itemGraphics: Graphics;
    /** 出発タイル中心（休止辺側、ワールド座標タイル単位）。 */
    restCenter: Pos2D;
    /** 到着タイル中心（逆側、ワールド座標タイル単位）。 */
    oppCenter: Pos2D;
    /** 経過時間（ms）。 */
    elapsed: number;
}

/** restSide 文字列から方向ベクトルを返す。 */
function sideToVec(restSide: "up" | "down" | "left" | "right"): Pos2D {
    switch (restSide) {
        case "up":    return { x: 0,  z: -1 };
        case "down":  return { x: 0,  z:  1 };
        case "left":  return { x: -1, z:  0 };
        case "right": return { x: 1,  z:  0 };
    }
}

/**
 * itemId 文字列から決定的に色（0xRRGGBB）を生成する簡易ハッシュ。
 * 同じ itemId なら常に同じ色になる。
 */
function itemIdToColor(itemId: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < itemId.length; i++) {
        hash ^= itemId.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    // 上位ビットが暗くなりすぎないよう輝度を 0x404040 でフロアする
    const r = Math.max(0x40, (hash >> 16) & 0xff);
    const g = Math.max(0x40, (hash >> 8)  & 0xff);
    const b = Math.max(0x40, (hash)        & 0xff);
    return (r << 16) | (g << 8) | b;
}

/**
 * ステーションの搬送演出を描画するビュー。
 *
 * フォーク本体は常時表示（向きの可視化）のため EntityRegistry の getSprites 側で
 * チャンク描画に乗せている。この層では二重表示を避けるためフォークは描かず、
 * station_fired イベントを購読して「運ばれるアイテム」が休止辺タイル → 逆側タイルへ
 * 飛ぶ 350ms のワンショット演出だけを描く。
 */
export class StationForkView {
    readonly top: Container;

    private animations: TransferAnimation[] = [];
    private readonly disposeSubscription: () => void;

    constructor(eventBroker: IEventBroker) {
        this.top = new Container();

        this.disposeSubscription = eventBroker.subscribe("station_fired", (e) => {
            const sv = sideToVec(e.restSide);
            const restCenter: Pos2D = {
                x: e.stationPos.x + 0.5 + sv.x,
                z: e.stationPos.z + 0.5 + sv.z,
            };
            const oppCenter: Pos2D = {
                x: e.stationPos.x + 0.5 - sv.x,
                z: e.stationPos.z + 0.5 - sv.z,
            };

            const itemGraphics = new Graphics();
            const color = itemIdToColor(e.itemId);
            // アイテムを表す 6x6 の小さな矩形
            itemGraphics.rect(-3, -3, 6, 6).fill({ color });
            this.top.addChild(itemGraphics);

            this.animations.push({ itemGraphics, restCenter, oppCenter, elapsed: 0 });
        });
    }

    /** subscribe を解除してリソースを解放する。 */
    dispose(): void {
        this.disposeSubscription();
        for (const anim of this.animations) {
            anim.itemGraphics.destroy();
        }
        this.animations = [];
    }

    tick(viewportOrigin: Pos2D, deltaMS: number): void {
        const toRemove: TransferAnimation[] = [];

        for (const anim of this.animations) {
            anim.elapsed += deltaMS;
            const t = Math.min(anim.elapsed / DURATION, 1);

            // アイテムは休止辺タイル → 逆側タイルへ片道で運ばれる（搬送方向の可視化）
            const worldX = anim.restCenter.x + (anim.oppCenter.x - anim.restCenter.x) * t;
            const worldZ = anim.restCenter.z + (anim.oppCenter.z - anim.restCenter.z) * t;
            anim.itemGraphics.x = (worldX - viewportOrigin.x) * PIXEL_PER_TILE;
            anim.itemGraphics.y = (worldZ - viewportOrigin.z) * PIXEL_PER_TILE;

            if (t >= 1) {
                toRemove.push(anim);
            }
        }

        for (const anim of toRemove) {
            anim.itemGraphics.destroy();
            const idx = this.animations.indexOf(anim);
            if (idx !== -1) this.animations.splice(idx, 1);
        }
    }
}
