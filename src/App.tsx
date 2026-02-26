import { useEffect, useRef } from "react";
import type { GameState } from "./model/GameState";
import { createGameState } from "./model/GameState";
import { DebugText } from "./view/DebugText";
import { loadSprite } from "./view/Sprite";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "./model/Terrain";

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

            gameState.topView.initializeSprites();
            gameState.toolbar.initializeSprites();

            gameState.player.setListeners((pos) => {
                if (!gameState) return;
                const surfacePos = gameState.voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
                const voxel = gameState.voxelMap.get(surfacePos);

                switch (gameState.player.toolbar[gameState.player.slotSelected]) {
                    case "watering_can":
                        if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.soil) {
                            gameState.voxelMap.set(TERRAIN_TYPES.wetSoil, surfacePos); // 水をまくと湿った土になる
                        }
                        break;
                    case "shovel":
                        if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass && getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none) {
                            if (surfacePos.y > 1) {
                                gameState.voxelMap.remove(surfacePos); // 草地を掘ると空になる
                            }
                        }
                        break;
                    case "axe":
                        if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.tree) {
                            gameState.voxelMap.set(voxel & 0x000000ff, surfacePos); // 木を斧で切ると空になる
                        }
                        break;
                    case "hoes":
                        if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass && getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none) {
                            gameState.voxelMap.set(TERRAIN_TYPES.soil, surfacePos); // クワで草地を耕すと土になる
                        }
                        break;
                }

            });

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
                gameState.topView.updateViewport(gameState, gameState.player.playerPositionInWorld);
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
