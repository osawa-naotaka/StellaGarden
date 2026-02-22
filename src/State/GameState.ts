import { Application, Container } from "pixi.js";
import { VoxelMap } from "../lib/VoxelMap";
import { Toolbar } from "../Toolbar/Toolbar";
import { TopViewMap } from "../TopViewMap/TopViewMap";
import { createEventBroker, type EventBroker, type EvTopicPacketMap } from "../lib/Event";
import { Player } from "../Player/Player";

export class GameState {
    private readonly m_pixiApp: Application;
    private readonly m_worldContainer: Container;
    private m_topViewMap: TopViewMap;
    private m_toolbar: Toolbar;
    private m_broker: EventBroker<EvTopicPacketMap>;
    private m_player: Player;

    constructor({
        pixiApp,
        worldContainer,
        topViewMap,
        toolbar,
        player,
    }: {
        pixiApp: Application;
        worldContainer: Container;
        topViewMap: TopViewMap;
        toolbar: Toolbar;
        player: Player;
    }) {
        this.m_pixiApp = pixiApp;
        this.m_worldContainer = worldContainer;
        this.m_topViewMap = topViewMap;
        this.m_toolbar = toolbar;
        this.m_player = player;
        this.m_broker = createEventBroker<EvTopicPacketMap>(this);
    }

    get pixiApp() {
        return this.m_pixiApp;
    }

    get worldContainer() {
        return this.m_worldContainer;
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

    get player() {
        return this.m_player;
    }
}

export async function createGameState(canvas: HTMLCanvasElement): Promise<GameState> {
    const pixiApp = new Application();
    await pixiApp.init({
        canvas,
        background: "#1099bb",
        resizeTo: window,
    });

    // ワールドコンテナ: 毎フレーム位置を更新してカメラ移動を実現する
    const worldContainer = new Container();
    pixiApp.stage.addChild(worldContainer);

    const voxelMap = new VoxelMap(400, 4, 400, 1);
    const topViewMap = new TopViewMap(voxelMap, worldContainer, pixiApp);
    const toolbar = new Toolbar(pixiApp.stage);

    // マップ中央からスタート
    const player = new Player(50, 50);

    return new GameState({ pixiApp, worldContainer, topViewMap, toolbar, player });
}
