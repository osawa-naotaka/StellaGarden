import { Assets, BitmapText } from "pixi.js";
import { useEffect, useRef } from "react";
import { generateTerrain } from "./Entity/Terrain";
import { loadSprite } from "./lib/Sprite";
import type { GameState } from "./State/GameState";
import { createGameState } from "./State/GameState";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export default function App() {
    // PixiJSのcanvasはPixiJS自身が生成・管理する。
    // ReactはdivコンテナのみをDOMで管理し、PixiJSのcanvasには触れない。
    // これによりHMR時にdestroy(true)でcanvasを安全に破棄できる。
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        // HMR時のレースコンディション防止フラグ
        // init()完了前にクリーンアップが走った場合、init完了後に即破棄する
        let cancelled = false;

        // 右クリックメニューを無効化（コンテナに登録）
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        container.addEventListener("contextmenu", preventContextMenu);

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
        container.addEventListener("wheel", onWheel, { passive: false });

        let gameState: GameState | null = null;

        async function init() {
            const gs = await createGameState(container);

            // createGameState完了前にクリーンアップが実行されていた場合:
            // gameStateがまだnullなのでクリーンアップは何もしていない → ここで手動破棄。
            // destroy(true) = PixiJS自身のcanvasをDOMから削除（安全）
            if (cancelled) {
                gs.pixiApp.destroy(true, { children: true });
                return;
            }

            gameState = gs; // クリーンアップ用に保持

            generateTerrain(gs.topViewMap.VoxelMap);
            await loadSprite();

            // gameState=gs設定後にcleanupが走った場合、cleanupがpixiAppを破棄してgameState=nullにする。
            // ここでは再破棄せず、単純にreturnするだけでよい。
            if (!gameState) return;

            gs.topViewMap.initializeSprites(gs.player.worldX, gs.player.worldZ);
            gs.toolbar.initializeSprites();

            // デバッグテキスト（左上に主人公のXZ座標を表示）
            await Assets.load("assets/RobotoBold.fnt");

            if (!gameState) return;

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
                    gs.player.move(dx, dz, ticker.deltaMS, gs.topViewMap.VoxelMap.width, gs.topViewMap.VoxelMap.depth);
                }

                // タイル位置が変わった場合のみスプライトを更新
                gs.topViewMap.updateViewport(gs.player.worldX, gs.player.worldZ);
                gs.worldContainer.scale.set(zoomLevel);

                // デバッグテキスト更新
                debugText.text = `X: ${gs.player.worldX.toFixed(1)}, Z: ${gs.player.worldZ.toFixed(1)}`;
            });
        }

        init();

        // クリーンアップ
        return () => {
            cancelled = true;
            container.removeEventListener("contextmenu", preventContextMenu);
            container.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            if (gameState) {
                window.removeEventListener("resize", gameState.toolbar.updateToolbarPosition);
                // destroy(true) = PixiJSが自分で生成したcanvasをDOMから削除する（安全）。
                // Reactのcanvasではないため、destroyしても問題ない。
                gameState.pixiApp.destroy(true, { children: true });
                gameState = null;
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ position: "fixed", inset: 0 }}
        />
    );
}
