import { Application } from "pixi.js";
import { Viewport } from "pixi-viewport";
import type { Terrain } from "../Entity/Entity";
import { VoxelMap } from "../lib/VoxelMap";
import { Toolbar } from "../Toolbar/Toolbar";
import { TopViewMap } from "../TopViewMap/TopViewMap";
import { createEventBroker, type EventBroker, type EvTopicPacketMap } from "../lib/Event";

export class GameState {
    private readonly m_pixiApp: Application;
    private readonly m_viewport: Viewport;
    private m_topViewMap: TopViewMap;
    private m_toolbar: Toolbar;
    private m_broker: EventBroker<EvTopicPacketMap>;

    constructor({ pixiApp, viewport, topViewMap, toolbar }: { pixiApp: Application; viewport: Viewport; topViewMap: TopViewMap; toolbar: Toolbar }) {
        this.m_pixiApp = pixiApp;
        this.m_viewport = viewport;
        this.m_topViewMap = topViewMap;
        this.m_toolbar = toolbar;
        this.m_broker = createEventBroker<EvTopicPacketMap>(this);
    }

    get pixiApp() {
        return this.m_pixiApp;
    }

    get viewport() {
        return this.m_viewport;
    }

    get topViewMap() {
        return this.m_topViewMap;
    }

    get toolbar() {
        return this.m_toolbar;
    }

    get eventBroker() {
        return this.m_broker;
    }
}

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

    const voxelMap = new VoxelMap<Terrain>(100, 5, 100, 2);
    const topViewMap = new TopViewMap(voxelMap, viewport);
    const toolbar = new Toolbar(pixiApp.stage);

    return new GameState({ pixiApp, viewport, topViewMap, toolbar });
}
