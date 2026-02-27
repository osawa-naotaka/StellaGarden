import { Application, Container, TextureSource } from "pixi.js";
import { createEventBroker, type EventBroker, type EvTopicPacketMap } from "../lib/Event";
import { type Pos2D, VoxelMap } from "../lib/VoxelMap";
import { Toolbar } from "../view/Toolbar";
import { TopView } from "../view/TopView";
import { Player } from "./player/Player";
import { generateTerrain } from "./world/TerrainGenerator";

const PIXEL_PER_TILE = 16; // タイル1枚のサイズ（ピクセル）。スプライトのサイズと一致させる必要がある。
const TILE_PER_CHUNK = 16; // チャンクのタイル数

export class GameState {
    readonly pixiApp: Application;
    readonly worldContainer: Container;
    readonly voxelMap: VoxelMap;
    readonly topView: TopView;
    readonly toolbar: Toolbar;
    readonly player: Player;
    readonly eventBroker: EventBroker<EvTopicPacketMap>;

    constructor(opt: {
        pixiApp: Application;
        voxelMap: VoxelMap;
        worldContainer: Container;
        topView: TopView;
        toolbar: Toolbar;
        player: Player;
    }) {
        this.pixiApp = opt.pixiApp;
        this.voxelMap = opt.voxelMap;
        this.worldContainer = opt.worldContainer;
        this.topView = opt.topView;
        this.toolbar = opt.toolbar;
        this.player = opt.player;
        this.eventBroker = createEventBroker<EvTopicPacketMap>(this);
    }
}

export async function createGameState(worldSize: Pos2D, chunkPerViewport: Pos2D): Promise<GameState> {
    TextureSource.defaultOptions.scaleMode = "nearest";
    TextureSource.defaultOptions.wrapMode = "clamp-to-edge";

    const pixiApp = new Application();
    await pixiApp.init({
        background: "#1099bb",
        resizeTo: window,
    });

    const worldContainer = new Container();
    pixiApp.stage.addChild(worldContainer);

    const voxelMap = new VoxelMap(worldSize.x, 3, worldSize.z, 1);
    generateTerrain(voxelMap);
    const topView = new TopView(voxelMap, pixiApp, { pixelPerTile: PIXEL_PER_TILE, tilePerChunk: TILE_PER_CHUNK, chunkPerViewport });
    worldContainer.addChild(topView.top);

    // 100x100スタート（タイル換算）
    const player = new Player(topView.top, {
        start: { x: 200, z: 200 },
        worldSize,
        tilePerViewport: { x: chunkPerViewport.x * TILE_PER_CHUNK, z: chunkPerViewport.z * TILE_PER_CHUNK },
    });

    const toolbar = new Toolbar(player.inventory);
    pixiApp.stage.addChild(toolbar.top);

    return new GameState({ pixiApp, voxelMap, worldContainer, topView, toolbar, player });
}
