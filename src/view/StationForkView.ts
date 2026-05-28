import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { IEventBroker, Pos2D } from "../_boundary/interfaces";

/** アニメーション1回分の継続時間（ms）。 */
const DURATION = 350;

/** 進行中のフォークアニメーション1インスタンス。 */
interface ForkAnimation {
    /** フォークの Sprite。アニメ完了時に destroy する。 */
    forkSprite: Sprite;
    /** 運搬アイテムを表す小さな Graphics（往路のみ表示）。アニメ完了時に destroy する。 */
    itemGraphics: Graphics;
    /** フォークが往路出発するタイル中心（ワールド座標、タイル単位）。 */
    restCenter: Pos2D;
    /** フォークが往路到着するタイル中心（ワールド座標、タイル単位）。 */
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

// 専用スプライト（doc/09 ID 171）が未作図のため、暫定的に ss_sprite_051 を縦横とも流用する。
const FORK_PLACEHOLDER_SPRITE = "ss_sprite_051.png";

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
 * ステーションフォークのアニメーションを描画するビュー。
 *
 * station_fired イベントを購読し、350ms のワンショットアニメを再生する。
 * フォークは restSide タイル → 逆側タイルへ往復する（往路でアイテムを運ぶ演出）。
 * 常時表示のフォークは描かず、発火時のみ一時スプライトを生成して完了後に destroy する。
 */
export class StationForkView {
    readonly top: Container;

    private animations: ForkAnimation[] = [];
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

            const forkSprite = new Sprite(Texture.from(FORK_PLACEHOLDER_SPRITE));
            forkSprite.anchor.set(0.5, 0.5);
            forkSprite.scale = 2;
            this.top.addChild(forkSprite);

            const itemGraphics = new Graphics();
            const color = itemIdToColor(e.itemId);
            // アイテムを表す 6x6 の小さな矩形
            itemGraphics.rect(-3, -3, 6, 6).fill({ color });
            this.top.addChild(itemGraphics);

            this.animations.push({ forkSprite, itemGraphics, restCenter, oppCenter, elapsed: 0 });
        });
    }

    /** subscribe を解除してリソースを解放する。 */
    dispose(): void {
        this.disposeSubscription();
        // 残存アニメがあれば全て破棄
        for (const anim of this.animations) {
            anim.forkSprite.destroy();
            anim.itemGraphics.destroy();
        }
        this.animations = [];
    }

    tick(viewportOrigin: Pos2D, deltaMS: number): void {
        const toRemove: ForkAnimation[] = [];

        for (const anim of this.animations) {
            anim.elapsed += deltaMS;
            const t = Math.min(anim.elapsed / DURATION, 1);

            // t ∈ [0, 0.5]: 往路 restCenter → oppCenter（正規化した t' = t * 2）
            // t ∈ [0.5, 1]: 復路 oppCenter → restCenter（正規化した t' = (t - 0.5) * 2）
            let worldX: number;
            let worldZ: number;
            if (t <= 0.5) {
                const tp = t * 2;
                worldX = anim.restCenter.x + (anim.oppCenter.x - anim.restCenter.x) * tp;
                worldZ = anim.restCenter.z + (anim.oppCenter.z - anim.restCenter.z) * tp;
                // 往路中はアイテムをフォークと同じ位置に表示
                anim.itemGraphics.visible = true;
                anim.itemGraphics.x = (worldX - viewportOrigin.x) * PIXEL_PER_TILE;
                anim.itemGraphics.y = (worldZ - viewportOrigin.z) * PIXEL_PER_TILE;
            } else {
                const tp = (t - 0.5) * 2;
                worldX = anim.oppCenter.x + (anim.restCenter.x - anim.oppCenter.x) * tp;
                worldZ = anim.oppCenter.z + (anim.restCenter.z - anim.oppCenter.z) * tp;
                // 復路中はアイテムを非表示（空荷で戻る）
                anim.itemGraphics.visible = false;
            }

            anim.forkSprite.x = (worldX - viewportOrigin.x) * PIXEL_PER_TILE;
            anim.forkSprite.y = (worldZ - viewportOrigin.z) * PIXEL_PER_TILE;

            if (t >= 1) {
                toRemove.push(anim);
            }
        }

        // 完了したアニメをクリーンアップ
        for (const anim of toRemove) {
            anim.forkSprite.destroy();
            anim.itemGraphics.destroy();
            const idx = this.animations.indexOf(anim);
            if (idx !== -1) this.animations.splice(idx, 1);
        }
    }
}
