import { useEffect, useRef } from "react";
import { generateTerrain } from "./Entity/Terrain";
import { loadSprite } from "./lib/Sprite";
import type { GameState } from "./State/GameState";
import { createGameState } from "./State/GameState";
import { Assets, BitmapText } from "pixi.js";

const TILE_SIZE = 16;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;

        // 右クリックメニューを無効化
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        canvas.addEventListener("contextmenu", preventContextMenu);

        // WASD キー状態
        const keyState: Record<string, boolean> = {};
        const onKeyDown = (e: KeyboardEvent) => {
            keyState[e.key.toLowerCase()] = true;
        };
        const onKeyUp = (e: KeyboardEvent) => {
            keyState[e.key.toLowerCase()] = false;
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        // ズームレベル（ホイール操作で変化）
        let zoomLevel = 1.0;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
        };
        canvas.addEventListener("wheel", onWheel, { passive: false });

        let gameState: GameState | null = null;

        async function init() {
            const gs = await createGameState(canvas);
            gameState = gs; // クリーンアップ用に保持

            generateTerrain(gs.topViewMap.VoxelMap);
            await loadSprite();
            gs.topViewMap.initializeSprites(gs.player.worldX, gs.player.worldZ);
            gs.toolbar.initializeSprites();

            // デバッグテキスト（左上に主人公のXZ座標を表示）
            await Assets.load("assets/RobotoBold.fnt");
            const debugText = new BitmapText({
                text: `X: ${gs.player.worldX.toFixed(1)}, Z: ${gs.player.worldZ.toFixed(1)}`,
                style: {
                    fontFamily: "RobotoBold",
                    fontSize: 16,
                    fill: 0xffffff,
                },
            });
            debugText.x = 10;
            debugText.y = 10;
            gs.pixiApp.stage.addChild(debugText);

            // ウィンドウリサイズ時にツールバーの位置を更新
            window.addEventListener("resize", gs.toolbar.updateToolbarPosition);

            // ゲームループ
            gs.pixiApp.ticker.add((ticker) => {
                // WASD移動
                let dx = 0;
                let dz = 0;
                if (keyState["a"] || keyState["arrowleft"]) dx -= 2;
                if (keyState["d"] || keyState["arrowright"]) dx += 2;
                if (keyState["w"] || keyState["arrowup"]) dz -= 2;
                if (keyState["s"] || keyState["arrowdown"]) dz += 2;

                if (dx !== 0 || dz !== 0) {
                    // 斜め移動を正規化
                    if (dx !== 0 && dz !== 0) {
                        const norm = 1 / Math.sqrt(2);
                        dx *= norm;
                        dz *= norm;
                    }
                    gs.player.move(
                        dx,
                        dz,
                        ticker.deltaMS,
                        gs.topViewMap.VoxelMap.width,
                        gs.topViewMap.VoxelMap.depth,
                    );
                }

                // タイル位置が変わった場合のみスプライトを更新
                gs.topViewMap.updateViewport(gs.player.worldX, gs.player.worldZ);

                // worldContainerの位置・スケールを毎フレーム更新（スムーズスクロール＋ズーム）
                // 常に画面中央がプレイヤー位置に固定されるよう計算
                const screenW = gs.pixiApp.screen.width;
                const screenH = gs.pixiApp.screen.height;
                gs.worldContainer.scale.set(zoomLevel);
                // gs.worldContainer.x = screenW / 2 - gs.player.worldX * TILE_SIZE * zoomLevel;
                // gs.worldContainer.y = screenH / 2 - gs.player.worldZ * TILE_SIZE * zoomLevel;

                // デバッグテキスト更新
                debugText.text = `X: ${gs.player.worldX.toFixed(1)}, Z: ${gs.player.worldZ.toFixed(1)}`;
            });
        }

        init();

        // クリーンアップ
        return () => {
            canvas.removeEventListener("contextmenu", preventContextMenu);
            canvas.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            if (gameState) {
                window.removeEventListener("resize", gameState.toolbar.updateToolbarPosition);
                gameState.pixiApp.destroy(true, { children: true });
            }
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
