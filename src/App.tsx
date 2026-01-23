import { Application, Assets, Sprite } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef } from "react";

type Position = {
    x: number;
    y: number;
};

const BUNNY_POSITIONS: Position[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
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
            const texture = await Assets.load("/assets/bunny.png");

            // スプライトを作成してViewportに追加
            const sprites: Sprite[] = [];
            for (const pos of BUNNY_POSITIONS) {
                const sprite = new Sprite(texture);
                sprite.anchor.set(0.5);
                sprite.x = viewport.worldWidth / 2 + pos.x;
                sprite.y = viewport.worldHeight / 2 + pos.y;

                // スプライトをインタラクティブにする
                sprite.eventMode = "static";
                sprite.cursor = "pointer";

                // ドラッグ用の状態を保持
                let dragData: { sprite: Sprite; offset: { x: number; y: number } } | null = null;

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

                sprites.push(sprite);
                viewport.addChild(sprite);
            }

            // アニメーション
            app.ticker.add(() => {
                for (const sprite of sprites) {
                    sprite.rotation += 0.1 * app.ticker.deltaTime;
                }
            });
        }

        init();

        // クリーンアップ
        return () => {
            app.destroy(true, { children: true });
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
