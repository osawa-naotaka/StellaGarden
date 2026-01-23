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
