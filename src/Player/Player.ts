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
        this.m_worldX = Math.max(0, Math.min(mapWidth - 1, this.m_worldX + dx * this.speed * dt));
        this.m_worldZ = Math.max(0, Math.min(mapDepth - 1, this.m_worldZ + dz * this.speed * dt));
    }
}
