import { type Application, Container, Sprite, Texture } from "pixi.js";
import { getEntitySpriteNameFromVoxel, getTerrainSpriteNameFromVoxel } from "../Entity/Terrain";
import { ChunkRenderer } from "../lib/ChunkRenderer";
import type { Tile } from "../lib/Tile";
import type { Pos2D, Pos3D, VoxelMap } from "../lib/VoxelMap";

export class TopViewMap {
    private voxelMap: VoxelMap;
    private topPlane: Container;
    private terrainPlane: Container;
    private entityPlane: Container;
    private chunkRenderer: ChunkRenderer;
    private chunkSpritePool: Sprite[]; // チャンクごとのスプライトリスト

    private pixelPerTile: number;
    private tilePerChunk: number;
    private chunkPerViewport: Pos2D;

    constructor(voxelMap: VoxelMap, app: Application, opt: { pixelPerTile: number; tilePerChunk: number; chunkPerViewport: Pos2D }) {
        this.voxelMap = voxelMap;

        this.topPlane = new Container();
        this.terrainPlane = new Container();
        this.entityPlane = new Container();
        this.topPlane.addChild(this.terrainPlane);
        this.topPlane.addChild(this.entityPlane);

        this.chunkSpritePool = [];
        this.pixelPerTile = opt.pixelPerTile;
        this.tilePerChunk = opt.tilePerChunk;
        this.chunkPerViewport = opt.chunkPerViewport;
        this.chunkRenderer = new ChunkRenderer(app, {
            pixelPerTile: opt.pixelPerTile,
            tilePerChunk: opt.tilePerChunk,
            numRenderTextures: opt.chunkPerViewport.x * opt.chunkPerViewport.z * 2,
        });
    }

    get top() {
        return this.topPlane;
    }

    // チャンクスプライトを初期化して親コンテナに配置する。スプライトは全て空のテクスチャで初期化され、後でビューポートに合わせて更新される。
    initializeSprites() {
        // Terrain & Entity
        for (let i = 0; i < 2; i++) {
            for (let y = 0; y < this.chunkPerViewport.z; y++) {
                for (let x = 0; x < this.chunkPerViewport.x; x++) {
                    const chunkSprite = new Sprite(Texture.EMPTY);
                    chunkSprite.x = x * this.tilePerChunk * this.pixelPerTile;
                    chunkSprite.y = y * this.tilePerChunk * this.pixelPerTile;
                    this.chunkSpritePool.push(chunkSprite);
                    if (i === 0) {
                        this.terrainPlane.addChild(chunkSprite);
                    } else {
                        this.entityPlane.addChild(chunkSprite);
                    }
                }
            }
        }
    }

    // プレイヤー位置を受け取り、タイル位置が変わった場合のみスプライトを更新する
    updateViewport(positionInWorld: Pos2D) {
        const { left, top } = this.calcViewCorners(positionInWorld);
        this.refreshSprites({ x: left, z: top });
    }

    // ビューポートの中心位置を受け取り、ボクセルマップ中のどの領域がビューポートに入るかを計算する
    private calcViewCorners(center: Pos2D): { left: number; right: number; top: number; bottom: number } {
        const halfViewportSizeW = Math.floor((this.chunkPerViewport.x * this.tilePerChunk) / 2);
        const halfViewportSizeH = Math.floor((this.chunkPerViewport.z * this.tilePerChunk) / 2);
        const left = center.x - halfViewportSizeW;
        const right = center.x + halfViewportSizeW;
        const top = center.z - halfViewportSizeH;
        const bottom = center.z + halfViewportSizeH;

        return { left, right, top, bottom };
    }

    // terrain spriteのテクスチャを現在のビューポートに合わせて更新する
    private refreshSprites(viewportOrigin: Pos2D) {
        // terrain pool spriteを更新
        for (let col = 0; col < this.chunkPerViewport.z; col++) {
            for (let row = 0; row < this.chunkPerViewport.x; row++) {
                const worldX = viewportOrigin.x + row * this.tilePerChunk;
                const worldZ = viewportOrigin.z + col * this.tilePerChunk;
                this.processTerrainChunk({ x: worldX, z: worldZ }, col, row);
                this.processEntityChunk({ x: worldX, z: worldZ }, col, row);
            }
        }
    }

    private processTerrainChunk(world: Pos2D, col: number, row: number) {
        const sprite = this.chunkSpritePool[this.colRowToChunkIndex(col, row, true)];

        const texture = this.chunkRenderer.renderChunk(this.voxelMap, world, this.colRowToChunkIndex(col, row, true), setupTerrainSpriteFromVoxel);
        sprite.texture = texture;
        sprite.visible = true;
    }

    private processEntityChunk(world: Pos2D, col: number, row: number) {
        const sprite = this.chunkSpritePool[this.colRowToChunkIndex(col, row, false)];

        const texture = this.chunkRenderer.renderChunk(this.voxelMap, world, this.colRowToChunkIndex(col, row, false), setupEntitySpriteFromVoxel);
        sprite.texture = texture;
        sprite.visible = true;
    }

    private colRowToChunkIndex(col: number, row: number, isTerrain: boolean): number {
        const planeOffset = isTerrain ? 0 : this.chunkPerViewport.x * this.chunkPerViewport.z;
        return planeOffset + col * this.chunkPerViewport.x + row;
    }
}

function setupTerrainSpriteFromVoxel(tile: Tile, voxel: number, position: Pos3D) {
    const spriteName = getTerrainSpriteNameFromVoxel(voxel, position);
    tile.sprite.texture = Texture.from(spriteName);
    tile.sprite.visible = true;
}

function setupEntitySpriteFromVoxel(tile: Tile, voxel: number, _position: Pos3D) {
    const spriteName = getEntitySpriteNameFromVoxel(voxel);
    if (spriteName) {
        tile.sprite.texture = Texture.from(spriteName);
        tile.sprite.visible = true;
        tile.sprite.anchor.set(0, 0);
    } else {
        tile.sprite.visible = false;
    }
}
