import { Application, Assets, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useEffect, useRef } from "react";
import { generateTerrain, zigzagTerrain } from "./Terrain";

const tile = generateTerrain(40, 40);

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

            // スプライトを作成してViewportに追加
            const sprites: Sprite[] = [];
            const zigzaggedTile = zigzagTerrain(tile);
            for (let z = -3; z < 3; z++) {
                for (const pos of zigzaggedTile) {
                    if (pos.z < z) continue;
                    let sprite_name = "";
                    if (pos.z < 0) {
                        if (pos.z === z) {
                            sprite_name = `tile_092.png`;
                        } else {
                            sprite_name = `tile_003.png`;
                        }
                    } else {
                        if (pos.z === z) {
                            sprite_name = `tile_024.png`;
                        } else {
                            sprite_name = `tile_004.png`;
                        }
                    }
                    const sprite = new Sprite(Texture.from(sprite_name));
                    sprite.anchor.set(0.5);
                    sprite.x = 100 + pos.x * 16;
                    sprite.y = 100 + pos.y * 8 - (z - 1) * 8;

                    sprites.push(sprite);
                    viewport.addChild(sprite);
                }
            }
        }

        init();

        // クリーンアップ
        return () => {
            app.destroy(true, { children: true });
        };
    }, []);

    return <canvas ref={canvasRef} />;
}
