import type { IEventBroker, IPlayerStateWriter, IVoxelReader, Pos2D } from "../_boundary/interfaces";
import { getTerrainTypeFromVoxel, TERRAIN_TYPES } from "./VoxelDefs";

/**
 * BFS の探索半径（マンハッタン距離）。
 * 川沿いの掘削による水の伝播は 8 タイル程度までなので、16 で安全マージンを取る。
 */
const RESCUE_SEARCH_RADIUS = 16;

/**
 * プレイヤーの足元が水化されたときに、最寄りの陸地タイルへ自動的にワープさせる。
 *
 * 発動条件:
 *  - `terrain_changed` が発火
 *  - 変化したタイルがプレイヤーの現在の足元タイル（floor された posInWorld）と一致
 *  - 変化後の地形タイプが water / waterSource
 *
 * 解決ロジック:
 *  - プレイヤー位置から 4 近傍 BFS で「歩ける」地形タイルを探す
 *  - 最も近いタイルが見つかればその中心にワープ
 *  - 半径 RESCUE_SEARCH_RADIUS 以内に見つからなければ no-op（実質ありえない想定）
 *
 * 戻り値は subscribe の dispose 関数。
 */
export function createPlayerRescueHandler(voxelMap: IVoxelReader, playerState: IPlayerStateWriter, broker: IEventBroker): () => void {
    return broker.subscribe("terrain_changed", (packet) => {
        const playerTileX = Math.floor(playerState.posInWorld.x);
        const playerTileZ = Math.floor(playerState.posInWorld.z);
        if (packet.pos.x !== playerTileX || packet.pos.z !== playerTileZ) return;

        const terrainType = getTerrainTypeFromVoxel(packet.voxel);
        if (!isWaterTerrain(terrainType)) return;

        const rescueTile = findNearestWalkableTile(voxelMap, playerTileX, playerTileZ, RESCUE_SEARCH_RADIUS);
        if (rescueTile === null) return;

        // タイル中心へワープ（PlayerState の posInWorld はタイル座標系の浮動小数）。
        playerState.teleportTo({ x: rescueTile.x + 0.5, z: rescueTile.z + 0.5 });
    });
}

function isWaterTerrain(terrainType: number): boolean {
    return terrainType === TERRAIN_TYPES.water || terrainType === TERRAIN_TYPES.waterSource;
}

function isWalkableTerrain(terrainType: number): boolean {
    if (terrainType === TERRAIN_TYPES.empty) return false;
    if (isWaterTerrain(terrainType)) return false;
    return true;
}

const BFS_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
];

/**
 * 4 近傍 BFS で、startX/startZ から最も近い「歩ける」地形タイルの位置を返す。
 * start タイル自身は対象外（既に水化されているはず）。半径 maxRadius 以内に見つからなければ null。
 */
function findNearestWalkableTile(voxelMap: IVoxelReader, startX: number, startZ: number, maxRadius: number): Pos2D | null {
    const visited = new Set<string>();
    const startKey = `${startX},${startZ}`;
    visited.add(startKey);

    let frontier: Array<{ x: number; z: number }> = [{ x: startX, z: startZ }];
    for (let dist = 1; dist <= maxRadius; dist++) {
        const next: Array<{ x: number; z: number }> = [];
        for (const node of frontier) {
            for (const [dx, dz] of BFS_DIRECTIONS) {
                const nx = node.x + dx;
                const nz = node.z + dz;
                if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
                const key = `${nx},${nz}`;
                if (visited.has(key)) continue;
                visited.add(key);
                next.push({ x: nx, z: nz });

                const surface = voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz });
                const voxel = voxelMap.get(surface);
                if (isWalkableTerrain(getTerrainTypeFromVoxel(voxel))) {
                    return { x: nx, z: nz };
                }
            }
        }
        if (next.length === 0) return null;
        frontier = next;
    }
    return null;
}
