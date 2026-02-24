import { Application, Container } from "pixi.js";
import { createEventBroker, type EventBroker, type EvTopicPacketMap } from "../lib/Event";
import { type Pos2D, VoxelMap } from "../lib/VoxelMap";
import { Player } from "../Player/Player";
import { Toolbar } from "../Toolbar/Toolbar";
import { TopViewMap } from "../TopViewMap/TopViewMap";

const PIXEL_PER_TILE = 16; // タイル1枚のサイズ（ピクセル）。スプライトのサイズと一致させる必要がある。
const TILE_PER_CHUNK = 16; // チャンクのタイル数

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

export async function createGameState(worldSize: Pos2D, chunkPerViewport: Pos2D): Promise<GameState> {
    const pixiApp = new Application();
    await pixiApp.init({
        background: "#1099bb",
        resizeTo: window,
    });
    // PixiJSが自分で生成したcanvasをコンテナに追加する。
    // React管理のcanvasを渡さないことで、HMR時にdestroy(true)でcanvasを
    // 安全にDOMから削除できる。
    // container.appendChild(pixiApp.canvas);

    // ワールドコンテナ: 毎フレーム位置を更新してカメラ移動を実現する
    const worldContainer = new Container();
    pixiApp.stage.addChild(worldContainer);

    const voxelMap = new VoxelMap(worldSize.x, 4, worldSize.z, 1);
    const topViewMap = new TopViewMap(voxelMap, pixiApp, { pixelPerTile: PIXEL_PER_TILE, tilePerChunk: TILE_PER_CHUNK, chunkPerViewport });
    worldContainer.addChild(topViewMap.top);
    const toolbar = new Toolbar(pixiApp.stage);

    // マップ中央からスタート
    const player = new Player(topViewMap.top, {
        start: { x: 50, z: 50 },
        worldSize,
        tilePerViewport: { x: chunkPerViewport.x * TILE_PER_CHUNK, z: chunkPerViewport.z * TILE_PER_CHUNK },
    });

    return new GameState({ pixiApp, worldContainer, topViewMap, toolbar, player });
}
