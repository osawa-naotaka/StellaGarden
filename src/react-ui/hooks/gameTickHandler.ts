import type { Application, ColorMatrixFilter, Container, Ticker } from "pixi.js";
import { PIXEL_PER_TILE, TILE_PER_CHUNK } from "../../_boundary/constants";
import type { IEventBroker } from "../../_boundary/interfaces";
import type { GameTime } from "../../engine/GameTime";
import type { PlayerState } from "../../engine/PlayerState";
import type { InputHandler } from "../../input/InputHandler";
import type { Pos2D, Size2D } from "../../lib/VoxelMap";
import type { PlacementOverlay } from "../../view/PlacementOverlay";
import type { PlayerCharacterView } from "../../view/PlayerCharacterView";
import type { TopView } from "../../view/TopView";
import type { UIState } from "../../view/UIState";
import { calcChunkPerViewport, calcTilePerViewport } from "./viewport";

const SAVE_INTERVAL_MS = 30_000;

export interface GameTickDeps {
    pixiApp: Application;
    worldContainer: Container;
    dayNightFilter: ColorMatrixFilter;
    topView: TopView;
    placementOverlay: PlacementOverlay;
    playerCharView: PlayerCharacterView;
    inputHandler: InputHandler;
    playerState: PlayerState;
    gameTime: GameTime;
    uiState: UIState;
    eventBroker: IEventBroker;
    initialChunks: Size2D;
    requestSave: () => Promise<void>;
}

/**
 * pixiApp.ticker.add に渡す毎フレームコールバックを生成する。
 * リサイズ判定用 prevChunks と定期保存用タイマーをクロージャで保持する。
 */
export function createGameTickHandler(deps: GameTickDeps): (ticker: Ticker) => void {
    const {
        pixiApp,
        worldContainer,
        dayNightFilter,
        topView,
        placementOverlay,
        playerCharView,
        inputHandler,
        playerState,
        gameTime,
        uiState,
        eventBroker,
        initialChunks,
        requestSave,
    } = deps;

    let prevChunksW = initialChunks.w;
    let prevChunksH = initialChunks.h;
    let timeSinceLastSave = 0;

    return (ticker) => {
        if (uiState.timeSpeed !== "paused") {
            const timeMultiplier = uiState.timeSpeed === "fast" ? 8 : 1;
            gameTime.tick(ticker.deltaMS * timeMultiplier, eventBroker);
            inputHandler.tick(ticker.deltaMS);
        }
        dayNightFilter.brightness(gameTime.worldBrightness, false);

        timeSinceLastSave += ticker.deltaMS;
        if (timeSinceLastSave >= SAVE_INTERVAL_MS) {
            timeSinceLastSave = 0;
            requestSave();
        }

        const screenW = pixiApp.screen.width;
        const screenH = pixiApp.screen.height;
        const zoom = playerState.zoomLevel;
        const chunks = calcChunkPerViewport(screenW, screenH, zoom);
        if (chunks.w !== prevChunksW || chunks.h !== prevChunksH) {
            topView.resize(chunks);
            prevChunksW = chunks.w;
            prevChunksH = chunks.h;
        }

        playerState.setTilePerViewport(calcTilePerViewport(screenW, screenH, zoom));

        topView.updateViewport(playerState.posInWorld, playerState.pointerPosInWorld);

        const chunkHalfW = Math.floor((prevChunksW * TILE_PER_CHUNK) / 2);
        const chunkHalfH = Math.floor((prevChunksH * TILE_PER_CHUNK) / 2);
        const playerLocalX = chunkHalfW * PIXEL_PER_TILE;
        const playerLocalZ = chunkHalfH * PIXEL_PER_TILE;

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
    };
}
