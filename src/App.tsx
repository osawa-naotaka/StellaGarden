import { useEffect, useRef } from "react";
import { generateTerrain } from "./Entity/Terrain";
import { loadSprite } from "./lib/Sprite";
import type { GameState } from "./State/GameState";
import { createGameState } from "./State/GameState";

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // 右クリックメニューを無効化
        const canvas = canvasRef.current;
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        canvas.addEventListener("contextmenu", preventContextMenu);

        let gameState: GameState | null = null;

        async function init() {
            gameState = await createGameState(canvas);
            generateTerrain(gameState.topViewMap.VoxelMap);
            await loadSprite();
            gameState.topViewMap.initializeSprites();
            gameState.toolbar.initializeSprites();
            gameState.topViewMap.initializeEvents(gameState);

            // ウィンドウリサイズ時にツールバーの位置を更新
            window.addEventListener("resize", gameState?.toolbar.updateToolbarPosition);
        }

        init();

        // クリーンアップ
        return () => {
            canvas.removeEventListener("contextmenu", preventContextMenu);
            if (gameState) {
                window.removeEventListener("resize", gameState.toolbar.updateToolbarPosition);
                gameState.pixiApp.destroy(true, { children: true });
            }
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
