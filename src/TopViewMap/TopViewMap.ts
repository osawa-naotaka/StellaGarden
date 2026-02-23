import { type Application, ColorMatrixFilter, Container, Graphics, RenderTexture, Sprite, Texture } from "pixi.js";
import { getSpriteNameFromVoxel } from "../Entity/Terrain";
import type { Pos2D, VoxelMap } from "../lib/VoxelMap";

export const PIXEL_PER_TILE = 16; // タイル1枚のサイズ（ピクセル）。スプライトのサイズと一致させる必要がある。
export const TILE_PER_CHUNK = 16; // チャンクのタイル数
export const CHUNK_PER_VIEWPORT = 4;
export const TILE_PER_VIEWPORT = TILE_PER_CHUNK * CHUNK_PER_VIEWPORT; // ビューポートのタイル数（横・縦）

export class TopViewMap {
    private app: Application;
    private voxelMap: VoxelMap;
    private parent: Container;
    private terrainPlane: Container;

    // terrain用: POOL_SIZE×POOL_SIZE のスプライトプール（row*POOL_SIZE+col でインデックス）
    private tileSpritePool: Sprite[];
    private tileContainerPool: Container[];
    private chunkTexturePool: Texture[]; // チャンクごとのテクスチャリスト
    private chunkSpritePool: Sprite[]; // チャンクごとのスプライトリスト
    private chunkContainer: Container;

    // 現在のビューポート起点（ワールド座標）
    private viewOrigin: Pos2D;
    private viewportInitialized = false;

    private globalPos: Pos2D = { x: 0, z: 0 }; // 最後のMouseMoveイベントのワールド座標
    private pointer: Pos2D = { x: 0, z: 0 };
    private pointerMoved = false;

    constructor(voxelMap: VoxelMap, parent: Container, app: Application) {
        this.app = app;
        this.voxelMap = voxelMap;
        this.parent = parent;
        this.terrainPlane = new Container();
        this.tileSpritePool = [];
        this.tileContainerPool = [];
        this.chunkTexturePool = [];
        this.chunkSpritePool = [];
        this.chunkContainer = new Container();
        this.viewOrigin = { x: 0, z: 0 };

        this.parent.addChild(this.terrainPlane);
    }

    get VoxelMap() {
        return this.voxelMap;
    }

    // スプライトプールを作成し、初期ビューポートを設定する
    initializeSprites(center: Pos2D) {
        for (let i = 0; i < (TILE_PER_CHUNK + 2) * (TILE_PER_CHUNK + 2); i++) {
            const { top, sprite } = this.createEmptyTile();

            this.tileSpritePool.push(sprite);
            this.tileContainerPool.push(top);

            this.chunkContainer.addChild(top);
        }

        for (let y = 0; y < CHUNK_PER_VIEWPORT; y++) {
            for (let x = 0; x < CHUNK_PER_VIEWPORT; x++) {
                const chunkSprite = new Sprite(Texture.EMPTY);
                chunkSprite.x = x * TILE_PER_CHUNK * PIXEL_PER_TILE;
                chunkSprite.y = y * TILE_PER_CHUNK * PIXEL_PER_TILE;
                this.chunkSpritePool.push(chunkSprite);
                this.terrainPlane.addChild(chunkSprite);

                const renderTexture = RenderTexture.create({
                    width: TILE_PER_CHUNK * PIXEL_PER_TILE,
                    height: TILE_PER_CHUNK * PIXEL_PER_TILE,
                });
                this.chunkTexturePool.push(renderTexture);
            }
        }

        this.updateViewport(center);
    }

    setMouseListeners() {
        this.terrainPlane.interactive = true;
        this.terrainPlane.on("pointermove", (e) => {
            this.globalPos.x = e.global.x;
            this.globalPos.z = e.global.y;
            this.pointerMoved = true;
            this.updatePointerPosition();
        });
    }

    updatePointerPosition() {
        this.pointer.x = this.viewOrigin.x + this.globalPos.x / this.app.stage.scale.x / PIXEL_PER_TILE;
        this.pointer.z = this.viewOrigin.z + this.globalPos.z / this.app.stage.scale.y / PIXEL_PER_TILE;
    }

    get pointerPositionInWorld() {
        return this.pointer;
    }

    private createEmptyTile(): { top: Container; sprite: Sprite } {
        const top = new Container();

        const sprite = new Sprite(Texture.EMPTY);
        top.addChild(sprite);

        // デバッグ用ヒット範囲の可視化
        const hitAreaDebug = new Graphics();
        hitAreaDebug.rect(0, 0, PIXEL_PER_TILE, PIXEL_PER_TILE);
        hitAreaDebug.stroke({ width: 1, color: 0x0000ff });

        top.addChild(hitAreaDebug);

        this.chunkContainer.addChild(top);
        return { top, sprite };
    }

    /**
     * チャンクをレンダリングし、テクスチャとして返す
     *
     * @param chunk チャンク座標（ビューポート内で0からCHUNK_PER_VIEWPORT-1の範囲）
     * @param world ワールド座標（チャンクの左上のワールド座標）
     * @returns チャンクを焼き付けたテクスチャ
     */
    private renderChunk(chunk: Pos2D, world: Pos2D): Texture {
        const chunkIndex = (chunk.z % CHUNK_PER_VIEWPORT) * CHUNK_PER_VIEWPORT + (chunk.x % CHUNK_PER_VIEWPORT);
        const renderTexture = this.chunkTexturePool[chunkIndex];

        // チャンク内のタイルは、1タイル分の余白を持たせて描画する（ビューポート端のタイルが一部分だけ見えるケースに対応するため）
        for (let col = -1; col < TILE_PER_CHUNK + 1; col++) {
            for (let row = -1; row < TILE_PER_CHUNK + 1; row++) {
                const x = Math.floor(world.x) + row;
                const z = Math.floor(world.z) + col;

                const position = this.voxelMap.getSurfacePosition({ x, y: 0, z });
                const voxel = this.voxelMap.get(position);

                const spriteName = getSpriteNameFromVoxel(voxel, position);
                const sprite = this.tileSpritePool[this.tilePositionToIndex(row, col)];
                sprite.texture = Texture.from(spriteName);

                if (this.isMouseOverTile(x, z)) {
                    const filter = new ColorMatrixFilter();
                    filter.brightness(1.5, false);
                    sprite.filters = [filter];
                } else {
                    sprite.filters = [];
                }

                const container = this.tileContainerPool[this.tilePositionToIndex(row, col)];
                container.x = row * PIXEL_PER_TILE - (world.x % 1) * PIXEL_PER_TILE;
                container.y = col * PIXEL_PER_TILE - (world.z % 1) * PIXEL_PER_TILE;

                this.chunkContainer.addChild(container);
            }
        }

        this.app.renderer.render({ container: this.chunkContainer, target: renderTexture, clear: true });

        return renderTexture;
    }

    private isMouseOverTile(x: number, z: number): boolean {
        const tileX = Math.floor(this.pointer.x);
        const tileZ = Math.floor(this.pointer.z);
        return x === tileX && z === tileZ;
    }

    private tilePositionToIndex(row: number, col: number): number {
        // rowとcolは-1からTILE_PER_CHUNKまでの範囲を取るため、インデックスに変換する際に+1して0から始まるようにする
        return (col + 1) * (TILE_PER_CHUNK + 2) + (row + 1);
    }

    // ビューポートの中心位置を受け取り、ボクセルマップ中のどの領域がビューポートに入るかを計算する
    calcViewCorners(center: Pos2D): { left: number; right: number; top: number; bottom: number } {
        const halfViewportSize = Math.floor((CHUNK_PER_VIEWPORT * TILE_PER_CHUNK) / 2);
        const left = center.x - halfViewportSize;
        const right = center.x + halfViewportSize;
        const top = center.z - halfViewportSize;
        const bottom = center.z + halfViewportSize;

        return { left, right, top, bottom };
    }

    // プレイヤー位置を受け取り、タイル位置が変わった場合のみスプライトを更新する
    updateViewport(center: Pos2D) {
        const { left, top } = this.calcViewCorners(center);

        if (!this.viewportInitialized || left !== this.viewOrigin.x || top !== this.viewOrigin.z || this.pointerMoved) {
            this.viewOrigin.x = left;
            this.viewOrigin.z = top;
            this.viewportInitialized = true;
            this.pointerMoved = false;
            this.refreshSprites();
        }
    }

    // entity spriteを全破棄し、terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites() {
        // terrain pool spriteを更新
        for (let col = 0; col < CHUNK_PER_VIEWPORT; col++) {
            for (let row = 0; row < CHUNK_PER_VIEWPORT; row++) {
                const worldX = this.viewOrigin.x + row * TILE_PER_CHUNK;
                const worldZ = this.viewOrigin.z + col * TILE_PER_CHUNK;
                const sprite = this.chunkSpritePool[col * CHUNK_PER_VIEWPORT + row];

                const texture = this.renderChunk({ x: row, z: col }, { x: worldX, z: worldZ });
                sprite.texture = texture;
                sprite.visible = true;
            }
        }
    }
}
