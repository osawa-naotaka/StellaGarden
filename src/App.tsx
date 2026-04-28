import { Box, Button, Stack, Typography } from "@mui/material";
import { Application, ColorMatrixFilter, Container, TextureSource } from "pixi.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { PIXEL_PER_TILE, TILE_PER_CHUNK } from "./_boundary/constants";
import "./_registry/entities/Chest";
import "./_registry/entities/Clay";
import "./_registry/entities/CompostBin";
import "./_registry/entities/facilities";
import "./_registry/entities/Flax";
import "./_registry/entities/Forge";
import "./_registry/entities/Bonfire";
import "./_registry/entities/Kiln";
import "./_registry/entities/MeteoricIron";
import "./_registry/entities/Pipe";
import "./_registry/entities/Potato";
import "./_registry/entities/Rail";
import "./_registry/entities/Soy";
import "./_registry/entities/Stone";
import "./_registry/entities/Sunflower";
import "./_registry/entities/Tree";
import "./_registry/entities/WarpGate";
import "./_registry/entities/Workbench";
import "./_registry/entities/SoakingBasket";
import "./_registry/items/Dirt";
import "./_registry/items/Fertilizers";
import "./_registry/items/Materials";
import "./_registry/items/Tools";
import "./_registry/items/WateringCan";
import "./_registry/terrains/GrassDirtSoilWetSoil";
import type { GameEventMap } from "./_boundary/events";
import { setChestStorage } from "./_registry/entities/Chest";
import { setForgeStorage } from "./_registry/entities/Forge";
import { setWarpGateStorage } from "./_registry/entities/WarpGate";
import { setWorkbenchStorage } from "./_registry/entities/Workbench";
import { ChestStorage } from "./engine/ChestStorage";
import { regenerateClay } from "./engine/ClaySystem";
import { CraftSystem } from "./engine/CraftSystem";
import { processDailyTick } from "./engine/CropSystem";
import { ForgeStorage } from "./engine/ForgeStorage";
import { GameTime } from "./engine/GameTime";
import { Inventory } from "./engine/Inventory";
import { PlayerState } from "./engine/PlayerState";
import { ReputationSystem } from "./engine/ReputationSystem";
import { generateTerrain } from "./engine/TerrainGenerator";
import { WarpGateStorage } from "./engine/WarpGateStorage";
import { WorkbenchStorage } from "./engine/WorkbenchStorage";
import { InputHandler } from "./input/InputHandler";
import { createInteractionHandler } from "./input/InteractionSystem";
import { DEBUG } from "./lib/debugFlag";
import { createEventBroker } from "./lib/Event";
import { deleteGame, hasSaveData, loadGame, saveGame } from "./lib/SaveSystem";
import type { Pos2D, Size2D } from "./lib/VoxelMap";
import { VoxelMap } from "./lib/VoxelMap";
import { ChestView } from "./view/ChestView";
import { DebugText } from "./view/DebugText";
import { ForgeView } from "./view/ForgeView";
import { InventoryView } from "./view/InventoryView";
import { PlacementOverlay } from "./view/PlacementOverlay";
import { PlayerCharacterView } from "./view/PlayerCharacterView";
import { loadSprite } from "./view/Sprite";
import { Toolbar } from "./view/Toolbar";
import { TopView } from "./view/TopView";
import { UIState } from "./view/UIState";
import { WarpGateView } from "./view/WarpGateView";
import { PropertyView } from "./view/PropertyView";

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

function useGameEngine(worldSize: Size2D, loadSave: boolean) {
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
            const saveData = loadSave ? await loadGame() : null;
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

            // VoxelMap: セーブデータがあれば復元、なければ新規生成
            let voxelMap: VoxelMap;
            if (saveData) {
                const sd = saveData.voxelMap;
                voxelMap = new VoxelMap(sd.width, sd.height, sd.depth, sd.horizonHeight);
                voxelMap.setVoxelsBuffer(new BigUint64Array(sd.voxels));
                voxelMap.setRiversideCells(new Uint32Array(sd.riversideCells));
            } else {
                voxelMap = generateTerrain({ width: worldSize.w, height: 12, depth: worldSize.h, horizonHeight: 3 });
            }
            voxelMap.setEventBroker(eventBroker);

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

            const placementOverlay = new PlacementOverlay(voxelMap, playerState.inventory, uiState);
            worldContainer.addChild(placementOverlay.top);

            const toolbar = new Toolbar(playerState.inventory, uiState);
            pixiApp.stage.addChild(toolbar.top);

            const chestStorage = new ChestStorage();
            if (saveData) chestStorage.loadSaveData(saveData.chestStorage.chests);
            setChestStorage(chestStorage);

            const forgeStorage = new ForgeStorage();
            if (saveData) forgeStorage.loadSaveData(saveData.forgeStorage.forges);
            setForgeStorage(forgeStorage);

            const workbenchStorage = new WorkbenchStorage();
            if (saveData) workbenchStorage.loadSaveData(saveData.workbenchStorage.workbenches);
            setWorkbenchStorage(workbenchStorage);

            const warpGateStorage = new WarpGateStorage();
            if (saveData) warpGateStorage.loadSaveData(saveData.warpGateStorage);
            setWarpGateStorage(warpGateStorage);

            const reputationSystem = new ReputationSystem(saveData?.reputation.points ?? 0);

            const craftSystem = new CraftSystem(playerState.inventory, workbenchStorage, uiState);

            await loadSprite();
            if (!pixiApp) return;

            const inventoryView = new InventoryView(playerState.inventory, craftSystem, uiState);
            pixiApp.stage.addChild(inventoryView.top);

            const chestView = new ChestView(playerState.inventory, chestStorage, uiState);
            pixiApp.stage.addChild(chestView.top);

            const forgeView = new ForgeView(playerState.inventory, forgeStorage, voxelMap, uiState);
            pixiApp.stage.addChild(forgeView.top);

            const warpGateView = new WarpGateView(playerState.inventory, warpGateStorage, reputationSystem, uiState);
            pixiApp.stage.addChild(warpGateView.top);

            topView.resize(initialChunks);

            const playerCharView = new PlayerCharacterView();
            worldContainer.addChild(playerCharView.top);

            disposers.push(createInteractionHandler(voxelMap, playerState.inventory, eventBroker, uiState, playerState));

            const gameTime = new GameTime(saveData?.gameTime.elapsedMs);
            disposers.push(
                eventBroker.subscribe("day_changed", () => {
                    processDailyTick(voxelMap);
                    regenerateClay(voxelMap);
                    forgeStorage.advanceDayAllForges(voxelMap);

                    const shippedItems = new Map();
                    for (const stack of warpGateStorage.getSlots()) {
                        if (!stack) continue;
                        shippedItems.set(stack.itemId, (shippedItems.get(stack.itemId) ?? 0) + stack.count);
                    }
                    reputationSystem.processShipment(shippedItems);
                    warpGateStorage.clear();
                }),
            );

            const inputHandler = new InputHandler(topView.top, playerState, eventBroker);
            disposers.push(inputHandler.setListeners());

            const property = DEBUG ? new DebugText(playerState, gameTime, voxelMap) : new PropertyView(playerState, gameTime, voxelMap);
            if (property) {
                pixiApp.stage.addChild(property.textView);
            }

            // 動的ビューポート: 前回のチャンク数を記憶してリサイズ判定に使う
            let prevChunksW = initialChunks.w;
            let prevChunksH = initialChunks.h;

            // 定期保存: 30秒ごとにセーブ
            const SAVE_INTERVAL_MS = 30_000;
            let timeSinceLastSave = 0;
            let isSaving = false;

            function performSave() {
                if (isSaving) return;
                isSaving = true;
                saveGame({
                    voxelMap: {
                        width: voxelMap.width,
                        height: voxelMap.height,
                        depth: voxelMap.depth,
                        horizonHeight: voxelMap.horizonHeight,
                        voxels: voxelMap.getVoxelsBuffer(),
                        riversideCells: voxelMap.riversideCells,
                    },
                    playerState: {
                        posInWorld: { ...playerState.posInWorld },
                        zoomLevel: playerState.zoomLevel,
                        facing: playerState.facing,
                    },
                    inventory: {
                        toolbarSlots: [...playerState.inventory.toolbarSlots],
                        inventorySlots: [...playerState.inventory.inventorySlots],
                        selectedIndex: playerState.inventory.selectedIndex,
                    },
                    gameTime: {
                        elapsedMs: gameTime.getElapsedMs(),
                    },
                    chestStorage: {
                        chests: chestStorage.toSaveData(),
                    },
                    forgeStorage: {
                        forges: forgeStorage.toSaveData(),
                    },
                    workbenchStorage: {
                        workbenches: workbenchStorage.toSaveData(),
                    },
                    warpGateStorage: warpGateStorage.toSaveData(),
                    reputation: reputationSystem.toSaveData(),
                })
                    .catch((e) => console.warn("Save failed:", e))
                    .finally(() => {
                        isSaving = false;
                    });
            }

            // ゲームループ
            pixiApp.ticker.add((ticker) => {
                if (!pixiApp) return;

                gameTime.tick(ticker.deltaMS, eventBroker);
                dayNightFilter.brightness(gameTime.worldBrightness, false);
                inputHandler.tick(ticker.deltaMS);

                // 定期保存チェック
                timeSinceLastSave += ticker.deltaMS;
                if (timeSinceLastSave >= SAVE_INTERVAL_MS) {
                    timeSinceLastSave = 0;
                    performSave();
                }

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
                const chunkHalfW = Math.floor((prevChunksW * TILE_PER_CHUNK) / 2);
                const chunkHalfH = Math.floor((prevChunksH * TILE_PER_CHUNK) / 2);
                const playerLocalX = chunkHalfW * PIXEL_PER_TILE;
                const playerLocalZ = chunkHalfH * PIXEL_PER_TILE;

                // worldContainer をオフセットし、プレイヤーが画面中央に来るようにする
                worldContainer.scale.set(zoom);
                worldContainer.x = screenW / 2 - playerLocalX * zoom;
                worldContainer.y = screenH / 2 - playerLocalZ * zoom;

                playerCharView.top.x = playerLocalX;
                playerCharView.top.y = playerLocalZ;
                playerCharView.tick(playerState.facing, inputHandler.isMoving, inputHandler.isHolding);

                const viewportOrigin: Pos2D = {
                    x: playerState.posInWorld.x - chunkHalfW,
                    z: playerState.posInWorld.z - chunkHalfH,
                };
                placementOverlay.tick(playerState.pointerPosInWorld, viewportOrigin);

                if (property) property.update();
                toolbar.tick();
                inventoryView.tick();
                chestView.tick();
                forgeView.tick();
                warpGateView.tick();
            });
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

    return containerRef;
}

type AppMode = "title" | "game";

function TitleScreen({ onStart }: { onStart: (loadSave: boolean) => void }) {
    const [saveExists, setSaveExists] = useState<boolean | null>(null);

    useEffect(() => {
        hasSaveData().then(setSaveExists);
    }, []);

    const handleNewGame = useCallback(async () => {
        await deleteGame();
        onStart(false);
    }, [onStart]);

    const handleContinue = useCallback(() => {
        onStart(true);
    }, [onStart]);

    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #1a3a2a 0%, #0d1f17 100%)",
            }}
        >
            <Stack spacing={4} alignItems="center">
                <Typography
                    variant="h2"
                    sx={{
                        color: "#e8f5e9",
                        fontWeight: 700,
                        letterSpacing: 4,
                        textShadow: "2px 2px 8px rgba(0,0,0,0.5)",
                    }}
                >
                    Stella Garden
                </Typography>
                <Stack spacing={2} sx={{ minWidth: 240 }}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleNewGame}
                        sx={{
                            bgcolor: "#4caf50",
                            "&:hover": { bgcolor: "#388e3c" },
                            fontSize: "1.1rem",
                            py: 1.5,
                        }}
                    >
                        はじめから
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        disabled={saveExists === null || !saveExists}
                        onClick={handleContinue}
                        sx={{
                            color: "#e8f5e9",
                            borderColor: "#4caf50",
                            "&:hover": { borderColor: "#388e3c", bgcolor: "rgba(76,175,80,0.1)" },
                            "&.Mui-disabled": { color: "#5a5a5a", borderColor: "#3a3a3a" },
                            fontSize: "1.1rem",
                            py: 1.5,
                        }}
                    >
                        つづきから
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

function GameScreen({ loadSave }: { loadSave: boolean }) {
    const containerRef = useGameEngine({ w: 400, h: 400 }, loadSave);
    return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}

export default function App() {
    const [mode, setMode] = useState<AppMode>("title");
    const [loadSave, setLoadSave] = useState(false);

    const handleStart = useCallback((load: boolean) => {
        setLoadSave(load);
        setMode("game");
    }, []);

    if (mode === "title") {
        return <TitleScreen onStart={handleStart} />;
    }
    return <GameScreen loadSave={loadSave} />;
}
