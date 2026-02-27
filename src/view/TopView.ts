import { type Application, ColorMatrixFilter, Container, Sprite, Texture } from "pixi.js";
import { ChunkRenderer } from "../lib/ChunkRenderer";
import type { Pos2D, Pos3D, VoxelMap } from "../lib/VoxelMap";
import { getEntitySpriteNameFromVoxel, getTerrainSpriteNamesFromVoxel } from "./renderer/TerrainSpriteResolver";
import type { Tile } from "./Tile";

// ホバー時のブライトネスフィルター（モジュールで一度だけ生成して使い回す）
const hoverFilter = new ColorMatrixFilter();
hoverFilter.brightness(1.5, false);

export class TopView {
    private readonly voxelMap: VoxelMap;
    private readonly topPlane: Container;
    private readonly terrainPlane: Container;
    private readonly entityPlane: Container;
    private readonly chunkRenderer: ChunkRenderer;
    private readonly chunkSpritePool: Sprite[] = [];

    private readonly pixelPerTile: number;
    private readonly tilePerChunk: number;
    private readonly chunkPerViewport: Pos2D;

    constructor(voxelMap: VoxelMap, app: Application, opt: { pixelPerTile: number; tilePerChunk: number; chunkPerViewport: Pos2D }) {
        this.voxelMap = voxelMap;
        this.pixelPerTile = opt.pixelPerTile;
        this.tilePerChunk = opt.tilePerChunk;
        this.chunkPerViewport = opt.chunkPerViewport;

        this.topPlane = new Container();
        this.terrainPlane = new Container();
        this.entityPlane = new Container();
        this.topPlane.addChild(this.terrainPlane);
        this.topPlane.addChild(this.entityPlane);

        this.chunkRenderer = new ChunkRenderer(app, {
            pixelPerTile: opt.pixelPerTile,
            tilePerChunk: opt.tilePerChunk,
            numRenderTextures: opt.chunkPerViewport.x * opt.chunkPerViewport.z * 2,
        });
    }

    get top() {
        return this.topPlane;
    }

    /** スプライトを初期化してビューポートに配置する。アセットロード完了後に呼ぶこと。 */
    initializeSprites() {
        // terrain と entity の 2 プレーン分ループ
        for (let plane = 0; plane < 2; plane++) {
            for (let y = 0; y < this.chunkPerViewport.z; y++) {
                for (let x = 0; x < this.chunkPerViewport.x; x++) {
                    const sprite = new Sprite(Texture.EMPTY);
                    sprite.x = x * this.tilePerChunk * this.pixelPerTile;
                    sprite.y = y * this.tilePerChunk * this.pixelPerTile;
                    this.chunkSpritePool.push(sprite);
                    if (plane === 0) {
                        this.terrainPlane.addChild(sprite);
                    } else {
                        this.entityPlane.addChild(sprite);
                    }
                }
            }
        }
    }

    /** プレイヤー位置とポインタ位置を受け取り、ビューポートのスプライトを更新する。 */
    updateViewport(positionInWorld: Pos2D, pointerPos: Pos2D) {
        const halfW = Math.floor((this.chunkPerViewport.x * this.tilePerChunk) / 2);
        const halfH = Math.floor((this.chunkPerViewport.z * this.tilePerChunk) / 2);
        const viewportOrigin: Pos2D = {
            x: positionInWorld.x - halfW,
            z: positionInWorld.z - halfH,
        };
        this.renderChunks(viewportOrigin, pointerPos);
    }

    private renderChunks(viewportOrigin: Pos2D, pointerPos: Pos2D) {
        for (let col = 0; col < this.chunkPerViewport.z; col++) {
            for (let row = 0; row < this.chunkPerViewport.x; row++) {
                const world: Pos2D = {
                    x: viewportOrigin.x + row * this.tilePerChunk,
                    z: viewportOrigin.z + col * this.tilePerChunk,
                };
                this.renderTerrainChunk(world, col, row, pointerPos);
                this.renderEntityChunk(world, col, row, pointerPos);
            }
        }
    }

    private renderTerrainChunk(world: Pos2D, col: number, row: number, pointerPos: Pos2D) {
        const idx = this.chunkIndex(col, row, true);
        const sprite = this.chunkSpritePool[idx];
        sprite.texture = this.chunkRenderer.renderChunk(this.voxelMap, world, idx, (tile, voxels, positions) =>
            setupTerrainTile(tile, voxels, positions, pointerPos),
        );
        sprite.visible = true;
    }

    private renderEntityChunk(world: Pos2D, col: number, row: number, pointerPos: Pos2D) {
        const idx = this.chunkIndex(col, row, false);
        const sprite = this.chunkSpritePool[idx];
        sprite.texture = this.chunkRenderer.renderChunk(this.voxelMap, world, idx, (tile, voxels, positions) =>
            setupEntityTile(tile, voxels, positions, pointerPos),
        );
        sprite.visible = true;
    }

    private chunkIndex(col: number, row: number, isTerrain: boolean): number {
        const planeOffset = isTerrain ? 0 : this.chunkPerViewport.x * this.chunkPerViewport.z;
        return planeOffset + col * this.chunkPerViewport.x + row;
    }
}

function setupTerrainTile(tile: Tile, voxels: number[], positions: Pos3D[], pointerPos: Pos2D): void {
    const spriteNames = getTerrainSpriteNamesFromVoxel(voxels, positions);
    tile.useNSprites(spriteNames.length);

    const isHovered = Math.floor(pointerPos.x) === positions[4].x && Math.floor(pointerPos.z) === positions[4].z;

    for (let i = 0; i < spriteNames.length; i++) {
        tile.sprites[i].texture = Texture.from(spriteNames[i]);
        tile.sprites[i].visible = true;
        tile.sprites[i].anchor.set(0, 0);
        tile.sprites[i].filters = isHovered ? [hoverFilter] : [];
    }
}

function setupEntityTile(tile: Tile, voxels: number[], positions: Pos3D[], pointerPos: Pos2D): void {
    const spriteName = getEntitySpriteNameFromVoxel(voxels[4]);
    if (spriteName) {
        tile.sprites[0].texture = Texture.from(spriteName);
        tile.sprites[0].visible = true;
        tile.sprites[0].anchor.set(0.25, 0.75);
        const isHovered = Math.floor(pointerPos.x) === positions[4].x && Math.floor(pointerPos.z) === positions[4].z;
        tile.sprites[0].filters = isHovered ? [hoverFilter] : [];
    } else {
        tile.sprites[0].visible = false;
    }
}
