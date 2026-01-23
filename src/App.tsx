import { Application, useApplication } from "@pixi/react";
import { Assets, type Application as PixiApplication, Sprite } from "pixi.js";
import { useEffect, useState } from "react";
import { useViewport } from "./Viewport";

type Position = {
    x: number;
    y: number;
};

const BUNNY_POSITIONS: Position[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
];

function GameCanvas() {
    const appContext = useApplication();
    const [app, setApp] = useState<PixiApplication | null>(null);

    // Applicationインスタンスを取得
    useEffect(() => {
        const pixiApp = (appContext as any).app || appContext;
        if (pixiApp && pixiApp.stage) {
            setApp(pixiApp);
        }
    }, [appContext]);

    // Viewportを作成
    const viewport = useViewport(app, window.innerWidth, window.innerHeight, 2000, 2000);

    // スプライトの作成と管理
    useEffect(() => {
        if (!viewport) {
            return;
        }

        const sprites: Sprite[] = [];

        async function loadAndCreateSprites() {
            if (!viewport) return;

            // テクスチャをロード
            const texture = await Assets.load("/assets/bunny.png");

            // スプライトを作成してViewportに追加
            for (const pos of BUNNY_POSITIONS) {
                const sprite = new Sprite(texture);
                sprite.anchor.set(0.5);
                sprite.x = viewport.worldWidth / 2 + pos.x;
                sprite.y = viewport.worldHeight / 2 + pos.y;
                sprites.push(sprite);
                viewport.addChild(sprite);
            }
        }

        loadAndCreateSprites();

        // アニメーション
        const ticker = app?.ticker;
        const animate = () => {
            for (const sprite of sprites) {
                sprite.rotation += (0.1 * (ticker?.deltaMS || 16)) / 16;
            }
        };

        ticker?.add(animate);

        return () => {
            // クリーンアップ
            ticker?.remove(animate);
            for (const sprite of sprites) {
                if (viewport) {
                    viewport.removeChild(sprite);
                }
                sprite.destroy();
            }
        };
    }, [viewport]);

    return null;
}

export default function App() {
    return (
        <Application background={"#1099bb"} resizeTo={window}>
            <GameCanvas />
        </Application>
    );
}
