import { Application, ColorMatrixFilter, Container, TextureSource } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { PIXEL_PER_TILE, TILE_PER_CHUNK } from "../../_boundary/constants";
import type { GameEventMap } from "../../_boundary/events";
import { ChatHistory } from "../../engine/ChatHistory";
import { regenerateClay } from "../../engine/ClaySystem";
import { CraftSystem } from "../../engine/CraftSystem";
import { processDailyTick } from "../../engine/CropSystem";
import { GameTime } from "../../engine/GameTime";
import { Inventory } from "../../engine/Inventory";
import { MissionSystem } from "../../engine/MissionSystem";
import { createPlayerRescueHandler } from "../../engine/PlayerRescueSystem";
import { PlayerState } from "../../engine/PlayerState";
import { ReputationSystem } from "../../engine/ReputationSystem";
import { SeedRequestSystem } from "../../engine/SeedRequestSystem";
import { InputHandler } from "../../input/InputHandler";
import { createInteractionHandler } from "../../input/InteractionSystem";
import { DEBUG } from "../../lib/debugFlag";
import { createEventBroker } from "../../lib/Event";
import { loadGame, type SaveSlot, saveGame } from "../../lib/SaveSystem";
import type { Size2D } from "../../lib/VoxelMap";
import { CartView } from "../../view/CartView";
import { DebugText } from "../../view/DebugText";
import { PlacementOverlay } from "../../view/PlacementOverlay";
import { PlayerCharacterView } from "../../view/PlayerCharacterView";
import { StationForkView } from "../../view/StationForkView";
import { loadSprite } from "../../view/Sprite";
import { TopView } from "../../view/TopView";
import { UIState } from "../../view/UIState";
import type { EngineRefs } from "../EngineContext";
import { ensureSpritesheetsLoaded } from "../spritesheets";
import { buildSaveData } from "./buildSaveData";
import { bootstrapStorages, restoreOrGenerateVoxelMap } from "./gameEngineBoot";
import { createGameTickHandler } from "./gameTickHandler";
import { calcChunkPerViewport, calcTilePerViewport } from "./viewport";
import { getStorage, getStorageSlot, onDailyTickStorage, posFromStorageKey, setStorageSlot } from "../../_registry/StorageRegistry";
import { WARP_GATE_SLOT_COUNT } from "../../_registry/entities/WarpGate";

export interface UseGameEngineResult {
    containerRef: React.RefObject<HTMLDivElement | null>;
    engineRefs: EngineRefs | null;
    requestSave: () => Promise<void>;
    saveState: "idle" | "saving" | "done";
}

export function useGameEngine(worldSize: Size2D, saveSlot: SaveSlot, shouldLoad: boolean, seed: string): UseGameEngineResult {
    // セーブデータから slotName を引き継ぐが、未存在時のフォールバック名はここで決める
    const initialSlotName = "セーブデータ";
    const containerRef = useRef<HTMLDivElement>(null);
    const [engineRefs, setEngineRefs] = useState<EngineRefs | null>(null);
    const requestSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
    const [saveState, setSaveState] = useState<"idle" | "saving" | "done">("idle");
    const setSaveStateRef = useRef(setSaveState);
    setSaveStateRef.current = setSaveState;

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
            const saveData = shouldLoad ? await loadGame(saveSlot) : null;
            const slotName = saveData?.slotName ?? initialSlotName;
            await app.init({ background: "#1099bb", resizeTo: window });

            if (cancelled) {
                app.destroy(true, { children: true });
                return;
            }
            pixiApp = app;
            container.appendChild(pixiApp.canvas);

            const worldContainer = new Container();
            pixiApp.stage.addChild(worldContainer);

            // 昼夜サイクル用フィルター（worldContainer にのみ適用し、UI には影響させない）
            const dayNightFilter = new ColorMatrixFilter();
            worldContainer.filters = [dayNightFilter];

            const voxelMap = restoreOrGenerateVoxelMap(saveData, worldSize, seed, eventBroker);

            const topView = new TopView(voxelMap, pixiApp, {
                pixelPerTile: PIXEL_PER_TILE,
                tilePerChunk: TILE_PER_CHUNK,
            });
            worldContainer.addChild(topView.top);

            const initialZoom = saveData?.playerState.zoomLevel ?? 2.0;
            const initialChunks = calcChunkPerViewport(pixiApp.screen.width, pixiApp.screen.height, initialZoom);
            const initialTiles = calcTilePerViewport(pixiApp.screen.width, pixiApp.screen.height, initialZoom);

            // Inventory: セーブデータがあれば復元
            const inventory = saveData ? new Inventory(saveData.inventory.toolbarSlots, saveData.inventory.inventorySlots) : new Inventory();
            if (saveData) inventory.setSelectedIndex(saveData.inventory.selectedIndex);

            const playerState = new PlayerState({
                start: saveData?.playerState.posInWorld ?? { x: 200, z: 200 },
                worldSize,
                tilePerViewport: initialTiles,
                voxelMap,
                zoomLevel: saveData?.playerState.zoomLevel,
                facing: saveData?.playerState.facing,
                inventory,
            });
            disposers.push(playerState.setEventBroker(eventBroker));
            playerState.inventory.setEventBroker(eventBroker);

            // UIState: UI モード管理（純粋データ、副作用なし）
            const uiState = new UIState();
            disposers.push(uiState.subscribeEvents(eventBroker));

            const placementOverlay = new PlacementOverlay(voxelMap, playerState.inventory, uiState, eventBroker, playerState);
            worldContainer.addChild(placementOverlay.top);

            const {
                bonfireStorage,
                fermentationStorage,
                manualProcessingStorage,
                dailyProcessingStorage,
                autoProcessingStorage,
                cartStorage,
            } = bootstrapStorages(saveData);

            const reputationSystem = new ReputationSystem({
                points: saveData?.reputation.points ?? 0,
                cumulativeShipped: saveData?.reputation.cumulativeShipped,
            });
            reputationSystem.setEventBroker(eventBroker);

            const seedRequestSystem = new SeedRequestSystem(saveData?.seedRequest);

            const missionSystem = new MissionSystem(saveData?.mission);
            disposers.push(missionSystem.subscribeEvents(eventBroker));

            const chatHistory = new ChatHistory(saveData?.chatHistory);
            disposers.push(chatHistory.subscribeEvents(eventBroker));

            const craftSystem = new CraftSystem(playerState.inventory, uiState);

            await loadSprite();
            if (!pixiApp) return;

            // React UI が利用するスプライトシートを並列ロード
            await ensureSpritesheetsLoaded();
            if (cancelled) return;

            topView.resize(initialChunks);

            const playerCharView = new PlayerCharacterView();
            worldContainer.addChild(playerCharView.top);

            const cartView = new CartView();
            worldContainer.addChild(cartView.top);

            const stationForkView = new StationForkView(eventBroker);
            worldContainer.addChild(stationForkView.top);
            disposers.push(() => stationForkView.dispose());

            disposers.push(createInteractionHandler(voxelMap, playerState.inventory, eventBroker, uiState, playerState, cartStorage));
            disposers.push(createPlayerRescueHandler(voxelMap, playerState, eventBroker));

            const gameTime = new GameTime(saveData?.gameTime.elapsedMs);

            // 日次処理対象のストレージ群（KeyedSlotStorage 派生）。新規ストレージ追加時はここに足すだけで day_changed に乗る。
            const dailyTickStorages = [
                bonfireStorage,
                fermentationStorage,
                dailyProcessingStorage,
                autoProcessingStorage,
            ];

            disposers.push(
                eventBroker.subscribe("day_changed", () => {
                    processDailyTick(voxelMap);
                    regenerateClay(voxelMap);
                    for (const s of dailyTickStorages) s.onDailyTick(voxelMap);
                    onDailyTickStorage(voxelMap);

                    // WarpGate は座標管理しない別系統。出荷集計→reputation→clear をここで明示的に行う。
                    const shippedItems = new Map();
                    for (const key of Object.keys(getStorage("warp_gate").value || [])) {
                      for (let i = 0; i < WARP_GATE_SLOT_COUNT; i++) {
                          const stack = getStorageSlot("warp_gate", posFromStorageKey(key), "main", i);
                          if (stack) {
                              shippedItems.set(stack.itemId, (shippedItems.get(stack.itemId) ?? 0) + stack.count);
                              setStorageSlot("warp_gate", posFromStorageKey(key), "main", i, null);
                          }
                      }
                    }
                    reputationSystem.processShipment(shippedItems);

                    // 種リクエスト（詰み救済）: 保留中の種を1スタック配達し、評価値に大幅減点を課す。
                    seedRequestSystem.fulfill(playerState.inventory, reputationSystem);
                    // ミッションシステムなどへ通知。ItemId は string のリテラルユニオンなのでキャスト安全。
                    if (shippedItems.size > 0) {
                        eventBroker.publish("item_shipped", { items: shippedItems as ReadonlyMap<string, number> });
                    }
                }),
            );

            // React 側に engine 参照を提供（全パネル UI はここから利用する）
            setEngineRefs({
                inventory: playerState.inventory,
                playerState,
                gameTime,
                reputationSystem,
                seedRequestSystem,
                bonfireStorage,
                fermentationStorage,
                manualProcessingStorage,
                dailyProcessingStorage,
                autoProcessingStorage,
                cartStorage,
                craftSystem,
                voxelMap,
                uiState,
                eventBroker,
                missionSystem,
                chatHistory,
            });

            const inputHandler = new InputHandler(topView.top, playerState, eventBroker);
            disposers.push(inputHandler.setListeners());

            if (DEBUG) {
                const debugText = new DebugText(playerState, gameTime, voxelMap);
                pixiApp.stage.addChild(debugText.textView);
            }

            // 定期保存。クロージャ越しに新規セーブを抑制する。
            let isSaving = false;
            function performSave(): Promise<void> {
                if (isSaving) return Promise.resolve();
                isSaving = true;
                setSaveStateRef.current("saving");
                return saveGame(
                    saveSlot,
                    buildSaveData({
                        slotName,
                        seed,
                        voxelMap,
                        playerState,
                        gameTime,
                        bonfireStorage,
                        fermentationStorage,
                        manualProcessingStorage,
                        dailyProcessingStorage,
                        autoProcessingStorage,
                        cartStorage,
                        reputationSystem,
                        seedRequestSystem,
                        missionSystem,
                        chatHistory,
                    }),
                )
                    .catch((e) => console.warn("Save failed:", e))
                    .finally(() => {
                        isSaving = false;
                        setSaveStateRef.current("done");
                        setTimeout(() => setSaveStateRef.current("idle"), 1500);
                    });
            }
            requestSaveRef.current = performSave;

            pixiApp.ticker.add(
                createGameTickHandler({
                    pixiApp,
                    worldContainer,
                    dayNightFilter,
                    topView,
                    placementOverlay,
                    playerCharView,
                    cartView,
                    stationForkView,
                    inputHandler,
                    playerState,
                    gameTime,
                    uiState,
                    eventBroker,
                    initialChunks,
                    requestSave: performSave,
                    cartStorage,
                    voxelMap,
                }),
            );
        }

        init();

        return () => {
            cancelled = true;
            container.removeEventListener("contextmenu", preventContextMenu);
            if (pixiApp) {
                disposers.forEach((d) => {
                    d();
                });
                pixiApp.destroy(true, { children: true });
                pixiApp = null;
            }
        };
    }, []);

    return { containerRef, engineRefs, requestSave: () => requestSaveRef.current(), saveState };
}
