import { useEffect, useRef } from "react";
import type { GameState } from "./model/GameState";
import { createGameState } from "./model/GameState";
import { InputHandler } from "./input/InputHandler";
import { createInteractionHandler } from "./input/InteractionSystem";
import { DebugText } from "./view/DebugText";
import { loadSprite } from "./view/Sprite";
import type { Pos2D } from "./lib/VoxelMap";

function useGameEngine(worldSize: Pos2D, chunkPerViewport: Pos2D) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        // 右クリックメニューを無効化（コンテナに登録）
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        container.addEventListener("contextmenu", preventContextMenu);

        let cancelled = false;
        let gameState: GameState | null = null;
        let disposeListeners: (() => void) | null = null;
        let disposeInteraction: (() => void) | null = null;

        async function init() {
            // createGameState の await 中にクリーンアップが走った場合に備えて
            // cancelled フラグで検知し、生成済み GameState を即破棄する
            const gs = await createGameState(worldSize, chunkPerViewport);
            if (cancelled) {
                gs.pixiApp.destroy(true, { children: true });
                return;
            }
            gameState = gs;
            container.appendChild(gameState.pixiApp.canvas);

            await loadSprite();
            // loadSprite の await 中にクリーンアップが走った場合は中断する
            if (!gameState) return;

            gameState.topView.initializeSprites();
            gameState.toolbar.initializeSprites();

            const { playerState, voxelMap, eventBroker, topView } = gameState;

            disposeInteraction = createInteractionHandler(voxelMap, playerState.inventory, eventBroker);

            const inputHandler = new InputHandler(topView.top, playerState, eventBroker);
            disposeListeners = inputHandler.setListeners();

            // デバッグテキスト（左上に主人公のXZ座標を表示）
            const debugText = new DebugText(playerState);
            gameState.pixiApp.stage.addChild(debugText.textView);

            // ウィンドウリサイズ時にツールバーの位置を更新
            window.addEventListener("resize", gameState.toolbar.updateToolbarPosition);

            // ゲームループ
            gameState.pixiApp.ticker.add((ticker) => {
                if (!gameState) return;

                inputHandler.tick(ticker.deltaMS);

                // タイル位置が変わった場合のみスプライトを更新
                gameState.topView.updateViewport(playerState.posInWorld, playerState.pointerPosInWorld);
                gameState.worldContainer.scale.set(playerState.zoomLevel);

                // デバッグテキスト更新
                debugText.update();
            });
        }

        init();

        // クリーンアップ
        return () => {
            cancelled = true;
            container.removeEventListener("contextmenu", preventContextMenu);
            if (gameState) {
                window.removeEventListener("resize", gameState.toolbar.updateToolbarPosition);
                disposeListeners?.();
                disposeInteraction?.();
                gameState.pixiApp.destroy(true, { children: true });
                gameState = null; // init() 内の !gameState チェックで二重破棄を防ぐ
            }
        };
    }, []);

    return containerRef;
}

export default function App() {
    const containerRef = useGameEngine({ x: 400, z: 400 }, { x: 6, z: 4 });
    return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}
