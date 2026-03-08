import { Application, Container, TextureSource } from "pixi.js";
import { useEffect, useRef } from "react";
import { PIXEL_PER_TILE, TILE_PER_CHUNK } from "./_boundary/constants";
import type { GameEventMap } from "./_boundary/events";
import { advanceDayAllCrops, dryWetSoil } from "./engine/CropSystem";
import { GameTime } from "./engine/GameTime";
import { PlayerState } from "./engine/PlayerState";
import { generateTerrain } from "./engine/TerrainGenerator";
import { InputHandler } from "./input/InputHandler";
import { createInteractionHandler } from "./input/InteractionSystem";
import { createEventBroker } from "./lib/Event";
import type { Pos2D } from "./lib/VoxelMap";
import { VoxelMap } from "./lib/VoxelMap";
import { DebugText } from "./view/DebugText";
import { InventoryView } from "./view/InventoryView";
import { loadSprite } from "./view/Sprite";
import { Toolbar } from "./view/Toolbar";
import { TopView } from "./view/TopView";

function useGameEngine(worldSize: Pos2D, chunkPerViewport: Pos2D) {
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

            // EventBroker を最初に生成 — 全モジュールへの DI 起点
            const eventBroker = createEventBroker<GameEventMap>();

            const app = new Application();
            await app.init({ background: "#1099bb", resizeTo: window });

            // app.init の await 中にクリーンアップが走った場合は破棄して終了
            if (cancelled) {
                app.destroy(true, { children: true });
                return;
            }
            pixiApp = app;
            container.appendChild(pixiApp.canvas);

            const worldContainer = new Container();
            pixiApp.stage.addChild(worldContainer);

            // 地形生成後に broker を注入（生成中のイベント洪水を避けるため）
            const voxelMap = new VoxelMap(worldSize.x, 6, worldSize.z, 1);
            generateTerrain(voxelMap);
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
                tilePerViewport: { x: chunkPerViewport.x * TILE_PER_CHUNK, z: chunkPerViewport.z * TILE_PER_CHUNK },
            });
            playerState.setEventBroker(eventBroker);
            playerState.inventory.setEventBroker(eventBroker);

            const toolbar = new Toolbar(playerState.inventory);
            pixiApp.stage.addChild(toolbar.top);

            const inventoryView = new InventoryView(playerState.inventory);
            pixiApp.stage.addChild(inventoryView.top);

            await loadSprite();
            // loadSprite の await 中にクリーンアップが走った場合は中断する
            if (!pixiApp) return;

            topView.initializeSprites();

            disposers.push(createInteractionHandler(voxelMap, playerState.inventory, eventBroker));

            // day_changed: ゲーム内1日が経過するたびに全作物の育成カウンタをインクリメント
            const gameTime = new GameTime();
            disposers.push(
                eventBroker.subscribe("day_changed", () => {
                    dryWetSoil(voxelMap);
                    advanceDayAllCrops(voxelMap);
                }),
            );

            // input → engine: player_move / zoom_change を購読して PlayerState を更新
            disposers.push(
                eventBroker.subscribe("player_move", ({ dx, dz, deltaMS }) => {
                    playerState.moveBy(dx, dz, deltaMS);
                }),
            );
            disposers.push(
                eventBroker.subscribe("zoom_change", ({ delta }) => {
                    playerState.adjustZoom(delta);
                }),
            );

            // インベントリトグル（Eキー）— view が subscribe する唯一の UI イベント
            let inventoryOpen = false;
            disposers.push(
                eventBroker.subscribe("toggle_inventory", () => {
                    if (!pixiApp) return;
                    inventoryOpen = !inventoryOpen;
                    if (inventoryOpen) {
                        toolbar.top.visible = false;
                        inventoryView.show();
                    } else {
                        inventoryView.hide();
                        toolbar.top.visible = true;
                    }
                }),
            );

            const inputHandler = new InputHandler(topView.top, playerState, eventBroker);
            disposers.push(inputHandler.setListeners());

            const debugText = new DebugText(playerState, gameTime);
            pixiApp.stage.addChild(debugText.textView);

            // ゲームループ
            pixiApp.ticker.add((ticker) => {
                if (!pixiApp) return;

                gameTime.tick(ticker.deltaMS, eventBroker);
                inputHandler.tick(ticker.deltaMS);

                topView.updateViewport(playerState.posInWorld, playerState.pointerPosInWorld);
                worldContainer.scale.set(playerState.zoomLevel);

                debugText.update();
                toolbar.tick();
                inventoryView.tick();
            });
        }

        init();

        // クリーンアップ
        return () => {
            cancelled = true;
            container.removeEventListener("contextmenu", preventContextMenu);
            if (pixiApp) {
                disposers.forEach((d) => {
                    d();
                });
                pixiApp.destroy(true, { children: true });
                pixiApp = null; // init() 内の !pixiApp チェックで二重破棄を防ぐ
            }
        };
    }, []);

    return containerRef;
}

export default function App() {
    const containerRef = useGameEngine({ x: 400, z: 400 }, { x: 6, z: 4 });
    return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}
