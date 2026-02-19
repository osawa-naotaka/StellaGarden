import { useEffect, useRef } from "react";
import { createGameState } from "./State/GameState";
import type { GameState } from "./State/GameState";
import { registerToolbarEventHandlers } from "./Toolbar/Toolbar";

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // 右クリックメニューを無効化
        const canvas = canvasRef.current;
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        canvas.addEventListener("contextmenu", preventContextMenu);

        // Pixi.jsのApplicationを作成
        let gameState: GameState | null = null;

        async function init() {
            if (!canvasRef.current) return;

            gameState = await createGameState(canvasRef.current);
            gameState.topViewMap.initializeEvents(gameState);
            registerToolbarEventHandlers(gameState);
        }

        init();

        // クリーンアップ
        return () => {
            canvas.removeEventListener("contextmenu", preventContextMenu);
            if (gameState) {
                window.removeEventListener("resize", gameState.toolbar.updateToolbarPositionFn);
                gameState.pixiApp.destroy(true, { children: true });
            }
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
