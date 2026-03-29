import { Application, Container, TextureSource } from "pixi.js";
import { useEffect, useRef } from "react";
import { PIXEL_PER_TILE, TILE_PER_CHUNK } from "./_boundary/constants";
import "./_registry/entities/Chest";
import "./_registry/entities/facilities";
import "./_registry/entities/Flax";
import "./_registry/entities/Forge";
import "./_registry/entities/Potato";
import "./_registry/entities/Soy";
import "./_registry/entities/Stone";
import "./_registry/entities/Sunflower";
import "./_registry/entities/Tree";
import "./_registry/entities/Workbench";
import "./_registry/items/Dirt";
import "./_registry/items/Fertilizers";
import "./_registry/items/Materials";
import "./_registry/items/Tools";
import "./_registry/items/WateringCan";
import "./_registry/terrains/GrassDirt";
import "./_registry/terrains/SoilWetSoil";
import { setChestStorage } from "./_registry/entities/Chest";
import { ChestStorage } from "./engine/ChestStorage";
import { CraftSystem } from "./engine/CraftSystem";
import { processDailyTick } from "./engine/CropSystem";
import { GameTime } from "./engine/GameTime";
import { PlayerState } from "./engine/PlayerState";
import { generateTerrain } from "./engine/TerrainGenerator";
import { InputHandler } from "./input/InputHandler";
import { createInteractionHandler } from "./input/InteractionSystem";
import { DEBUG } from "./lib/debugFlag";
import { createEventBroker } from "./lib/Event";
import type { GameEventMap } from "./_boundary/events";
import type { Pos2D, Size2D } from "./lib/VoxelMap";
import { ChestView } from "./view/ChestView";
import { DebugText } from "./view/DebugText";
import { InventoryView } from "./view/InventoryView";
import { PlacementOverlay } from "./view/PlacementOverlay";
import { loadSprite } from "./view/Sprite";
import { Toolbar } from "./view/Toolbar";
import { TopView } from "./view/TopView";
import { PlayerCharacterView } from "./view/PlayerCharacterView";
import { UIState } from "./view/UIState";

/** 画面サイズとズームレベルから必要なチャンク数を計算する。 */
function calcChunkPerViewport(screenW: number, screenH: number, zoomLevel: number): Size2D {
    const tilesW = screenW / (PIXEL_PER_TILE * zoomLevel);
    const tilesH = screenH / (PIXEL_PER_TILE * zoomLevel);
    return {
        w: Math.ceil(tilesW / TILE_PER_CHUNK) + 2,
        h: Math.ceil(tilesH / TILE_PER_CHUNK) + 2,
    };
}

function calcTilePerViewport(screenW: number, screenH: number, zoomLevel: number): Size2D {
    return {
        w: screenW / (PIXEL_PER_TILE * zoomLevel),
        h: screenH / (PIXEL_PER_TILE * zoomLevel),
    };
}

function useGameEngine(worldSize: Size2D) {
    const containerRef = useRef<HTMLDivElement>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: worldSize は実質定数。PixiJS 初期化はマウント時一度だけ行う設計のため依存追加しない
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        // 右クリックメニューを無効化
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        container.addEventListener("contextmenu", preventContextMenu);

        let cancelled = false;
        let pixiApp: Application | null = null;
        const disposers: (() => void)[] = [];

        async function init() {
            TextureSource.defaultOptions.scaleMode = "nearest";
            TextureSource.defaultOptions.wrapMode = "clamp-to-edge";

            const eventBroker = createEventBroker<GameEventMap>();

            const app = new Application();
            await app.init({ background: "#1099bb", resizeTo: window });

            if (cancelled) {
                app.destroy(true, { children: true });
                return;
            }
            pixiApp = app;
            container.appendChild(pixiApp.canvas);

            const worldContainer = new Container();
            pixiApp.stage.addChild(worldContainer);

            const voxelMap = generateTerrain({ width: worldSize.w, height: 12, depth: worldSize.h, horizonHeight: 3 });
            voxelMap.setEventBroker(eventBroker);

            const topView = new TopView(voxelMap, pixiApp, {
                pixelPerTile: PIXEL_PER_TILE,
                tilePerChunk: TILE_PER_CHUNK,
            });
            worldContainer.addChild(topView.top);

            const initialZoom = 2.0;
            const initialChunks = calcChunkPerViewport(pixiApp.screen.width, pixiApp.screen.height, initialZoom);
            const initialTiles = calcTilePerViewport(pixiApp.screen.width, pixiApp.screen.height, initialZoom);

            const playerState = new PlayerState({
                start: { x: 200, z: 200 },
                worldSize,
                tilePerViewport: initialTiles,
                voxelMap,
            });
            disposers.push(playerState.setEventBroker(eventBroker));
            playerState.inventory.setEventBroker(eventBroker);

            // UIState: UI モード管理（純粋データ、副作用なし）
            const uiState = new UIState();
            disposers.push(uiState.subscribeEvents(eventBroker));

            const placementOverlay = new PlacementOverlay(voxelMap, playerState.inventory, uiState);
            worldContainer.addChild(placementOverlay.top);

            const toolbar = new Toolbar(playerState.inventory, uiState);
            pixiApp.stage.addChild(toolbar.top);

            const chestStorage = new ChestStorage();
            setChestStorage(chestStorage);

            const craftSystem = new CraftSystem(playerState.inventory);

            await loadSprite();
            if (!pixiApp) return;

            const inventoryView = new InventoryView(playerState.inventory, craftSystem, uiState);
            pixiApp.stage.addChild(inventoryView.top);

            const chestView = new ChestView(playerState.inventory, chestStorage, uiState);
            pixiApp.stage.addChild(chestView.top);

            topView.resize(initialChunks);

            const playerCharView = new PlayerCharacterView();
            worldContainer.addChild(playerCharView.top);

            disposers.push(createInteractionHandler(voxelMap, playerState.inventory, eventBroker, uiState, playerState));

            const gameTime = new GameTime();
            disposers.push(
                eventBroker.subscribe("day_changed", () => {
                    processDailyTick(voxelMap);
                }),
            );

            const inputHandler = new InputHandler(topView.top, playerState, eventBroker);
            disposers.push(inputHandler.setListeners());

            const debugText = DEBUG ? new DebugText(playerState, gameTime, voxelMap) : null;
            if (debugText) {
                pixiApp.stage.addChild(debugText.textView);
            }

            // 動的ビューポート: 前回のチャンク数を記憶してリサイズ判定に使う
            let prevChunksW = initialChunks.w;
            let prevChunksH = initialChunks.h;

            // ゲームループ
            pixiApp.ticker.add((ticker) => {
                if (!pixiApp) return;

                gameTime.tick(ticker.deltaMS, eventBroker);
                inputHandler.tick(ticker.deltaMS);

                // 画面サイズ＋ズームから必要チャンク数を再計算
                const screenW = pixiApp.screen.width;
                const screenH = pixiApp.screen.height;
                const zoom = playerState.zoomLevel;
                const chunks = calcChunkPerViewport(screenW, screenH, zoom);
                if (chunks.w !== prevChunksW || chunks.h !== prevChunksH) {
                    topView.resize(chunks);
                    prevChunksW = chunks.w;
                    prevChunksH = chunks.h;
                }

                // tilePerViewport を毎フレーム更新（clamping 用）
                playerState.setTilePerViewport(calcTilePerViewport(screenW, screenH, zoom));

                topView.updateViewport(playerState.posInWorld, playerState.pointerPosInWorld);

                // TopView と同じチャンクベースの viewportOrigin を計算
                const chunkHalfW = Math.floor(prevChunksW * TILE_PER_CHUNK / 2);
                const chunkHalfH = Math.floor(prevChunksH * TILE_PER_CHUNK / 2);
                const playerLocalX = chunkHalfW * PIXEL_PER_TILE;
                const playerLocalZ = chunkHalfH * PIXEL_PER_TILE;

                // worldContainer をオフセットし、プレイヤーが画面中央に来るようにする
                worldContainer.scale.set(zoom);
                worldContainer.x = screenW / 2 - playerLocalX * zoom;
                worldContainer.y = screenH / 2 - playerLocalZ * zoom;

                playerCharView.top.x = playerLocalX;
                playerCharView.top.y = playerLocalZ;
                playerCharView.tick(playerState.facing, inputHandler.isMoving);

                const viewportOrigin: Pos2D = {
                    x: playerState.posInWorld.x - chunkHalfW,
                    z: playerState.posInWorld.z - chunkHalfH,
                };
                placementOverlay.tick(playerState.pointerPosInWorld, viewportOrigin);

                if (debugText) debugText.update();
                toolbar.tick();
                inventoryView.tick();
                chestView.tick();
            });
        }

        init();

        return () => {
            cancelled = true;
            container.removeEventListener("contextmenu", preventContextMenu);
            if (pixiApp) {
                disposers.forEach((d) => d());
                pixiApp.destroy(true, { children: true });
                pixiApp = null;
            }
        };
    }, []);

    return containerRef;
}

export default function App() {
    const containerRef = useGameEngine({ w: 400, h: 400 });
    return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}
