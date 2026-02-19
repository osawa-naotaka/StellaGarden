import { Application } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { loadSprite } from "../lib/Sprite";
import { Toolbar } from "../Toolbar/Toolbar";
import { createTopViewMap, type TopViewMap } from "../TopViewMap/TopViewMap";

export type GameState = {
    pixiApp: Application;
    viewport: Viewport;
    topViewMap: TopViewMap;
    toolbar: Toolbar;
};

export async function createGameState(canvas: HTMLCanvasElement): Promise<GameState> {
    const pixiApp = new Application();
    await pixiApp.init({
        canvas,
        background: "#1099bb",
        resizeTo: window,
    });

    const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 1600,
        worldHeight: 1600,
        ticker: pixiApp.ticker,
        events: pixiApp.renderer.events,
    });

    // ドラッグ、ピンチズーム、ホイールズームを有効化
    viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clamp({ left: 0, right: 1600, top: 0, bottom: 1600 })
        .clampZoom({ minWidth: 400, minHeight: 400, maxWidth: 1600, maxHeight: 1600 });

    pixiApp.stage.addChild(viewport);

    await loadSprite();

    const topViewMap = createTopViewMap(viewport);
    const toolbar = new Toolbar(pixiApp.stage);

    return {
        pixiApp,
        viewport,
        topViewMap,
        toolbar,
    };
}
