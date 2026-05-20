import type { Direction8, ICartReader, ICartStorageWriter, ICartWriter, IVoxelReader, ItemStack, Pos2D } from "../_boundary/interfaces";
import type { CartStorageSaveData } from "../lib/SaveSchema";
import { Cart, CART_INVENTORY_SLOTS } from "./Cart";
import {
    ENTITY_TYPES,
    VOXEL_DIRECTION,
    getConnectionsFromVoxel,
    getDirectionFromVoxel,
    getEnabledFromVoxel,
    getEntityTypeFromVoxel,
} from "./VoxelDefs";
import {
    RAIL_CONNECTION_DOWN,
    RAIL_CONNECTION_LEFT,
    RAIL_CONNECTION_RIGHT,
    RAIL_CONNECTION_UP,
} from "./RailConnection";

const CART_MOVE_SPEED = 3; // タイル/秒

// ---------------------------------------------------------------------------
// forward 出口辺テーブル
//
// direction == forward の場合、connectionMask から出口辺（exitBit）を決定する。
// 各エントリ: [connectionMask, exitBit, dx, dz, facing]
//
// 導出根拠（RailTractionFlow.setTractionDirectionAndEnable のロジックより）:
//   LEFT | RIGHT  → 牽引が RIGHT 側から入り RIGHT 方向へ進む  (dx=+1)
//   UP   | DOWN   → 牽引が DOWN  側から入り DOWN  方向へ進む  (dz=+1)
//   UP   | RIGHT  → 牽引が UP   側から入り RIGHT 方向へ出る   (dx=+1)
//   UP   | LEFT   → 牽引が LEFT 側から入り UP    方向へ出る   (dz=-1)
//   DOWN | RIGHT  → 牽引が RIGHT側から入り DOWN  方向へ出る   (dz=+1)
//   DOWN | LEFT   → 牽引が DOWN 側から入り LEFT  方向へ出る   (dx=-1)
//
// direction == backward の場合は opposite: dx, dz, facing を反転し exitBit も逆にする。
// ---------------------------------------------------------------------------

type ExitEntry = {
    readonly connectionMask: number;
    readonly exitBit: number;
    readonly dx: number;
    readonly dz: number;
    readonly facing: Direction8;
};

// ── 行番号 36 付近: テーブル定義開始 ──
const FORWARD_EXIT_TABLE: ReadonlyArray<ExitEntry> = [
    {
        connectionMask: RAIL_CONNECTION_LEFT | RAIL_CONNECTION_RIGHT,
        exitBit: RAIL_CONNECTION_RIGHT,
        dx: +1,
        dz: 0,
        facing: "right",
    },
    {
        connectionMask: RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN,
        exitBit: RAIL_CONNECTION_DOWN,
        dx: 0,
        dz: +1,
        facing: "down",
    },
    {
        connectionMask: RAIL_CONNECTION_UP | RAIL_CONNECTION_RIGHT,
        exitBit: RAIL_CONNECTION_RIGHT,
        dx: +1,
        dz: 0,
        facing: "right",
    },
    {
        connectionMask: RAIL_CONNECTION_UP | RAIL_CONNECTION_LEFT,
        exitBit: RAIL_CONNECTION_UP,
        dx: 0,
        dz: -1,
        facing: "up",
    },
    {
        connectionMask: RAIL_CONNECTION_DOWN | RAIL_CONNECTION_RIGHT,
        exitBit: RAIL_CONNECTION_DOWN,
        dx: 0,
        dz: +1,
        facing: "down",
    },
    {
        connectionMask: RAIL_CONNECTION_DOWN | RAIL_CONNECTION_LEFT,
        exitBit: RAIL_CONNECTION_LEFT,
        dx: -1,
        dz: 0,
        facing: "left",
    },
];
// ── テーブル定義終了 ──

/** 単一の接続辺ビットから移動ベクトル / facing に変換する。 */
function bitToMove(bit: number): { dx: number; dz: number; facing: Direction8 } | null {
    switch (bit) {
        case RAIL_CONNECTION_UP: return { dx: 0, dz: -1, facing: "up" };
        case RAIL_CONNECTION_DOWN: return { dx: 0, dz: +1, facing: "down" };
        case RAIL_CONNECTION_LEFT: return { dx: -1, dz: 0, facing: "left" };
        case RAIL_CONNECTION_RIGHT: return { dx: +1, dz: 0, facing: "right" };
        default: return null;
    }
}

/**
 * connectionMask と direction から移動ベクトルと facing を返す。
 *
 * forward の場合は FORWARD_EXIT_TABLE で定義した出射辺を使う。
 * backward の場合は connectionMask からその出射辺ビットを除いた残りの辺が出射辺になる
 * （カーブでは「forward の dx/dz を単純反転」では正しい出射辺にならないため）。
 */
function resolveExit(
    connectionMask: number,
    direction: number,
): { dx: number; dz: number; facing: Direction8 } | null {
    const entry = FORWARD_EXIT_TABLE.find((e) => e.connectionMask === connectionMask);
    if (!entry) return null;

    if (direction === VOXEL_DIRECTION.forward) {
        return { dx: entry.dx, dz: entry.dz, facing: entry.facing };
    }
    // backward: もう一方の接続辺へ向かう
    const backwardExitBit = connectionMask & ~entry.exitBit;
    return bitToMove(backwardExitBit);
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

    findAt(worldPos: Pos2D, radius: number): ICartReader | null {
        let best: Cart | null = null;
        let bestDist = radius;
        for (const cart of this.carts.values()) {
            const dx = cart.posInWorld.x - worldPos.x;
            const dz = cart.posInWorld.z - worldPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= bestDist) {
                bestDist = dist;
                best = cart;
            }
        }
        return best;
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
     * 各カートについて:
     *   1. 現在タイルの surface voxel を取得
     *   2. rail エンティティかつ enabled でなければ停止
     *   3. connectionMask と direction からテーブルで出口方向を決定
     *   4. posInWorld を更新し、facing を書き換え
     */
    tickAll(voxelMap: IVoxelReader, deltaMS: number): void {
        const dt = deltaMS / 1000;
        const speed = CART_MOVE_SPEED;

        for (const cart of this.carts.values()) {
            const cx = Math.floor(cart.posInWorld.x);
            const cz = Math.floor(cart.posInWorld.z);

            const surfacePos = voxelMap.getSurfacePosition({ x: cx, y: 0, z: cz });
            const voxel = voxelMap.get(surfacePos);

            // rail エンティティかつ enabled でなければ停止
            if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.rail) continue;
            if (!getEnabledFromVoxel(voxel)) continue;

            const connectionMask = getConnectionsFromVoxel(voxel);
            const direction = getDirectionFromVoxel(voxel);

            const exit = resolveExit(connectionMask, direction);
            if (!exit) continue;

            // 位置を更新
            cart.setPosInWorld({
                x: cart.posInWorld.x + exit.dx * speed * dt,
                z: cart.posInWorld.z + exit.dz * speed * dt,
            });

            cart.setFacing(exit.facing);
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
