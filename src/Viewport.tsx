import type { Application as PixiApplication } from "pixi.js";
import { Viewport as PixiViewport } from "pixi-viewport";
import { useEffect, useState } from "react";

export interface ViewportProps {
    app: PixiApplication;
    screenWidth: number;
    screenHeight: number;
    worldWidth: number;
    worldHeight: number;
}

export function createViewport(props: ViewportProps): PixiViewport {
    const { app, screenWidth, screenHeight, worldWidth, worldHeight } = props;

    // Viewportインスタンスを作成
    const viewport = new PixiViewport({
        screenWidth,
        screenHeight,
        worldWidth,
        worldHeight,
        ticker: app.ticker,
        events: app.renderer.events,
    });

    // ドラッグ、ピンチズーム、ホイールズームを有効化
    viewport.drag().pinch().wheel().decelerate();

    return viewport;
}

export function useViewport(
    app: PixiApplication | null,
    screenWidth: number,
    screenHeight: number,
    worldWidth: number,
    worldHeight: number,
): PixiViewport | null {
    const [viewport, setViewport] = useState<PixiViewport | null>(null);

    useEffect(() => {
        if (!app) {
            return;
        }

        // Viewportインスタンスを作成
        const newViewport = createViewport({
            app,
            screenWidth,
            screenHeight,
            worldWidth,
            worldHeight,
        });

        // アプリケーションのステージに追加
        app.stage.addChild(newViewport);

        setViewport(newViewport);

        return () => {
            // クリーンアップ
            if (newViewport.parent) {
                newViewport.parent.removeChild(newViewport);
            }
            newViewport.destroy();
            setViewport(null);
        };
    }, [app, screenWidth, screenHeight, worldWidth, worldHeight]);

    return viewport;
}
