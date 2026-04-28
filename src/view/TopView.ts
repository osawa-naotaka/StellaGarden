import { type Application, ColorMatrixFilter, Container, Sprite, Texture } from "pixi.js";
import type { IVoxelReader, Pos2D, Pos3D } from "../_boundary/interfaces";
import { getEntityTypeFromVoxel, ENTITY_TYPES } from "../engine/TerrainDefs";
import { ChunkRenderer } from "../lib/ChunkRenderer";
import type { Size2D } from "../lib/VoxelMap";
import { findFacilityAnchor } from "../_registry/facilityUtil";
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
    private chunkPerViewport_: Size2D = { w: 0, h: 0 };

    constructor(
        voxelMap: IVoxelReader,
        app: Application,
        opt: {
            pixelPerTile: number;
            tilePerChunk: number;
        },
    ) {
        this.voxelMap = voxelMap;
        this.pixelPerTile = opt.pixelPerTile;
        this.tilePerChunk = opt.tilePerChunk;

        this.topPlane = new Container();
        this.terrainPlane = new Container();
        this.entityPlane = new Container();
        this.topPlane.addChild(this.terrainPlane);
        this.topPlane.addChild(this.entityPlane);

        this.chunkRenderer = new ChunkRenderer(app, {
            pixelPerTile: opt.pixelPerTile,
            tilePerChunk: opt.tilePerChunk,
            numRenderTextures: 0,
        });
    }

    get top() {
        return this.topPlane;
    }

    /** チャンク数を変更する。サイズが同じなら何もしない。アセットロード完了後に呼ぶこと。 */
    resize(chunkPerViewport: Size2D): void {
        if (this.chunkPerViewport_.w === chunkPerViewport.w && this.chunkPerViewport_.h === chunkPerViewport.h) return;

        this.chunkPerViewport_ = { w: chunkPerViewport.w, h: chunkPerViewport.h };

        // 既存スプライトを削除
        this.terrainPlane.removeChildren();
        this.entityPlane.removeChildren();
        this.chunkSpritePool.length = 0;

        // RenderTexture プールを確保
        this.chunkRenderer.ensureCapacity(chunkPerViewport.w * chunkPerViewport.h * 2);

        // 新しいスプライトを作成
        for (const plane of [this.terrainPlane, this.entityPlane]) {
            for (let y = 0; y < chunkPerViewport.h; y++) {
                for (let x = 0; x < chunkPerViewport.w; x++) {
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
        const halfW = Math.floor((this.chunkPerViewport_.w * this.tilePerChunk) / 2);
        const halfH = Math.floor((this.chunkPerViewport_.h * this.tilePerChunk) / 2);
        const viewportOrigin: Pos2D = {
            x: positionInWorld.x - halfW,
            z: positionInWorld.z - halfH,
        };
        this.renderChunks(viewportOrigin, pointerPos);
    }

    private renderChunks(viewportOrigin: Pos2D, pointerPos: Pos2D) {
        for (let col = 0; col < this.chunkPerViewport_.h; col++) {
            for (let row = 0; row < this.chunkPerViewport_.w; row++) {
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
            setupTerrainTile(tile, voxels, positions, this.voxelMap.horizonHeight, pointerPos, this.pixelPerTile),
        );
        sprite.visible = true;
    }

    private renderEntityChunk(world: Pos2D, col: number, row: number, pointerPos: Pos2D) {
        const idx = this.chunkIndex(col, row, false);
        const sprite = this.chunkSpritePool[idx];
        sprite.texture = this.chunkRenderer.renderChunk(this.voxelMap, world, idx, (tile, voxels, positions) =>
            setupEntityTile(tile, voxels, positions, pointerPos, this.pixelPerTile, this.voxelMap),
        );
        sprite.visible = true;
    }

    private chunkIndex(col: number, row: number, isTerrain: boolean): number {
        const planeOffset = isTerrain ? 0 : this.chunkPerViewport_.w * this.chunkPerViewport_.h;
        return planeOffset + col * this.chunkPerViewport_.w + row;
    }
}

function setupTerrainTile(tile: Tile, voxels: bigint[], positions: Pos3D[], horizonHeight: number, pointerPos: Pos2D, pixelPerTile: number): void {
    const spriteNames = getTerrainSpriteNamesFromVoxel(voxels, positions, horizonHeight);
    tile.useNSprites(spriteNames.length);

    const isHovered = Math.floor(pointerPos.x) === positions[4].x && Math.floor(pointerPos.z) === positions[4].z;

    for (let i = 0; i < spriteNames.length; i++) {
        tile.sprites[i].texture = Texture.from(spriteNames[i]);
        tile.sprites[i].visible = true;
        tile.sprites[i].anchor.set(0, 0);
        tile.sprites[i].filters = isHovered ? [hoverFilter] : [];
        tile.sprites[i].position.set(0);
        tile.sprites[i].scale.set(pixelPerTile / 16);
    }
}

function setupEntityTile(tile: Tile, voxels: bigint[], positions: Pos3D[], pointerPos: Pos2D, pixelPerTile: number, voxelMap: IVoxelReader): void {
    const centerPos = positions[4];
    const centerEntityType = getEntityTypeFromVoxel(voxels[4]);

    let infos = getEntitySpriteNameFromVoxel(voxels[4]);
    let isHovered = Math.floor(pointerPos.x) === centerPos.x && Math.floor(pointerPos.z) === centerPos.z;

    const facilityAnchor = findFacilityAnchor(voxelMap, centerPos.x, centerPos.z);
    if (facilityAnchor) {
        const pointerX = Math.floor(pointerPos.x);
        const pointerZ = Math.floor(pointerPos.z);
        isHovered =
            pointerX >= facilityAnchor.anchorX &&
            pointerX < facilityAnchor.anchorX + facilityAnchor.size.w &&
            pointerZ >= facilityAnchor.anchorZ &&
            pointerZ < facilityAnchor.anchorZ + facilityAnchor.size.h;

        if (centerEntityType === ENTITY_TYPES.facility_part) {
            infos = [];
        }
    }

    tile.useNSprites(infos.length);
    for (let i = 0; i < infos.length; i++) {
        tile.sprites[i].texture = Texture.from(infos[i][0]); // 0: spriteName
        tile.sprites[i].visible = true;
        tile.sprites[i].anchor.set(0, 0);
        tile.sprites[i].filters = isHovered ? [hoverFilter] : [];
        tile.sprites[i].position.set(infos[i][1], infos[i][2]);
        tile.sprites[i].scale.set(pixelPerTile / 16);
    }

    for (let i = infos.length; i < tile.sprites.length; i++) {
        tile.sprites[i].visible = false;
        tile.sprites[i].filters = [];
    }
}
