import { readFileSync, writeFileSync } from "node:fs";
import * as v from "valibot";
import { decode } from "fast-png";

const spriteDefSchema = v.object({
    meta: v.object({
        image: v.string(),
        format: v.literal("RGBA8888"),
        px: v.number(),
        py: v.number(),
    }),
    displacements: v.record(v.string(), v.record(v.string(), v.tuple([v.number(), v.number()]))),
    animations: v.record(v.string(), v.string()),
    frames: v.record(v.string(), v.tuple([v.number(), v.number(), v.optional(v.string())])),
});

const src = ["tileset", "Idle", "Dash", "Jump", "walk", "icons-items", "BirchTree", "SpringCrops", "TilesetGrassWaterSpring", "TilesetGrassCliffTilesetSpring", "TilesetGrassSpring", "TilledSoilAndWetSoil", "16x16-All-Animations-Sheet"];

type Frame = {
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
}

type Animation = Record<string, string[]>;

function frameOf(x: number, y: number, px: number, py: number): Frame {
    return {
        frame: { x: x * px, y: y * px, w: px, h: py },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: px, h: py },
        sourceSize: { w: px, h: py },
    };
}

for (const name of src) {
    const input = `tool/${name}.def.json`;
    const output = `public/assets/${name}.spritesheet.json`;
    const def = JSON.parse(readFileSync(input, "utf-8"));
    const parsed = v.parse(spriteDefSchema, def);

    const pngData = readFileSync(`public/assets/${parsed.meta.image}`);
    const png = decode(pngData);
    if (!png) {
        throw new Error(`Failed to decode PNG: public/assets/${parsed.meta.image}`);
    }


    const frames: Record<string, Frame> = {};

    for (const [key, [x, y, displacement]] of Object.entries(parsed.frames)) {
        if (displacement) {
            const disp = parsed.displacements[displacement];
            for (const [dir, [dx, dy]] of Object.entries(disp)) {
                const frameKey = `${key}${dir}`;
                frames[frameKey] = frameOf(x + dx, y + dy, parsed.meta.px, parsed.meta.py);
            }
        } else {
            frames[key] = frameOf(x, y, parsed.meta.px, parsed.meta.py);
        }
    }

    const animations: Animation = {};

    for (const [animName, displacement] of Object.entries(parsed.animations)) {
        const disp = parsed.displacements[displacement];
        for (const postfix of Object.keys(disp)) {
            const frameKey = `${animName}${postfix}`;
            if (!frames[frameKey]) {
                throw new Error(`Frame not found: ${frameKey}`);
            }
            if (!animations[animName]) {
                animations[animName] = [];
            }
            animations[animName].push(frameKey);
        }
    }

    const spritesheet = {
        meta: {
            app: "gen-splitesheet.ts",
            version: "1.0.0",
            image: parsed.meta.image,
            format: parsed.meta.format,
            size: {
                w: png.width,
                h: png.height,
            },
            scale: "1",
        },
        animations,
        frames
    };
    writeFileSync(output, JSON.stringify(spritesheet, null, 2));
}
