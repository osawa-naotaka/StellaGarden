import { useEffect, useRef } from "react";
import { DebugText } from "./view/DebugText";
import { loadSprite } from "./view/Sprite";
import type { GameState } from "./model/GameState";
import { createGameState } from "./model/GameState";

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
            gameState = await createGameState({ x: 400, z: 400 }, { x: 6, z: 4 });
            container.appendChild(gameState.pixiApp.canvas);

            await loadSprite();

            gameState.topViewMap.initializeSprites();
            // gameState.toolbar.initializeSprites();

            gameState.player.setListeners();

            // デバッグテキスト（左上に主人公のXZ座標を表示）
            const debugText = new DebugText(gameState);
            gameState.pixiApp.stage.addChild(debugText.textView);

            // ウィンドウリサイズ時にツールバーの位置を更新
            window.addEventListener("resize", gameState.toolbar.updateToolbarPosition);

            // ゲームループ
            gameState.pixiApp.ticker.add((ticker) => {
                if (!gameState) return;

                gameState.player.tick(ticker.deltaMS);

                // タイル位置が変わった場合のみスプライトを更新
                gameState.topViewMap.updateViewport(gameState, gameState.player.playerPositionInWorld);
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
