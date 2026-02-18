import { Application } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef } from "react";
import { loadSprite } from "./lib/Sprite";
import { createTopViewMap } from "./TopViewMap/TopViewMap";
import { createToolbar, type Toolbar } from "./Toolbar/Toolbar";

const hotbarIcons = [
    "watering_can",
    "pickaxe",
    "axe",
    "sickle",
    "shovel",
    null,
    null,
    null,
    null,    
];

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // 右クリックメニューを無効化
        const canvas = canvasRef.current;
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        canvas.addEventListener("contextmenu", preventContextMenu);

        // Pixi.jsのApplicationを作成
        const app = new Application();

        let toolbar: Toolbar | null = null;

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
                worldWidth: 1600,
                worldHeight: 1600,
                ticker: app.ticker,
                events: app.renderer.events,
            });

            // ドラッグ、ピンチズーム、ホイールズームを有効化
            viewport.drag().pinch().wheel().decelerate().clamp({ left: 0, right: 1600, top: 0, bottom: 1600 }).clampZoom({ minWidth: 400, minHeight: 400, maxWidth: 1600, maxHeight: 1600 });

            // テクスチャをロード
            await loadSprite();

            // Viewportをステージに追加
            app.stage.addChild(viewport);
            createTopViewMap(viewport);
            toolbar = createToolbar(app.stage);

            // ウィンドウリサイズ時にツールバーの位置を更新
            window.addEventListener("resize", toolbar.updateToolbarPositionFn);

        }

        init();

        // クリーンアップ
        return () => {
            canvas.removeEventListener("contextmenu", preventContextMenu);
            if (toolbar) {
                window.removeEventListener("resize", toolbar.updateToolbarPositionFn);
            }
            app.destroy(true, { children: true });
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
