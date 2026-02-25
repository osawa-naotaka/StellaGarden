import { Application, Container } from "pixi.js";
import { generateTerrain } from "../Entity/Terrain";
import { createEventBroker, type EventBroker, type EvTopicPacketMap } from "../lib/Event";
import { type Pos2D, VoxelMap } from "../lib/VoxelMap";
import { Player } from "./Player";
import { Toolbar } from "../view/Toolbar";
import { TopViewMap } from "../view/TopViewMap";

const PIXEL_PER_TILE = 16; // タイル1枚のサイズ（ピクセル）。スプライトのサイズと一致させる必要がある。
const TILE_PER_CHUNK = 16; // チャンクのタイル数

export type GameStateOpt = {
    pixiApp: Application;
    voxelMap: VoxelMap;
    worldContainer: Container;
    topViewMap: TopViewMap;
    toolbar: Toolbar;
    player: Player;
};

export class GameState {
    private readonly m_pixiApp: Application;
    private readonly m_worldContainer: Container;
    private m_voxelMap: VoxelMap;
    private m_topViewMap: TopViewMap;
    private m_toolbar: Toolbar;
    private m_broker: EventBroker<EvTopicPacketMap>;
    private m_player: Player;

    constructor(opt: GameStateOpt) {
        this.m_pixiApp = opt.pixiApp;
        this.m_voxelMap = opt.voxelMap;
        this.m_worldContainer = opt.worldContainer;
        this.m_topViewMap = opt.topViewMap;
        this.m_toolbar = opt.toolbar;
        this.m_player = opt.player;
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

    get voxelMap() {
        return this.m_voxelMap;
    }
}

export async function createGameState(worldSize: Pos2D, chunkPerViewport: Pos2D): Promise<GameState> {
    const pixiApp = new Application();
    await pixiApp.init({
        background: "#1099bb",
        resizeTo: window,
    });

    const worldContainer = new Container();
    pixiApp.stage.addChild(worldContainer);

    const voxelMap = new VoxelMap(worldSize.x, 4, worldSize.z, 1);
    generateTerrain(voxelMap);
    const topViewMap = new TopViewMap(voxelMap, pixiApp, { pixelPerTile: PIXEL_PER_TILE, tilePerChunk: TILE_PER_CHUNK, chunkPerViewport });
    worldContainer.addChild(topViewMap.top);
    const toolbar = new Toolbar(pixiApp.stage);

    // 100x100スタート（タイル換算）
    const player = new Player(topViewMap.top, {
        start: { x: 100, z: 100 },
        worldSize,
        tilePerViewport: { x: chunkPerViewport.x * TILE_PER_CHUNK, z: chunkPerViewport.z * TILE_PER_CHUNK },
    });

    return new GameState({ pixiApp, voxelMap, worldContainer, topViewMap, toolbar, player });
}
