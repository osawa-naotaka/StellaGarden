import { AnimatedSprite, Application, Assets, ColorMatrixFilter, Graphics, Polygon, Rectangle, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef } from "react";
import { generateTerrain, zigzagPosition } from "./Terrain";
import type { Cell } from "./Terrain";
import { VoxelMap } from "./VoxelMap";

const map = new VoxelMap<Cell>(40, 8, 40, 3);
generateTerrain(map);
const scan_pattern = zigzagPosition(map);

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
            await Assets.load("/assets/isometric-tileset.spritesheet.json");
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
            for (const posproj of scan_pattern) {
                const cells = map.get(posproj.pos);
                for (const cell of cells) {
                    let sprite_name = "";
                    if (cell.type === "soil") {
                        sprite_name = "tile_003.png";
                    } else if (cell.type === "grass") {
                        sprite_name = "tile_024.png";
                    } else if (cell.type === "water") {
                        sprite_name = "tile_092.png";
                    } else {
                        continue;
                    }
                    const sprite = new Sprite(Texture.from(sprite_name));
                    sprite.anchor.set(0.5);
                    sprite.x = 900 + posproj.proj.x * 16;
                    sprite.y = 200 + posproj.proj.y * 8 - posproj.pos.y * 8;

                    // スプライトをインタラクティブに設定
                    sprite.interactive = true;

                    // 菱形の当たり判定を設定（透明部分を無視）
                    // タイルサイズに合わせて菱形の頂点を定義
                    const tileWidth = 32;
                    const tileHeight = 16;
                    const tileThickness = 8; // タイルの厚み（高さ方向のサイズ）
                    sprite.hitArea = new Polygon([
                        0, -tileHeight / 2,     // 上
                        tileWidth / 2, 0,       // 右
                        tileWidth / 2, tileThickness, // 右下（厚み分下げる）
                        0, tileHeight / 2 + tileThickness,      // 下
                        -tileWidth / 2, tileThickness, // 左下（厚み分下げる）
                        -tileWidth / 2, 0       // 左
                    ]);

                    // 当たり判定を可視化（デバッグ用の青い線）
                    const tileHitAreaDebug = new Graphics();
                    tileHitAreaDebug.poly([
                        0, -tileHeight / 2,     // 上
                        tileWidth / 2, 0,       // 右
                        tileWidth / 2, tileThickness, // 右下（厚み分下げる）
                        0, tileHeight / 2 + tileThickness,      // 下
                        -tileWidth / 2, tileThickness, // 左下（厚み分下げる）
                        -tileWidth / 2, 0       // 左
                    ]);
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
                        console.log(`Clicked on cell at (${posproj.pos.x}, ${posproj.pos.y}, ${posproj.pos.z})`);
                        hero.x = sprite.x;
                        hero.y = sprite.y - 24;
                    });

                    sprites.push(sprite);
                    viewport.addChild(sprite);
                }
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
