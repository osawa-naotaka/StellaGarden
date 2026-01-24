import { Application, Assets, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef } from "react";
import { generateTerrain } from "./Terrain";

const tile = [
    [-1, 7, 8, 9, -1],
    [7, 10, 5, 11, 9],
    [4, 5, 5, 5, 6],
    [1, 12, 5, 13, 3],
    [-1, 1, 2, 3, -1],
];


const tile_1 = [
    [ 7,  9, -1, -1, -1, -1],
    [ 1,  3, -1, -1, -1, -1],
    [ 7,  9,  7,  9, -1, -1],
    [ 1,  3,  1,  3, -1, -1],
];

const tile_1_1 = [
    [ 7,  9, -1, -1, -1, -1],
    [ 4,  6, -1, -1, -1, -1],
    [ 4, 11,  8,  9, -1, -1],
    [ 1,  2,  2,  3, -1, -1],
];


export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Pixi.jsのApplicationを作成
        const app = new Application();

        async function init() {
            if (!canvasRef.current) return;

            // Applicationを初期化
            await app.init({
                canvas: canvasRef.current,
                background: "#1099bb",
                resizeTo: window,
            });

            // Viewportを作成
            const viewport = new Viewport({
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                worldWidth: 2000,
                worldHeight: 2000,
                ticker: app.ticker,
                events: app.renderer.events,
            });

            // Viewportをステージに追加
            app.stage.addChild(viewport);

            // ドラッグ、ピンチズーム、ホイールズームを有効化
            viewport.drag().pinch().wheel().decelerate();

            // テクスチャをロード
            await Assets.load("/assets/isometric-tileset.spritesheet.json");

            // スプライトを作成してViewportに追加
            const sprites: Sprite[] = [];
            let base_y = 10;
            for (const pos_y of tile_1_1) {
                let base_x = 0;
                for (const tile_number of pos_y) {
                    if (tile_number === -1) {
                        base_x++;
                        continue;
                    }
                    const sprite = new Sprite(Texture.from(`tile_${tile_number.toString().padStart(3, "0")}.png`));
                    sprite.anchor.set(0.5);
                    sprite.x = 100 + base_x * 32;
                    sprite.y = 100 + base_y * 8;

                    // スプライトをインタラクティブにする
                    sprite.eventMode = "static";
                    sprite.cursor = "pointer";

                    // ドラッグ用の状態を保持
                    let dragData: { sprite: Sprite; offset: { x: number; y: number } } | null = null;

                    // ポインタームーブハンドラ（グローバル）
                    const onPointerMove = (event: any) => {
                        if (dragData) {
                            // マウス位置をワールド座標に変換
                            const worldPos = viewport.toWorld(event.global);
                            dragData.sprite.x = worldPos.x + dragData.offset.x;
                            dragData.sprite.y = worldPos.y + dragData.offset.y;
                        }
                    };

                    // ポインターアップハンドラ（グローバル）
                    const onPointerUp = () => {
                        if (dragData) {
                            dragData = null;
                            // Viewportのドラッグを再度有効化
                            viewport.pause = false;

                            // グローバルイベントを削除
                            viewport.off("pointermove", onPointerMove);
                            viewport.off("pointerup", onPointerUp);
                            viewport.off("pointerupoutside", onPointerUp);
                        }
                    };

                    // ポインターダウン（ドラッグ開始）
                    sprite.on("pointerdown", (event) => {
                        // Viewportのドラッグを一時的に無効化
                        viewport.pause = true;

                        // スプライトの位置とマウス位置の差分を保存
                        const worldPos = viewport.toWorld(event.global);
                        dragData = {
                            sprite: sprite,
                            offset: {
                                x: sprite.x - worldPos.x,
                                y: sprite.y - worldPos.y,
                            },
                        };

                        // グローバルイベントを登録
                        viewport.on("pointermove", onPointerMove);
                        viewport.on("pointerup", onPointerUp);
                        viewport.on("pointerupoutside", onPointerUp);
                    });

                    sprites.push(sprite);
                    viewport.addChild(sprite);

                    base_x++;
                }
                base_y--;
            }

            // アニメーション
            // app.ticker.add(() => {
            //     for (const sprite of sprites) {
            //         sprite.rotation += 0.1 * app.ticker.deltaTime;
            //     }
            // });
        }

        init();

        const te = generateTerrain(10, 10);
        console.log(te);

        // クリーンアップ
        return () => {
            app.destroy(true, { children: true });
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
