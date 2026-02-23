import { useEffect, useRef } from "react";
import { generateTerrain } from "./Entity/Terrain";
import { DebugText } from "./lib/DebugText";
import { loadSprite } from "./lib/Sprite";
import type { GameState } from "./State/GameState";
import { createGameState } from "./State/GameState";

export default function App() {
    // PixiJSのcanvasはPixiJS自身が生成・管理する。
    // ReactはdivコンテナのみをDOMで管理し、PixiJSのcanvasには触れない。
    // これによりHMR時にdestroy(true)でcanvasを安全に破棄できる。
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        // 右クリックメニューを無効化（コンテナに登録）
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        container.addEventListener("contextmenu", preventContextMenu);

        let gameState: GameState | null = null;

        async function init() {
            gameState = await createGameState(container);

            generateTerrain(gameState.topViewMap.VoxelMap);
            await loadSprite();

            gameState.topViewMap.initializeSprites(gameState.player.positionInWorld);
            // gameState.toolbar.initializeSprites();

            gameState.player.setListeners();
            // gameState.topViewMap.setMouseListeners();

            // デバッグテキスト（左上に主人公のXZ座標を表示）
            const debugText = new DebugText(gameState);
            gameState.pixiApp.stage.addChild(debugText.textView);

            // ウィンドウリサイズ時にツールバーの位置を更新
            window.addEventListener("resize", gameState.toolbar.updateToolbarPosition);

            // ゲームループ
            gameState.pixiApp.ticker.add((ticker) => {
                if (!gameState) return;

                gameState.player.move(ticker.deltaMS);
                // gameState.topViewMap.updatePointerPosition();

                // タイル位置が変わった場合のみスプライトを更新
                gameState.topViewMap.updateViewport(gameState.player.positionInWorld);
                gameState.worldContainer.scale.set(gameState.player.zoomLevel);

                // デバッグテキスト更新
                debugText.update();
            });
        }

        init();

        // クリーンアップ
        return () => {
            container.removeEventListener("contextmenu", preventContextMenu);
            if (gameState) {
                window.removeEventListener("resize", gameState.toolbar.updateToolbarPosition);
                gameState.player.removeListeners();
                gameState.pixiApp.destroy(true, { children: true });
                gameState = null;
            }
        };
    }, []);

    return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}
