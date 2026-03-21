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
import { UIState } from "./view/UIState";

function useGameEngine(worldSize: Size2D, chunkPerViewport: Size2D) {
    const containerRef = useRef<HTMLDivElement>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: worldSize/chunkPerViewport は実質定数。PixiJS 初期化はマウント時一度だけ行う設計のため依存追加しない
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
                chunkPerViewport,
            });
            worldContainer.addChild(topView.top);

            const playerState = new PlayerState({
                start: { x: 200, z: 200 },
                worldSize,
                tilePerViewport: { w: chunkPerViewport.w * TILE_PER_CHUNK, h: chunkPerViewport.h * TILE_PER_CHUNK },
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

            topView.initializeSprites();

            disposers.push(createInteractionHandler(voxelMap, playerState.inventory, eventBroker, uiState));

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

            // ビューポート原点の計算用定数
            const halfW = Math.floor((chunkPerViewport.w * TILE_PER_CHUNK) / 2);
            const halfH = Math.floor((chunkPerViewport.h * TILE_PER_CHUNK) / 2);

            // ゲームループ
            pixiApp.ticker.add((ticker) => {
                if (!pixiApp) return;

                gameTime.tick(ticker.deltaMS, eventBroker);
                inputHandler.tick(ticker.deltaMS);

                topView.updateViewport(playerState.posInWorld, playerState.pointerPosInWorld);
                worldContainer.scale.set(playerState.zoomLevel);

                const viewportOrigin: Pos2D = {
                    x: playerState.posInWorld.x - halfW,
                    z: playerState.posInWorld.z - halfH,
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
    const containerRef = useGameEngine({ w: 400, h: 400 }, { w: 6, h: 4 });
    return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}
