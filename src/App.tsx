import { AnimatedSprite, Application, Assets, ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef } from "react";
import { generateTerrain, getTerrainCell } from "./Map/Terrain";
import type { Cell } from "./Map/Terrain";
import { VoxelMap } from "./Map/VoxelMap";

const map = new VoxelMap<Cell>(100, 5, 100, 2);
generateTerrain(map);
const surfaceCells = map.getSurfaceCells();

const hotbarIcons = [
    "watering_can",
    "pickaxe",
    "axe",
    "sickle",
    "shovel",
    null,
    null,
    null,
    null,    
];

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // 右クリックメニューを無効化
        const canvas = canvasRef.current;
        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        canvas.addEventListener("contextmenu", preventContextMenu);

        // Pixi.jsのApplicationを作成
        const app = new Application();

        // ツールバー位置更新関数（クリーンアップで使用するため外で定義）
        let updateToolbarPosition: (() => void) | null = null;

        async function init() {
            if (!canvasRef.current) return;

            // Applicationを初期化
            await app.init({
                canvas: canvasRef.current,
                background: "#1099bb",
                resizeTo: window,
            });

            // Viewportを作成
            const viewport = new Viewport({
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                worldWidth: 1600,
                worldHeight: 1600,
                ticker: app.ticker,
                events: app.renderer.events,
            });

            // Viewportをステージに追加
            app.stage.addChild(viewport);

            // ドラッグ、ピンチズーム、ホイールズームを有効化
            viewport.drag().pinch().wheel().decelerate().clamp({ left: 0, right: 1600, top: 0, bottom: 1600 }).clampZoom({ minWidth: 400, minHeight: 400, maxWidth: 1600, maxHeight: 1600 });

            // テクスチャをロード
            await Assets.load("/assets/tileset.spritesheet.json");
            const walk = await Assets.load("/assets/walk.spritesheet.json");
            await Assets.load("/assets/icons-items.spritesheet.json");
            await Assets.load("/assets/BirchTree.spritesheet.json");

            // heroスプライトを作成（まだ追加しない）
            const hero = new AnimatedSprite(walk.animations["walk_left_down"]);
            hero.anchor.set(0.5);
            // heroの当たり判定を中心の8x8ピクセルの四角形に設定
            hero.hitArea = new Rectangle(-4, 12, 8, 8);
            hero.x = 200;
            hero.y = 200;
            hero.animationSpeed = 0.1;
            hero.play();

            // heroの当たり判定を可視化（デバッグ用の赤い枠）
            const hitAreaDebug = new Graphics();
            hitAreaDebug.rect(-4, 12, 8, 8);
            hitAreaDebug.stroke({ width: 1, color: 0xff0000 }); // 赤い枠線
            hero.addChild(hitAreaDebug);


            // スプライトとセルの対応関係を管理するWeakMap
            const spriteToCell = new WeakMap<Sprite, Cell>();

            // セルからスプライトを作成する関数
            const createSpriteFromCell = (cell: Cell): Sprite | null => {
                let sprite_name = "";
                let anchor_x = 0.5;
                let anchor_y = 0.5;

                if (cell.type === "soil") {
                    if (cell.pos.y === 4) {
                        sprite_name = "ground_darkest_5";
                    } else if (cell.pos.y === 3) {
                        sprite_name = "ground_darker_5";
                    } else {
                        sprite_name = "ground_normal_5";
                    }
                } else if (cell.type === "grass") {
                    if (cell.pos.y === 4) {
                        sprite_name = "grass_darkest_5";
                    } else if (cell.pos.y === 3) {
                        sprite_name = "grass_darker_5";
                    } else {
                        sprite_name = "grass_normal_5";
                    }
                } else if (cell.type === "water") {
                    sprite_name = "water";
                } else if (cell.type === "tree") {
                    sprite_name = "birch_tree_sapling";
                    anchor_y = 0.8; // 樹木は下中央を基準点に
                } else {
                    return null;
                }

                const sprite = new Sprite(Texture.from(sprite_name));
                sprite.anchor.set(anchor_x, anchor_y);
                sprite.x = cell.pos.x * 16;
                sprite.y = cell.pos.z * 16;

                // スプライトとセルの対応関係を保存
                spriteToCell.set(sprite, cell);

                // スプライトをインタラクティブに設定
                sprite.interactive = true;

                // 菱形の当たり判定を設定（透明部分を無視）
                // タイルサイズに合わせて菱形の頂点を定義
                sprite.hitArea = new Rectangle(-8, -8, 16, 16);

                // 当たり判定を可視化（デバッグ用の青い線）
                const tileHitAreaDebug = new Graphics();
                tileHitAreaDebug.rect(-8, -8, 16, 16);
                tileHitAreaDebug.stroke({ width: 1, color: 0x0000ff }); // 青い枠線
                sprite.addChild(tileHitAreaDebug);

                // 明度を上げるフィルターを作成
                const brightnessFilter = new ColorMatrixFilter();
                brightnessFilter.brightness(1.5, false); // 明度を50%上げる

                // ホバー時のハイライト
                sprite.on("pointerover", () => {
                    sprite.filters = [brightnessFilter];
                });

                sprite.on("pointerout", () => {
                    sprite.filters = null; // フィルターを解除
                });

                // クリック時の処理
                sprite.on("pointerdown", (event) => {
                    const cellData = spriteToCell.get(sprite);
                    if (!cellData) return;

                    if (event.button === 0) {
                        // 左クリック: 移動
                        if (map.isSurface(cellData.pos)) {
                            hero.x = sprite.x;
                            hero.y = sprite.y - 24;
                        }
                    } else if (event.button === 2) {
                        // 右クリック: インタラクト
                        switch (selectedSlot) {
                            case 2: // 斧
                                if (cellData.type === "tree") {
                                    // VoxelMapからセルを削除
                                    map.remove(cellData);

                                    // スプライトを削除
                                    viewport.removeChild(sprite);
                                    sprite.destroy();
                                }
                                break;
                            case 4: // シャベル
                                const terrainCells = map.get(cellData.pos);
                                if (terrainCells.length === 1 && terrainCells[0].pos.y !== 0) {
                                    map.remove(terrainCells[0]);
                                    // スプライトを削除
                                    viewport.removeChild(sprite);
                                    sprite.destroy();

                                    // 削除したセルの下に新しい表面ができた場合、スプライトを追加
                                    const newSurfaceCells = map.getSurfaceCell(cellData.pos);
                                    const newTerrainCell = getTerrainCell(newSurfaceCells);
                                    if (newTerrainCell) {
                                        const newSprite = createSpriteFromCell(newTerrainCell);
                                        if (newSprite) {
                                            viewport.addChild(newSprite);
                                        }
                                    }                                    
                                }
                                break;
                            default:
                                break;
                        }
                    }
                });

                return sprite;
            };

            // スプライトを作成してViewportに追加
            for (const cells of surfaceCells) {
                // 地形スプライトを作成
                const terrainCell = getTerrainCell(cells);
                if (terrainCell) {
                    const terrainSprite = createSpriteFromCell(terrainCell);
                    if (terrainSprite) {
                        viewport.addChild(terrainSprite);
                    }
                }
            }

            for (const cells of surfaceCells) {
                // 樹木などのエンティティスプライトを作成
                for (const cell of cells) {
                    if (cell.type === "tree") {
                        const entitySprite = createSpriteFromCell(cell);
                        if (entitySprite) {
                            viewport.addChild(entitySprite);
                        }
                    }
                }
            }

            // heroスプライトを最後に追加（voxelスプライトの上に表示されるように）
            viewport.addChild(hero);

            // ホットバーの作成
            const CELL_SIZE = 32;
            const CELL_COUNT = 9;
            const TOOLBAR_WIDTH = CELL_SIZE * CELL_COUNT;
            const TOOLBAR_HEIGHT = CELL_SIZE;
            const PADDING = 8;
            const ICON_SIZE = 16;

            const toolbar = new Container();
            toolbar.x = (window.innerWidth - TOOLBAR_WIDTH) / 2;
            toolbar.y = window.innerHeight - TOOLBAR_HEIGHT - 20; // 画面下部から20pxの余白

            // 背景（半透明の黒）
            const background = new Graphics();
            background.rect(0, 0, TOOLBAR_WIDTH, TOOLBAR_HEIGHT);
            background.fill({ color: 0x000000, alpha: 0.7 });
            background.interactive = true; // 背景でイベントをキャッチ
            background.on("pointerdown", (event) => {
                event.stopPropagation(); // イベントの伝播を止める
            });
            toolbar.addChild(background);

            // 選択状態を管理
            let selectedSlot = 0;

            // 各セルを作成
            const slots: Graphics[] = [];
            const drawFunctions: ((isSelected: boolean) => void)[] = [];

            for (let i = 0; i < CELL_COUNT; i++) {
                const slot = new Graphics();
                slot.x = i * CELL_SIZE;
                slot.y = 0;
                slot.interactive = true;
                slot.cursor = "pointer";

                // 当たり判定を明示的に設定（セル全体をクリック可能に）
                slot.hitArea = new Rectangle(0, 0, CELL_SIZE, CELL_SIZE);

                // 枠線を描画する関数
                const drawSlotBorder = (isSelected: boolean) => {
                    slot.clear();
                    slot.rect(0, 0, CELL_SIZE, CELL_SIZE);
                    // 透明な塗りつぶしを追加（当たり判定のため）
                    slot.fill({ color: 0x000000, alpha: 0.01 });
                    slot.stroke({
                        width: isSelected ? 4 : 2,
                        color: 0xffffff
                    });
                };

                // 描画関数を配列に保存
                drawFunctions.push(drawSlotBorder);

                // 初期描画
                drawSlotBorder(i === selectedSlot);

                // クリックイベント
                slot.on("pointerdown", (event) => {
                    event.stopPropagation(); // イベントの伝播を止める

                    // 前の選択を解除
                    drawFunctions[selectedSlot](false);

                    // 新しい選択を設定
                    selectedSlot = i;
                    drawFunctions[i](true);
                });

                // アイコンの配置（コメントアウト）
                const iconName = hotbarIcons[i];
                if (iconName !== null) {
                    const icon = new Sprite(Texture.from(iconName));
                    icon.width = ICON_SIZE;
                    icon.height = ICON_SIZE;
                    icon.x = PADDING;
                    icon.y = PADDING;
                    slot.addChild(icon);
                }

                slots.push(slot);
                toolbar.addChild(slot);
            }

            // ツールバーをステージに追加（Viewportではなく）
            app.stage.addChild(toolbar);

            // ウィンドウリサイズ時にツールバーの位置を更新
            updateToolbarPosition = () => {
                toolbar.x = (window.innerWidth - TOOLBAR_WIDTH) / 2;
                toolbar.y = window.innerHeight - TOOLBAR_HEIGHT - 20;
            };
            window.addEventListener("resize", updateToolbarPosition);

        }

        init();

        // クリーンアップ
        return () => {
            canvas.removeEventListener("contextmenu", preventContextMenu);
            if (updateToolbarPosition) {
                window.removeEventListener("resize", updateToolbarPosition);
            }
            app.destroy(true, { children: true });
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
