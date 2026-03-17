import { Application, Container, TextureSource } from "pixi.js";
import { useEffect, useRef } from "react";
import { PIXEL_PER_TILE, TILE_PER_CHUNK } from "./_boundary/constants";
import type { GameEventMap } from "./_boundary/events";
import type { ItemId, SlotRef } from "./_boundary/interfaces";
import { advanceDayAllCrops, dryWetSoil } from "./engine/CropSystem";
import { GameTime } from "./engine/GameTime";
import { PlayerState } from "./engine/PlayerState";
import { ENTITY_TYPES, getTerrainTypeFromVoxel } from "./engine/TerrainDefs";
import { generateTerrain } from "./engine/TerrainGenerator";
import { InputHandler } from "./input/InputHandler";
import { createInteractionHandler } from "./input/InteractionSystem";
import { createEventBroker } from "./lib/Event";
import type { Pos2D } from "./lib/VoxelMap";
import { DebugText } from "./view/DebugText";
import { InventoryView } from "./view/InventoryView";
import { PlacementOverlay } from "./view/PlacementOverlay";
import { loadSprite } from "./view/Sprite";
import { Toolbar } from "./view/Toolbar";
import { TopView } from "./view/TopView";
import { DEBUG } from "./lib/debugFlag";

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
        let interactionDisposerRef: (() => void) | null = null;
        let placementOverlayRef: PlacementOverlay | null = null;

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

            const voxelMap = generateTerrain({ width: worldSize.x, height: 12, depth: worldSize.z, horizontalHeight: 3 });
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

            // 配置モード用オーバーレイ（worldContainer 内に配置してズーム・パンに連動）
            const placementOverlay = new PlacementOverlay(voxelMap);
            placementOverlayRef = placementOverlay;
            worldContainer.addChild(placementOverlay.top);

            // ── 配置モード状態管理 ──────────────────────────────────────────────
            let inventoryOpen = false;
            let placementMode: { itemId: ItemId; sourceSlot: SlotRef } | null = null;
            let interactionDisposer: (() => void) | null = null;

            // ビューポート原点の計算用定数（TopView と同じ式）
            const halfW = Math.floor((chunkPerViewport.x * TILE_PER_CHUNK) / 2);
            const halfH = Math.floor((chunkPerViewport.z * TILE_PER_CHUNK) / 2);

            const exitPlacementMode = () => {
                placementOverlay.hide();
                toolbar.top.visible = true;
                placementMode = null;
                // InteractionSystem を再登録
                interactionDisposer = createInteractionHandler(voxelMap, playerState.inventory, eventBroker, () => {});
                interactionDisposerRef = interactionDisposer;
            };

            const handlePlacementConfirm = (pos: Pos2D) => {
                if (!placementMode) return;
                // アンカータイル(左): workbench エンティティを配置
                const surfaceLeft = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
                const terrainLeft = getTerrainTypeFromVoxel(voxelMap.get(surfaceLeft));
                voxelMap.set(terrainLeft | (ENTITY_TYPES.workbench << 8), surfaceLeft);
                // 右タイル: facility_part エンティティを配置
                const surfaceRight = voxelMap.getSurfacePosition({ x: pos.x + 1, y: 0, z: pos.z });
                const terrainRight = getTerrainTypeFromVoxel(voxelMap.get(surfaceRight));
                voxelMap.set(terrainRight | (ENTITY_TYPES.facility_part << 8), surfaceRight);
                exitPlacementMode();
            };

            const handlePlacementCancel = () => {
                if (!placementMode) return;
                // アイテムを元スロットに戻す
                playerState.inventory.setSlot(placementMode.sourceSlot, { itemId: placementMode.itemId, count: 1 });
                exitPlacementMode();
            };

            const inventoryView = new InventoryView(playerState.inventory, (itemId, sourceSlot) => {
                // インベントリからアイテムを取り出し
                playerState.inventory.setSlot(sourceSlot, null);
                // インベントリを閉じる
                inventoryOpen = false;
                inventoryView.hide();
                // 配置モード開始
                placementMode = { itemId, sourceSlot };
                toolbar.top.visible = false;
                placementOverlay.show(handlePlacementConfirm, handlePlacementCancel);
                // 配置モード中は interact_world を無効化
                if (interactionDisposer) {
                    interactionDisposer();
                    interactionDisposer = null;
                    interactionDisposerRef = null;
                }
            });
            pixiApp.stage.addChild(inventoryView.top);

            await loadSprite();
            // loadSprite の await 中にクリーンアップが走った場合は中断する
            if (!pixiApp) return;

            topView.initializeSprites();

            interactionDisposer = createInteractionHandler(voxelMap, playerState.inventory, eventBroker, () => {});
            interactionDisposerRef = interactionDisposer;

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

            // インベントリトグル（Eキー）
            disposers.push(
                eventBroker.subscribe("toggle_inventory", () => {
                    if (!pixiApp) return;
                    // 配置モード中は Eキーでインベントリを開かない
                    if (placementMode) return;
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

            const debugText = DEBUG ? new DebugText(playerState, gameTime) : null;
            if (debugText) {
                pixiApp.stage.addChild(debugText.textView);
            }

            // ゲームループ
            pixiApp.ticker.add((ticker) => {
                if (!pixiApp) return;

                gameTime.tick(ticker.deltaMS, eventBroker);
                inputHandler.tick(ticker.deltaMS);

                topView.updateViewport(playerState.posInWorld, playerState.pointerPosInWorld);
                worldContainer.scale.set(playerState.zoomLevel);

                // 配置モードのオーバーレイ更新
                const viewportOrigin: Pos2D = {
                    x: playerState.posInWorld.x - halfW,
                    z: playerState.posInWorld.z - halfH,
                };
                placementOverlay.tick(playerState.pointerPosInWorld, viewportOrigin);

                if (debugText) debugText.update();
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
                interactionDisposerRef?.();
                placementOverlayRef?.hide();
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
