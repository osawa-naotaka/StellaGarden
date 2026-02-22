import { TILE_PER_VIEWPORT } from "../TopViewMap/TopViewMap";

export class Player {
    private m_worldX: number;
    private m_worldZ: number;
    readonly speed = 10; // タイル/秒

    constructor(startX: number, startZ: number) {
        this.m_worldX = startX;
        this.m_worldZ = startZ;
    }

    get worldX() {
        return this.m_worldX;
    }

    get worldZ() {
        return this.m_worldZ;
    }

    move(dx: number, dz: number, deltaMS: number, mapWidth: number, mapDepth: number) {
        const dt = deltaMS / 1000;
        // 移動後の位置を計算。マップの端で止まるようにする。
        // チャンクを描画する際に、チャンクサイズより1タイルだけ外側を参照する。そのため、+-1の余裕を持たせる。
        this.m_worldX = Math.max(TILE_PER_VIEWPORT / 2 + 1, Math.min(mapWidth - 1 - TILE_PER_VIEWPORT / 2, this.m_worldX + dx * this.speed * dt));
        this.m_worldZ = Math.max(TILE_PER_VIEWPORT / 2 + 1, Math.min(mapDepth - 1 - TILE_PER_VIEWPORT / 2, this.m_worldZ + dz * this.speed * dt));
    }
}
