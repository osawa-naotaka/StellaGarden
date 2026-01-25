import { AnimatedSprite, Application, Assets, Sprite, Texture } from "pixi.js";
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

                    sprites.push(sprite);
                    viewport.addChild(sprite);
                }
            }

            const sprite = new AnimatedSprite(walk.animations["walk_left_down"]);
            sprite.anchor.set(0.5);
            sprite.x = 900;
            sprite.y = 200;
            sprite.animationSpeed = 0.1;
            sprite.play();
            viewport.addChild(sprite);
        }

        init();

        // クリーンアップ
        return () => {
            app.destroy(true, { children: true });
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
