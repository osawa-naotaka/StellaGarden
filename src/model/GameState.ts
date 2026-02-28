import { Application, Container, TextureSource } from "pixi.js";
import type { GameEventMap } from "../engine/Events";
import { PlayerState } from "../engine/PlayerState";
import { generateTerrain } from "../engine/TerrainGenerator";
import { createEventBroker, type EventBroker } from "../lib/Event";
import { type Pos2D, VoxelMap } from "../lib/VoxelMap";
import { InventoryView } from "../view/InventoryView";
import { Toolbar } from "../view/Toolbar";
import { TopView } from "../view/TopView";

const PIXEL_PER_TILE = 16; // タイル1枚のサイズ（ピクセル）。スプライトのサイズと一致させる必要がある。
const TILE_PER_CHUNK = 16; // チャンクのタイル数

export class GameState {
    readonly pixiApp: Application;
    readonly worldContainer: Container;
    readonly voxelMap: VoxelMap;
    readonly topView: TopView;
    readonly toolbar: Toolbar;
    readonly inventoryView: InventoryView;
    readonly playerState: PlayerState;
    readonly eventBroker: EventBroker<GameEventMap>;

    constructor(opt: {
        pixiApp: Application;
        voxelMap: VoxelMap;
        worldContainer: Container;
        topView: TopView;
        toolbar: Toolbar;
        inventoryView: InventoryView;
        playerState: PlayerState;
    }) {
        this.pixiApp = opt.pixiApp;
        this.voxelMap = opt.voxelMap;
        this.worldContainer = opt.worldContainer;
        this.topView = opt.topView;
        this.toolbar = opt.toolbar;
        this.inventoryView = opt.inventoryView;
        this.playerState = opt.playerState;
        this.eventBroker = createEventBroker<GameEventMap>();
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

    const playerState = new PlayerState({
        start: { x: 200, z: 200 },
        worldSize,
        tilePerViewport: { x: chunkPerViewport.x * TILE_PER_CHUNK, z: chunkPerViewport.z * TILE_PER_CHUNK },
    });

    const toolbar = new Toolbar(playerState.inventory);
    pixiApp.stage.addChild(toolbar.top);

    const inventoryView = new InventoryView(playerState.inventory, toolbar);
    pixiApp.stage.addChild(inventoryView.top);

    return new GameState({ pixiApp, voxelMap, worldContainer, topView, toolbar, inventoryView, playerState });
}
