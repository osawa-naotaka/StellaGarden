import type { Direction8, ICartReader, ICartStorageWriter, ICartWriter, ItemStack, IVoxelReader, Pos2D } from "../_boundary/interfaces";
import type { CartStorageSaveData } from "../lib/SaveSchema";
import { CART_INVENTORY_SLOTS, Cart } from "./Cart";
import { RAIL_CONNECTION_DOWN, RAIL_CONNECTION_LEFT, RAIL_CONNECTION_RIGHT, RAIL_CONNECTION_UP } from "./RailConnection";
import { ENTITY_TYPES, getConnectionsFromVoxel, getDirectionFromVoxel, getEnabledFromVoxel, getEntityTypeFromVoxel, VOXEL_DIRECTION } from "./VoxelDefs";

const CART_MOVE_SPEED = 3; // タイル/秒

type ExitEntry = {
    readonly connectionMask: number;
    /** direction == forward のときの出射辺（タイル外へ抜ける辺のビット）。 */
    readonly exitBit: number;
};

// ---------------------------------------------------------------------------
// FORWARD_EXIT_TABLE: 各レール形状について direction == forward の出射辺を定義
//
// 移動は「タイル内線分（進入辺中央 → 脱出辺中央）」方式で行い、辺中央でスナップ
// するため、dx/dz/facing はここでは持たない（facing は exitBit から導出）。
// ---------------------------------------------------------------------------
const FORWARD_EXIT_TABLE: ReadonlyArray<ExitEntry> = [
    { connectionMask: RAIL_CONNECTION_LEFT | RAIL_CONNECTION_RIGHT, exitBit: RAIL_CONNECTION_RIGHT },
    { connectionMask: RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN, exitBit: RAIL_CONNECTION_DOWN },
    { connectionMask: RAIL_CONNECTION_UP | RAIL_CONNECTION_RIGHT, exitBit: RAIL_CONNECTION_UP },
    { connectionMask: RAIL_CONNECTION_UP | RAIL_CONNECTION_LEFT, exitBit: RAIL_CONNECTION_LEFT },
    { connectionMask: RAIL_CONNECTION_DOWN | RAIL_CONNECTION_RIGHT, exitBit: RAIL_CONNECTION_RIGHT },
    { connectionMask: RAIL_CONNECTION_DOWN | RAIL_CONNECTION_LEFT, exitBit: RAIL_CONNECTION_DOWN },
];

/** connectionMask と direction から出射辺ビットを返す。解決できなければ null。 */
function resolveExitBit(connectionMask: number, direction: number): number | null {
    const entry = FORWARD_EXIT_TABLE.find((e) => e.connectionMask === connectionMask);
    if (!entry) return null;
    if (direction === VOXEL_DIRECTION.forward) return entry.exitBit;
    // backward: もう一方の接続辺
    return connectionMask & ~entry.exitBit;
}

/** 単一の接続辺ビットから facing（描画向き）を返す。 */
function bitToFacing(bit: number): Direction8 | null {
    switch (bit) {
        case RAIL_CONNECTION_UP:
            return "up";
        case RAIL_CONNECTION_DOWN:
            return "down";
        case RAIL_CONNECTION_LEFT:
            return "left";
        case RAIL_CONNECTION_RIGHT:
            return "right";
        default:
            return null;
    }
}

/** タイル(tx, tz) の指定辺の中央のワールド座標を返す（ボクセル単位）。 */
function edgeCenterWorld(tx: number, tz: number, bit: number): Pos2D {
    switch (bit) {
        case RAIL_CONNECTION_UP:
            return { x: tx + 0.5, z: tz };
        case RAIL_CONNECTION_DOWN:
            return { x: tx + 0.5, z: tz + 1.0 };
        case RAIL_CONNECTION_LEFT:
            return { x: tx, z: tz + 0.5 };
        case RAIL_CONNECTION_RIGHT:
            return { x: tx + 1.0, z: tz + 0.5 };
        default:
            return { x: tx + 0.5, z: tz + 0.5 };
    }
}

/** exitBit に従って隣接タイル座標を返す。 */
function neighborTile(tx: number, tz: number, bit: number): { tx: number; tz: number } {
    switch (bit) {
        case RAIL_CONNECTION_UP:
            return { tx, tz: tz - 1 };
        case RAIL_CONNECTION_DOWN:
            return { tx, tz: tz + 1 };
        case RAIL_CONNECTION_LEFT:
            return { tx: tx - 1, tz };
        case RAIL_CONNECTION_RIGHT:
            return { tx: tx + 1, tz };
        default:
            return { tx, tz };
    }
}

/**
 * 全台車（Cart）の生成・撤去・フレーム移動を管理するストレージ。
 * 座標キーではなく ID ベースで管理する（台車は移動するため）。
 */
export class CartStorage implements ICartStorageWriter {
    private carts: Map<number, Cart> = new Map();
    private nextId = 1;

    // ── ICartStorageReader ──

    getAll(): Iterable<ICartReader> {
        return this.carts.values();
    }

    findAt(worldPos: Pos2D, _radius: number): ICartReader | null {
        // worldPos と同じタイル上にいるカートを返す（タイル単位の判定）。
        // 入力 worldPos はタイル単位の整数座標も浮動小数座標も許容するため floor で正規化する。
        // radius は API 互換性のため残しているが現状は未使用。
        const targetTx = Math.floor(worldPos.x);
        const targetTz = Math.floor(worldPos.z);
        for (const cart of this.carts.values()) {
            const cartTx = Math.floor(cart.posInWorld.x);
            const cartTz = Math.floor(cart.posInWorld.z);
            if (cartTx === targetTx && cartTz === targetTz) return cart;
        }
        return null;
    }

    getById(id: number): ICartReader | undefined {
        return this.carts.get(id);
    }

    // ── ICartStorageWriter ──

    getByIdWritable(id: number): ICartWriter | undefined {
        return this.carts.get(id);
    }

    spawn(pos: Pos2D): ICartWriter {
        const id = this.nextId++;
        const cart = new Cart(id, { x: pos.x + 0.5, z: pos.z + 0.5 });
        this.carts.set(id, cart);
        return cart;
    }

    remove(id: number): boolean {
        return this.carts.delete(id);
    }

    /**
     * 全台車の移動処理を 1 フレーム分実行する。
     *
     * タイル内線分方式:
     *   各タイル内で「現在位置 → 脱出辺中央」の線分に沿って残距離 (speed * dt) を消費する。
     *   タイル境界に到達したら posInWorld を辺中央にスナップ（誤差ゼロ）し、隣タイル番号を
     *   明示的に進めてループ継続。残距離が脱出辺中央に届かなければ線分上で中間停止。
     */
    tickAll(voxelMap: IVoxelReader, deltaMS: number): void {
        const dt = deltaMS / 1000;
        const MAX_HOPS = 8; // 1フレームで跨げる最大タイル数（無限ループ防止）

        for (const cart of this.carts.values()) {
            let remaining = CART_MOVE_SPEED * dt;
            let tx = Math.floor(cart.posInWorld.x);
            let tz = Math.floor(cart.posInWorld.z);

            for (let hop = 0; hop < MAX_HOPS && remaining > 0; hop++) {
                const surfacePos = voxelMap.getSurfacePosition({ x: tx, y: 0, z: tz });
                const voxel = voxelMap.get(surfacePos);

                if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.rail) break;
                if (!getEnabledFromVoxel(voxel)) break;

                const connectionMask = getConnectionsFromVoxel(voxel);
                const exitBit = resolveExitBit(connectionMask, getDirectionFromVoxel(voxel));
                if (exitBit === null) break;

                const facing = bitToFacing(exitBit);
                if (facing !== null) cart.setFacing(facing);

                // 次タイルが進入可能（rail）かどうかをチェック
                // 不可なら線分終点をタイル中央に切り替えてカートをタイル中央で停止させる
                const next = neighborTile(tx, tz, exitBit);
                const nextSurfacePos = voxelMap.getSurfacePosition({ x: next.tx, y: 0, z: next.tz });
                const nextVoxel = voxelMap.get(nextSurfacePos);
                const nextIsRail = getEntityTypeFromVoxel(nextVoxel) === ENTITY_TYPES.rail;

                // 線分終点を決定
                let segmentEnd: Pos2D;
                if (nextIsRail) {
                    segmentEnd = edgeCenterWorld(tx, tz, exitBit);
                } else {
                    // 進入辺中央〜脱出辺中央の線分上で、現在位置 t を計算
                    // t < 0.5: タイル中央未到達 → タイル中央が終点
                    // t >= 0.5: タイル中央通過済み → 現在地で停止
                    const enterBit = connectionMask & ~exitBit;
                    const entryCenter = edgeCenterWorld(tx, tz, enterBit);
                    const exitCenter = edgeCenterWorld(tx, tz, exitBit);
                    const vx = exitCenter.x - entryCenter.x;
                    const vz = exitCenter.z - entryCenter.z;
                    const ux = cart.posInWorld.x - entryCenter.x;
                    const uz = cart.posInWorld.z - entryCenter.z;
                    const vLenSq = vx * vx + vz * vz;
                    const t = vLenSq > 0 ? (ux * vx + uz * vz) / vLenSq : 0;
                    if (t >= 0.5) break; // タイル中央通過済み: 現在地で停止
                    segmentEnd = { x: tx + 0.5, z: tz + 0.5 };
                }

                const dx = segmentEnd.x - cart.posInWorld.x;
                const dz = segmentEnd.z - cart.posInWorld.z;
                const distToEnd = Math.sqrt(dx * dx + dz * dz);

                if (distToEnd <= 0) {
                    if (nextIsRail) {
                        // 既に脱出辺中央: 隣タイルに踏み込んでループ継続
                        tx = next.tx;
                        tz = next.tz;
                        continue;
                    }
                    // タイル中央でちょうど停止
                    break;
                }

                if (remaining >= distToEnd) {
                    cart.setPosInWorld({ x: segmentEnd.x, z: segmentEnd.z });
                    remaining -= distToEnd;
                    if (nextIsRail) {
                        // 脱出辺中央にスナップ → 次タイルへ
                        tx = next.tx;
                        tz = next.tz;
                    } else {
                        // タイル中央到達 → 停止
                        break;
                    }
                } else {
                    // 中間で停止
                    const t = remaining / distToEnd;
                    cart.setPosInWorld({
                        x: cart.posInWorld.x + dx * t,
                        z: cart.posInWorld.z + dz * t,
                    });
                    remaining = 0;
                }
            }
        }
    }

    // ── セーブ / ロード ──

    toSaveData(): CartStorageSaveData {
        const carts = Array.from(this.carts.values()).map((cart) => ({
            id: cart.id,
            posInWorld: { x: cart.posInWorld.x, z: cart.posInWorld.z },
            inventorySlots: [...cart.inventorySlots] as (ItemStack | null)[],
            attachmentSlot: cart.attachmentSlot,
        }));
        return { nextId: this.nextId, carts };
    }

    loadSaveData(data: CartStorageSaveData): void {
        this.carts.clear();
        this.nextId = data.nextId;
        for (const entry of data.carts) {
            const cart = new Cart(entry.id, entry.posInWorld);
            // インベントリスロットを復元
            for (let i = 0; i < Math.min(entry.inventorySlots.length, CART_INVENTORY_SLOTS); i++) {
                cart.setInventorySlot(i, entry.inventorySlots[i]);
            }
            cart.attachmentSlot = entry.attachmentSlot;
            this.carts.set(cart.id, cart);
        }
    }
}
