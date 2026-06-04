import type { IInventoryWriter, ItemId } from "../_boundary/interfaces";
import type { ReputationSystem } from "./ReputationSystem";

/** リクエスト1回で届く種の個数（1スタック）。 */
export const SEED_STACK_COUNT = 64;

/**
 * リクエスト可能な種とその評価値ペナルティの定義。
 * ペナルティはおおむね「1スタックの出荷価値の約10倍」を基準に設定している
 * （詰み＝種の枯渇を救済する代償として大幅な減点を課す）。値はプレイテストで調整する。
 */
export interface SeedRequestDef {
    readonly seedId: ItemId;
    readonly displayName: string;
    readonly penalty: number;
}

export const SEED_REQUEST_DEFS: readonly SeedRequestDef[] = [
    { seedId: "potato", displayName: "じゃがいも", penalty: 64_000 },
    { seedId: "soybeans", displayName: "大豆", penalty: 192_000 },
    { seedId: "flaxseed", displayName: "亜麻の種", penalty: 100_000 },
    { seedId: "wheat", displayName: "麦", penalty: 100_000 },
];

export function getSeedRequestDef(seedId: ItemId): SeedRequestDef | undefined {
    return SEED_REQUEST_DEFS.find((d) => d.seedId === seedId);
}

export type SeedRequestSaveData = { pending: ItemId | null };

/**
 * 転移ゲートの地球側に出す「種のリクエスト」を管理する。
 *
 * - 1日に1種類の種を1スタック（64個）だけリクエストできる（保留は常に最大1件）。
 * - 朝5時（day_changed）に fulfill() が呼ばれ、保留中の種を1スタック分インベントリへ追加し、
 *   評価値に大幅なペナルティを課す。
 * - インベントリが満杯で追加できない場合はリクエストを保留したまま翌日に再試行し、減点もしない
 *   （addItems はオールオアナッシングのため部分配達は起きない）。
 */
export class SeedRequestSystem {
    private pending: ItemId | null;

    constructor(init?: SeedRequestSaveData) {
        this.pending = init?.pending ?? null;
    }

    /** 現在保留中の種を返す（なければ null）。 */
    getPending(): ItemId | null {
        return this.pending;
    }

    /** 種をリクエストする。1日1件のため既存の保留は上書きされる。 */
    request(seedId: ItemId): void {
        if (!getSeedRequestDef(seedId)) return;
        this.pending = seedId;
    }

    /** 保留中のリクエストを取り消す。 */
    cancel(): void {
        this.pending = null;
    }

    /**
     * day_changed 時に呼ぶ。保留中の種を1スタック分インベントリへ追加し、成功したら
     * 評価値にペナルティを課して保留を解除する。満杯で追加できなければ保留のまま翌日へ持ち越す。
     */
    fulfill(inventory: IInventoryWriter, reputationSystem: ReputationSystem): void {
        if (this.pending === null) return;
        const def = getSeedRequestDef(this.pending);
        if (!def) {
            this.pending = null;
            return;
        }
        const added = inventory.addItems([{ itemId: def.seedId, count: SEED_STACK_COUNT }]);
        if (!added) return; // インベントリ満杯 → 保留のまま翌日再試行（減点もしない）
        reputationSystem.applyPenalty(def.penalty);
        this.pending = null;
    }

    /** セーブ用に内部状態を返す。 */
    toSaveData(): SeedRequestSaveData {
        return { pending: this.pending };
    }

    /** セーブデータから復元する。 */
    loadSaveData(data: SeedRequestSaveData): void {
        this.pending = data.pending ?? null;
    }
}
