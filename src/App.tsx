import { AnimatedSprite, Application, Assets, ColorMatrixFilter, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef } from "react";
import { generateTerrain } from "./Terrain";
import type { Cell } from "./Terrain";
import { VoxelMap } from "./VoxelMap";

const map = new VoxelMap<Cell>(40, 8, 40, 3);
generateTerrain(map);
const surfaceCells = map.getSurfaceCells();

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Pixi.jsのApplicationを作成
        const app = new Application();

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
                worldWidth: 2000,
                worldHeight: 2000,
                ticker: app.ticker,
                events: app.renderer.events,
            });

            // Viewportをステージに追加
            app.stage.addChild(viewport);

            // ドラッグ、ピンチズーム、ホイールズームを有効化
            viewport.drag().pinch().wheel().decelerate();

            // テクスチャをロード
            await Assets.load("/assets/tileset.spritesheet.json");
            const walk = await Assets.load("/assets/walk.spritesheet.json");

            // heroスプライトを作成（まだ追加しない）
            const hero = new AnimatedSprite(walk.animations["walk_left_down"]);
            hero.anchor.set(0.5);
            // heroの当たり判定を中心の8x8ピクセルの四角形に設定
            hero.hitArea = new Rectangle(-4, 12, 8, 8);
            hero.x = 900;
            hero.y = 200;
            hero.animationSpeed = 0.1;
            hero.play();

            // heroの当たり判定を可視化（デバッグ用の赤い枠）
            const hitAreaDebug = new Graphics();
            hitAreaDebug.rect(-4, 12, 8, 8);
            hitAreaDebug.stroke({ width: 1, color: 0xff0000 }); // 赤い枠線
            hero.addChild(hitAreaDebug);


            // スプライトを作成してViewportに追加
            const sprites: Sprite[] = [];
            for (const cell of surfaceCells) {
                let sprite_name = "";
                if (cell.type === "soil") {
                    if (cell.pos.y < 6) {
                        sprite_name = "ground_normal_5";
                    } else {
                        sprite_name = "ground_darker_5";
                    }
                } else if (cell.type === "grass") {
                    if (cell.pos.y < 6) {
                        sprite_name = "grass_normal_5";
                    } else {
                        sprite_name = "grass_darker_5";
                    }
                } else if (cell.type === "water") {
                    sprite_name = "water";
                } else {
                    continue;
                }
                const sprite = new Sprite(Texture.from(sprite_name));
                sprite.anchor.set(0.5);
                sprite.x = 900 + cell.pos.x * 16;
                sprite.y = 200 + cell.pos.z * 16;

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
                sprite.on("pointerdown", () => {
                    if (map.isSurface(cell.pos)) {
                        // スプライトの上にheroを移動
                        hero.x = sprite.x;
                        hero.y = sprite.y - 8;
                    }
                });

                sprites.push(sprite);
                viewport.addChild(sprite);
            }

            // heroスプライトを最後に追加（voxelスプライトの上に表示されるように）
            viewport.addChild(hero);

        }

        init();

        // クリーンアップ
        return () => {
            app.destroy(true, { children: true });
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
