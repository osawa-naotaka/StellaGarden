import { Application, extend, useApplication, useTick } from "@pixi/react";
import { Assets, Container, Sprite, Texture } from "pixi.js";
import React, { useEffect, useRef, useState } from "react";
import { Viewport } from "pixi-viewport";

// extend tells @pixi/react what Pixi.js components are available
extend({
    Container,
    Sprite,
    Viewport,
});

type Position = {
    x: number;
    y: number;
};

type BunnySpriteProps = {
    pos: Position;
}

function BunnySprite({ pos }: BunnySpriteProps): React.ReactElement {
    const { app } = useApplication();

    // The Pixi.js `Sprite`
    const spriteRef = useRef<Sprite>(null);
    const [texture, setTexture] = useState(Texture.EMPTY);

    // Preload the sprite if it hasn't been loaded yet
    useEffect(() => {
        async function loadTexture() {
            const result = await Assets.load("/assets/bunny.png");
            setTexture(result);
        }

        loadTexture();
    }, []);

    // Listen for animate update
    useTick((ticker) => {
        if (!spriteRef.current) return;
        // Just for fun, let's rotate mr rabbit a little.
        // * Delta is 1 if running at 100% performance *
        // * Creates frame-independent transformation *
        spriteRef.current.rotation += 0.1 * ticker.deltaTime;
    });

    return <pixiSprite ref={spriteRef} texture={texture} anchor={0.5} x={app.screen.width / 2 + pos.x} y={app.screen.height / 2 + pos.y} />;
};

export default function App() {
    return (
        // We'll wrap our components with an <Application> component to provide
        // the Pixi.js Application context
        <Application background={"#1099bb"} resizeTo={window}>
            <pixiViewport screenWidth={window.innerWidth} screenHeight={window.innerHeight} worldWidth={2000} worldHeight={2000} >
                <BunnySprite pos={{ x: 0, y: 0 }} />
                <BunnySprite pos={{ x: 32, y: 0 }} />
                <BunnySprite pos={{ x: 64, y: 0 }} />
            </pixiViewport>
        </Application>
    );
}
