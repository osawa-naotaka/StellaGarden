import { type Application, ColorMatrixFilter, Container, Sprite, Texture } from "pixi.js";
import type { IVoxelReader, Pos2D, Pos3D } from "../_boundary/interfaces";
import { ChunkRenderer } from "../lib/ChunkRenderer";
import type { Size2D } from "../lib/VoxelMap";
import { getEntitySpriteNameFromVoxel, getTerrainSpriteNamesFromVoxel } from "./renderer/TerrainSpriteResolver";
import type { Tile } from "./Tile";

// ホバー時のブライトネスフィルター（モジュールで一度だけ生成して使い回す）
const hoverFilter = new ColorMatrixFilter();
hoverFilter.brightness(1.5, false);

export class TopView {
    private readonly voxelMap: IVoxelReader;
    private readonly topPlane: Container;
    private readonly terrainPlane: Container;
    private readonly entityPlane: Container;
    private readonly chunkRenderer: ChunkRenderer;
    private readonly chunkSpritePool: Sprite[] = [];

    private readonly pixelPerTile: number;
    private readonly tilePerChunk: number;
    private readonly chunkPerViewport: Size2D;

    constructor(
        voxelMap: IVoxelReader,
        app: Application,
        opt: {
            pixelPerTile: number;
            tilePerChunk: number;
            chunkPerViewport: Size2D;
        },
    ) {
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
            numRenderTextures: opt.chunkPerViewport.w * opt.chunkPerViewport.h * 2,
        });
    }

    get top() {
        return this.topPlane;
    }

    /** スプライトを初期化してビューポートに配置する。アセットロード完了後に呼ぶこと。 */
    initializeSprites() {
        for (const plane of [this.terrainPlane, this.entityPlane]) {
            for (let y = 0; y < this.chunkPerViewport.h; y++) {
                for (let x = 0; x < this.chunkPerViewport.w; x++) {
                    const sprite = new Sprite(Texture.EMPTY);
                    sprite.x = x * this.tilePerChunk * this.pixelPerTile;
                    sprite.y = y * this.tilePerChunk * this.pixelPerTile;
                    this.chunkSpritePool.push(sprite);
                    plane.addChild(sprite);
                }
            }
        }
    }

    /** プレイヤー位置とポインタ位置を受け取り、ビューポートのスプライトを更新する。 */
    updateViewport(positionInWorld: Pos2D, pointerPos: Pos2D) {
        const halfW = Math.floor((this.chunkPerViewport.w * this.tilePerChunk) / 2);
        const halfH = Math.floor((this.chunkPerViewport.h * this.tilePerChunk) / 2);
        const viewportOrigin: Pos2D = {
            x: positionInWorld.x - halfW,
            z: positionInWorld.z - halfH,
        };
        this.renderChunks(viewportOrigin, pointerPos);
    }

    private renderChunks(viewportOrigin: Pos2D, pointerPos: Pos2D) {
        for (let col = 0; col < this.chunkPerViewport.h; col++) {
            for (let row = 0; row < this.chunkPerViewport.w; row++) {
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
            setupTerrainTile(tile, voxels, positions, this.voxelMap.horizonHeight, pointerPos),
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
        const planeOffset = isTerrain ? 0 : this.chunkPerViewport.w * this.chunkPerViewport.h;
        return planeOffset + col * this.chunkPerViewport.w + row;
    }
}

function setupTerrainTile(tile: Tile, voxels: number[], positions: Pos3D[], horizonHeight: number, pointerPos: Pos2D): void {
    const spriteNames = getTerrainSpriteNamesFromVoxel(voxels, positions, horizonHeight);
    tile.useNSprites(spriteNames.length);

    const isHovered = Math.floor(pointerPos.x) === positions[4].x && Math.floor(pointerPos.z) === positions[4].z;

    for (let i = 0; i < spriteNames.length; i++) {
        tile.sprites[i].texture = Texture.from(spriteNames[i]);
        tile.sprites[i].visible = true;
        tile.sprites[i].anchor.set(0, 0);
        tile.sprites[i].filters = isHovered ? [hoverFilter] : [];
        tile.sprites[i].position.set(0);
    }
}

function setupEntityTile(tile: Tile, voxels: number[], positions: Pos3D[], pointerPos: Pos2D): void {
    const infos = getEntitySpriteNameFromVoxel(voxels[4]);
    for (let i = 0; i < infos.length; i++) {
        tile.sprites[i].texture = Texture.from(infos[i][0]); // 0: spriteName
        tile.sprites[i].visible = true;
        tile.sprites[i].anchor.set(0, 0);
        const isHovered = Math.floor(pointerPos.x) === positions[4].x && Math.floor(pointerPos.z) === positions[4].z;
        tile.sprites[i].filters = isHovered ? [hoverFilter] : [];
        tile.sprites[i].position.set(infos[i][1], infos[i][2]);
    }
}
