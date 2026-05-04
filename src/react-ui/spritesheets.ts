/**
 * スプライトシートのフレーム情報を fetch して、CSS background-position 用に変換する。
 * PixiJS の Assets.load() とは独立に動作する。
 */

interface SpritesheetFrameInfo {
    /** ブラウザから参照する PNG の URL。 */
    readonly imageUrl: string;
    /** PNG 全体の幅。 */
    readonly sheetWidth: number;
    /** PNG 全体の高さ。 */
    readonly sheetHeight: number;
    /** フレームの x 座標（PNG 内、回転後の状態）。 */
    readonly x: number;
    /** フレームの y 座標（PNG 内、回転後の状態）。 */
    readonly y: number;
    /** フレームの幅（PNG 内、回転後の状態）。rotated=true の場合は元画像の高さ。 */
    readonly w: number;
    /** フレームの高さ（PNG 内、回転後の状態）。rotated=true の場合は元画像の幅。 */
    readonly h: number;
    /** TexturePacker が atlas で 90° CW 回転して格納している場合 true。 */
    readonly rotated: boolean;
}

interface RawFrameData {
    frame: { x: number; y: number; w: number; h: number };
    rotated?: boolean;
}

interface RawSpritesheetData {
    frames: Record<string, RawFrameData>;
    meta: { image: string; size: { w: number; h: number } };
}

const SPRITESHEET_PATHS: readonly string[] = [
    "/assets/ss.spritesheet.json",
    "/assets/farmrpg.spritesheet.json",
    "/assets/Pipes.spritesheet.json",
    "/assets/PropsMine.spritesheet.json"
];

let frameMap: Map<string, SpritesheetFrameInfo> | null = null;
let loadPromise: Promise<Map<string, SpritesheetFrameInfo>> | null = null;

async function fetchSheet(jsonPath: string): Promise<RawSpritesheetData> {
    const res = await fetch(jsonPath);
    if (!res.ok) throw new Error(`Failed to load spritesheet: ${jsonPath}`);
    return (await res.json()) as RawSpritesheetData;
}

function resolveImageUrl(jsonPath: string, imageRelative: string): string {
    const dir = jsonPath.substring(0, jsonPath.lastIndexOf("/") + 1);
    if (imageRelative.startsWith("/")) return imageRelative;
    return dir + imageRelative;
}

async function loadAllSheets(): Promise<Map<string, SpritesheetFrameInfo>> {
    const map = new Map<string, SpritesheetFrameInfo>();
    const sheets = await Promise.all(SPRITESHEET_PATHS.map(fetchSheet));
    sheets.forEach((sheet, i) => {
        const imageUrl = resolveImageUrl(SPRITESHEET_PATHS[i], sheet.meta.image);
        const sheetWidth = sheet.meta.size.w;
        const sheetHeight = sheet.meta.size.h;
        for (const [name, data] of Object.entries(sheet.frames)) {
            if (map.has(name)) continue;
            map.set(name, {
                imageUrl,
                sheetWidth,
                sheetHeight,
                x: data.frame.x,
                y: data.frame.y,
                w: data.frame.w,
                h: data.frame.h,
                rotated: data.rotated ?? false,
            });
        }
    });
    return map;
}

/** スプライトシート群を読み込む。アプリ起動時に一度呼ぶ。 */
export function ensureSpritesheetsLoaded(): Promise<Map<string, SpritesheetFrameInfo>> {
    if (frameMap) return Promise.resolve(frameMap);
    if (!loadPromise) {
        loadPromise = loadAllSheets().then((m) => {
            frameMap = m;
            return m;
        });
    }
    return loadPromise;
}

/** 既に読み込まれたフレーム情報を取得する。未ロード時は null を返す。 */
export function getFrameInfo(spriteName: string): SpritesheetFrameInfo | null {
    return frameMap?.get(spriteName) ?? null;
}
